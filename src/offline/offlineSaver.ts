import type { SpeechManifest } from '../speech/manifest';
import { SPEECH_CACHE } from './cacheNames';

export type OfflinePhase =
  /** This browser can't keep the app offline (no service worker or Cache Storage). */
  | 'unsupported'
  /** Looking at what is already saved. */
  | 'checking'
  /** Not fully saved, and not downloading right now. */
  | 'idle'
  | 'downloading'
  /** Downloading, but the device is offline; it carries on when the connection comes back. */
  | 'waiting'
  | 'saved'
  /** Stopped with files still missing; `problem` says why. */
  | 'failed';

export interface OfflineStatus {
  readonly phase: OfflinePhase;
  /** Speech files saved so far, out of `total`. */
  readonly saved: number;
  readonly total: number;
  readonly problem?: 'network' | 'space';
}

/** Downloads every recording so the games work without internet ("Play offline"). */
export interface OfflineSaver {
  readonly status: () => OfflineStatus;
  /** For useSyncExternalStore. The first subscriber triggers a look at what is saved. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Downloads whatever is missing. Safe to call again to resume or retry. */
  readonly start: () => void;
  /** Pauses; what's saved stays saved. */
  readonly stop: () => void;
  /** Voices with every take saved, so a visit without internet can stick to them. */
  readonly savedVoices: () => Promise<readonly string[]>;
}

export interface OfflineSaverOptions {
  readonly manifest: Promise<SpeechManifest | undefined>;
  readonly clipUrl: (voice: string, id: string, take: number) => string;
  /** Undefined where the app can't work offline. */
  readonly caches: CacheStorage | undefined;
  /** Resolves once the service worker has saved the app itself; false if that failed. */
  readonly appSaved: () => Promise<boolean>;
  readonly fetch?: (url: string, init: { signal: AbortSignal }) => Promise<Response>;
  /** Makes clip URLs absolute, the way Cache Storage keys them. */
  readonly resolveUrl?: (url: string) => string;
  readonly isOnline?: () => boolean;
  readonly onOnline?: (listener: () => void) => () => void;
  /** Asks the browser not to clear the download when space runs low. */
  readonly persist?: () => Promise<unknown>;
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Files downloaded at the same time. */
  readonly concurrency?: number;
  /** Tries per file before giving up on it, not counting time spent offline. */
  readonly attempts?: number;
}

interface PlannedFile {
  readonly voice: string;
  readonly url: string;
}

/** Waits 1 s, 2 s, 4 s… between tries of one file, up to 15 s. */
export const retryDelay = (failures: number): number =>
  Math.min(1000 * 2 ** (failures - 1), 15_000);

