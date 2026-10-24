import type { Store } from '../services/storage';
import type { SpeechManifest } from '../speech/manifest';
import { SPEECH_CACHE } from './cacheNames';

export type OfflinePhase =
  /** This browser can't keep the app offline (no service worker or Cache Storage). */
  | 'unsupported'
  /** Looking at what is already saved. */
  | 'checking'
  /** Not fully saved, and not downloading right now. */
  | 'idle'
  /** Everything was saved once, but the app has changed since and has new recordings. */
  | 'outdated'
  | 'downloading'
  /** Downloading, but the device is offline; it carries on when the connection comes back. */
  | 'waiting'
  | 'saved'
  /** Deleting the saved recordings. */
  | 'removing'
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
  /**
   * For useSyncExternalStore. The first subscriber triggers a look at what is saved, which also
   * clears out recordings the app no longer uses and, for a saved copy, fetches small updates.
   */
  readonly subscribe: (listener: () => void) => () => void;
  /** Downloads whatever is missing, or updates a saved copy. Safe to call again to retry. */
  readonly start: () => void;
  /** Pauses; what's saved stays saved. */
  readonly stop: () => void;
  /** Deletes every saved recording, stopping any download first. The app itself stays saved. */
  readonly remove: () => Promise<void>;
  /** Voices with every take saved, so a visit without internet can stick to them. */
  readonly savedVoices: () => Promise<readonly string[]>;
}

export interface OfflineSaverOptions {
  readonly manifest: Promise<SpeechManifest | undefined>;
  readonly clipUrl: (voice: string, id: string, take: number, version?: string) => string;
  /** Undefined where the app can't work offline. */
  readonly caches: CacheStorage | undefined;
  /** Resolves once the service worker has saved the app itself; false if that failed. */
  readonly appSaved: () => Promise<boolean>;
  /** Remembers that everything was saved once, so what's missing later is an update. */
  readonly store: Store;
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
  /** Updates of up to this many files download by themselves when the app opens online. */
  readonly autoUpdateFiles?: number;
}

interface PlannedFile {
  readonly voice: string;
  readonly url: string;
}

/** A download or a removal. Only one runs at a time, and it reports its own progress. */
interface Task {
  readonly controller: AbortController;
  readonly done: Promise<void>;
}

/** Store key: true once every recording has been saved, until they are removed. */
const SAVED_ONCE = 'offline-saved';

export function percentSaved({ saved, total }: OfflineStatus): number {
  return total > 0 ? Math.floor((saved * 100) / total) : 0;
}

/** Waits 1 s, 2 s, 4 s… between tries of one file, up to 15 s. */
export const retryDelay = (failures: number): number =>
  Math.min(1000 * 2 ** (failures - 1), 15_000);