export function createOfflineSaver({
  manifest,
  clipUrl,
  caches,
  appSaved,
  fetch: fetchFile = (url, init) => fetch(url, init),
  resolveUrl = (url) => new URL(url, document.baseURI).href,
  isOnline = () => navigator.onLine,
  onOnline = listenForOnline,
  persist,
  sleep = abortableSleep,
  concurrency = 8,
  attempts = 5,
}: OfflineSaverOptions): OfflineSaver {
  const listeners = new Set<() => void>();
  let current: OfflineStatus = { phase: caches ? 'checking' : 'unsupported', saved: 0, total: 0 };
  let checked = false;
  let running: AbortController | undefined;

  // Every take of every line in every voice, one voice after another, so an interrupted
  // download still leaves whole voices to play offline.
  const planned: Promise<readonly PlannedFile[]> = manifest.then((available) =>
    (available?.voices ?? []).flatMap((voice) =>
      Object.entries(available?.clips ?? {}).flatMap(([id, clip]) =>
        Array.from({ length: clip.takes }, (_, take) => ({
          voice: voice.id,
          url: resolveUrl(clipUrl(voice.id, id, take)),
        })),
      ),
    ),
  );

  function set(next: OfflineStatus): void {
    current = next;
    for (const listener of listeners) listener();
  }

  async function savedUrls(cache: Cache): Promise<Set<string>> {
    return new Set((await cache.keys()).map((request) => request.url));
  }

  async function check(store: CacheStorage): Promise<void> {
    try {
      const [files, have] = await Promise.all([planned, store.open(SPEECH_CACHE).then(savedUrls)]);
      const saved = files.filter((file) => have.has(file.url)).length;
      const complete = saved === files.length && (await appSaved());
      // A download that started meanwhile reports its own progress.
      if (!running) set({ phase: complete ? 'saved' : 'idle', saved, total: files.length });
    } catch {
      if (!running) set({ phase: 'idle', saved: 0, total: 0 });
    }
  }

  async function download(store: CacheStorage, signal: AbortSignal): Promise<void> {
    const files = await planned;
    const total = files.length;
    set({ phase: 'checking', saved: current.saved, total });
    void persist?.().catch(() => undefined);

    const cache = await store.open(SPEECH_CACHE);
    const keys = await cache.keys();
    const wanted = new Set(files.map((file) => file.url));
    // Recordings the app no longer uses would only take up space.
    await Promise.all(keys.filter((key) => !wanted.has(key.url)).map((key) => cache.delete(key)));
    const have = new Set(keys.map((key) => key.url));
    const missing = files.filter((file) => !have.has(file.url)).map((file) => file.url);

    let saved = total - missing.length;
    let failed = 0;
    let waiting = 0;
    let full = false;
    let next = 0;
    let shown = '';
    const report = () => {
      const phase = waiting > 0 ? 'waiting' : 'downloading';
      // Once per percent is plenty for a progress bar, and spares thousands of re-renders.
      const progress = `${phase} ${Math.floor((saved * 100) / Math.max(total, 1))}`;
      if (progress !== shown || saved === total) set({ phase, saved, total });
      shown = progress;
    };

    const untilOnline = async () => {
      waiting++;
      report();
      try {
        await waitForOnline(isOnline, onOnline, signal);
      } finally {
        waiting--;
        report();
      }
    };

    async function saveOne(url: string): Promise<void> {
      for (let failures = 0; ;) {
        if (!isOnline()) await untilOnline();
        try {
          const response = await fetchFile(url, { signal });
          if (!response.ok) throw new Error(`${response.status} for ${url}`);
          await cache.put(url, response);
          return;
        } catch (error) {
          if (signal.aborted || isQuotaError(error)) throw error;
          // Dropping offline mid-download isn't the file's fault; wait instead of giving up.
          if (!isOnline()) continue;
          if (++failures >= attempts) throw error;
          await sleep(retryDelay(failures), signal);
        }
      }
    }

    async function worker(): Promise<void> {
      while (next < missing.length && !signal.aborted && !full) {
        const url = missing[next++] as string;
        try {
          await saveOne(url);
          saved++;
        } catch (error) {
          if (isQuotaError(error)) full = true;
          else if (!signal.aborted) failed++;
        }
        report();
      }
    }

    report();
    await Promise.all(Array.from({ length: concurrency }, worker));

    if (signal.aborted) set({ phase: 'idle', saved, total });
    else if (full) set({ phase: 'failed', problem: 'space', saved, total });
    else if (failed > 0 || !(await appSaved()))
      set({ phase: 'failed', problem: 'network', saved, total });
    else set({ phase: 'saved', saved, total });
  }

  return {
    status: () => current,
    subscribe(listener) {
      listeners.add(listener);
      if (!checked && caches) {
        checked = true;
        void check(caches);
      }
      return () => listeners.delete(listener);
    },
    start() {
      if (!caches || running) return;
      const controller = new AbortController();
      running = controller;
      checked = true;
      download(caches, controller.signal)
        .catch((error: unknown) => {
          const problem = isQuotaError(error) ? 'space' : 'network';
          set({ phase: 'failed', problem, saved: current.saved, total: current.total });
        })
        .finally(() => {
          if (running === controller) running = undefined;
        });
    },
    stop() {
      running?.abort();
    },
    async savedVoices() {
      if (!caches) return [];
      const [files, have] = await Promise.all([planned, caches.open(SPEECH_CACHE).then(savedUrls)]);
      const complete = new Map<string, boolean>();
      for (const file of files) {
        complete.set(file.voice, (complete.get(file.voice) ?? true) && have.has(file.url));
      }
      return [...complete].filter(([, all]) => all).map(([voice]) => voice);
    },
  };
}

/**
 * Without internet, sticks to voices saved for offline (if any), so the game doesn't pick one
 * it can't play.
 */
export async function preferSavedVoices(
  manifest: SpeechManifest | undefined,
  saver: Pick<OfflineSaver, 'savedVoices'>,
): Promise<SpeechManifest | undefined> {
  if (!manifest) return manifest;
  const saved = await saver.savedVoices().catch((): readonly string[] => []);
  const voices = manifest.voices.filter((voice) => saved.includes(voice.id));
  return voices.length > 0 ? { ...manifest, voices } : manifest;
}

function isQuotaError(error: unknown): boolean {
  // Not `instanceof Error`: DOMException isn't one everywhere.
  return (error as { name?: unknown } | undefined)?.name === 'QuotaExceededError';
}

function listenForOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  return () => window.removeEventListener('online', listener);
}

function waitForOnline(
  isOnline: () => boolean,
  onOnline: (listener: () => void) => () => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (settle: () => void) => {
      stopListening();
      signal.removeEventListener('abort', abort);
      settle();
    };
    const abort = () => finish(() => reject(signal.reason as Error));
    const stopListening = onOnline(() => finish(resolve));
    signal.addEventListener('abort', abort);
    if (signal.aborted) abort();
    else if (isOnline()) finish(resolve);
  });
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason as Error);
      },
      { once: true },
    );
  });
}