export function createOfflineSaver({
  manifest,
  clipUrl,
  caches,
  appSaved,
  store,
  fetch: fetchFile = (url, init) => fetch(url, init),
  resolveUrl = (url) => new URL(url, document.baseURI).href,
  isOnline = () => navigator.onLine,
  onOnline = listenForOnline,
  persist,
  sleep = abortableSleep,
  concurrency = 8,
  attempts = 5,
  // About 3 MB: a few new lines' worth, small enough not to matter on a phone's data plan.
  autoUpdateFiles = 500,
}: OfflineSaverOptions): OfflineSaver {
  const listeners = new Set<() => void>();
  let current: OfflineStatus = { phase: caches ? 'checking' : 'unsupported', saved: 0, total: 0 };
  let checked = false;
  let running: Task | undefined;
  // Bumped by every download and removal, so a slow look at the cache can't report a stale count.
  let changes = 0;

  // Every take of every line in every voice, one voice after another, so an interrupted
  // download still leaves whole voices to play offline.
  // Rejects without a manifest: an empty plan would look "saved" and delete every saved clip.
  const planned: Promise<readonly PlannedFile[]> = manifest.then((available) => {
    const files = (available?.voices ?? []).flatMap((voice) =>
      Object.entries(available?.clips ?? {}).flatMap(([id, clip]) =>
        Array.from({ length: clip.takes }, (_, take) => ({
          voice: voice.id,
          url: resolveUrl(clipUrl(voice.id, id, take, clip.version)),
        })),
      ),
    );
    if (files.length === 0) throw new Error('No speech manifest');
    return files;
  });
  // Each use handles the rejection itself.
  planned.catch(() => undefined);

  function set(next: OfflineStatus): void {
    current = next;
    for (const listener of listeners) listener();
  }

  const savedOnce = () => store.read(SAVED_ONCE) === true;

  function setSaved(total: number): void {
    store.write(SAVED_ONCE, true);
    set({ phase: 'saved', saved: total, total });
  }

  /** Not everything is saved: either an update to a saved copy, or a download yet to finish. */
  function setMissing(saved: number, total: number): void {
    set({ phase: savedOnce() ? 'outdated' : 'idle', saved, total });
  }

  async function savedUrls(cache: Cache): Promise<Set<string>> {
    return new Set((await cache.keys()).map((request) => request.url));
  }

  /**
   * Deletes saved recordings the app no longer uses (left over from older versions, they'd only
   * take up space) and returns what is left.
   */
  async function tidy(cache: Cache, files: readonly PlannedFile[]): Promise<Set<string>> {
    const wanted = new Set(files.map((file) => file.url));
    const keys = await cache.keys();
    await Promise.all(keys.filter((key) => !wanted.has(key.url)).map((key) => cache.delete(key)));
    return new Set(keys.map((key) => key.url).filter((url) => wanted.has(url)));
  }

  async function check(cacheStorage: CacheStorage): Promise<void> {
    const before = changes;
    // A download or removal that started meanwhile reports its own progress.
    const unchanged = () => !running && changes === before;
    try {
      const files = await planned;
      const have = await tidy(await cacheStorage.open(SPEECH_CACHE), files);
      const missing = files.filter((file) => !have.has(file.url)).length;
      const complete = missing === 0 && (await appSaved());
      if (!unchanged()) return;
      if (complete) setSaved(files.length);
      // Keeps a saved copy in step with the app, as long as that's quick and cheap.
      else if (savedOnce() && missing <= autoUpdateFiles && isOnline()) start();
      else setMissing(files.length - missing, files.length);
    } catch {
      if (unchanged()) set({ phase: 'idle', saved: 0, total: 0 });
    }
  }

  async function download(cacheStorage: CacheStorage, signal: AbortSignal): Promise<void> {
    const files = await planned;
    const total = files.length;
    set({ phase: 'checking', saved: current.saved, total });
    void persist?.().catch(() => undefined);

    const cache = await cacheStorage.open(SPEECH_CACHE);
    const have = await tidy(cache, files);
    const missing = files.filter((file) => !have.has(file.url)).map((file) => file.url);

    let saved = total - missing.length;
    let failed = 0;
    // Files given up on with no success in between. A dead connection that the browser still
    // calls "online" fails every file, so stop rather than grind through thousands of them.
    let failedInARow = 0;
    const giveUpAfter = Math.max(3, concurrency);
    let waiting = 0;
    let full = false;
    let next = 0;
    let shown = '';
    const report = () => {
      const phase = waiting > 0 ? 'waiting' : 'downloading';
      // Once per percent is plenty for a progress bar, and spares thousands of re-renders.
      const progress = `${phase} ${percentSaved({ phase, saved, total })}`;
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
      while (next < missing.length && !signal.aborted && !full && failedInARow < giveUpAfter) {
        const url = missing[next++] as string;
        try {
          await saveOne(url);
          saved++;
          failedInARow = 0;
        } catch (error) {
          if (isQuotaError(error)) full = true;
          else if (!signal.aborted) {
            failed++;
            failedInARow++;
          }
        }
        report();
      }
    }

    report();
    await Promise.all(Array.from({ length: concurrency }, worker));

    if (signal.aborted) setMissing(saved, total);
    else if (full) set({ phase: 'failed', problem: 'space', saved, total });
    else if (failed > 0 || !(await appSaved()))
      set({ phase: 'failed', problem: 'network', saved, total });
    else setSaved(total);
  }

  /** Runs `work` as the one current task. */
  function run(work: (signal: AbortSignal) => Promise<void>): Promise<void> {
    changes++;
    const controller = new AbortController();
    const task: Task = {
      controller,
      done: work(controller.signal).finally(() => {
        if (running === task) running = undefined;
      }),
    };
    running = task;
    return task.done;
  }

  function start(): void {
    if (!caches || running) return;
    checked = true;
    void run((signal) =>
      download(caches, signal).catch((error: unknown) => {
        const problem = isQuotaError(error) ? 'space' : 'network';
        set({ phase: 'failed', problem, saved: current.saved, total: current.total });
      }),
    );
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
    start,
    stop() {
      running?.controller.abort();
    },
    remove() {
      if (!caches) return Promise.resolve();
      const previous = running;
      previous?.controller.abort();
      return run(async () => {
        // Let a stopped download settle first, so it can't save anything after this.
        await previous?.done;
        store.write(SAVED_ONCE, false);
        set({ phase: 'removing', saved: current.saved, total: current.total });
        // Should that fail, the next visit's look at the cache counts what's still there.
        await caches.delete(SPEECH_CACHE).catch(() => false);
        set({ phase: 'idle', saved: 0, total: current.total });
      });
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
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason as Error);
    };
    // Removed once the time is up, so retries don't pile up listeners on a long download.
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
