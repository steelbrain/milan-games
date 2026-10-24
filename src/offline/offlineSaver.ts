import type { Store } from '../services/storage';
import type { SpeechManifest } from '../speech/manifest';
import {
  isSpeechCache,
  LEGACY_SPEECH_CACHE,
  SPEECH_CACHE_PREFIX,
  speechCacheName,
} from './cacheNames';

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

/** The planned files grouped by voice, in plan order. */
function byVoice(files: readonly PlannedFile[]): Map<string, PlannedFile[]> {
  const voices = new Map<string, PlannedFile[]>();
  for (const file of files) {
    const list = voices.get(file.voice);
    if (list) list.push(file);
    else voices.set(file.voice, [file]);
  }
  return voices;
}

/** Clips moved at a time from an older version's download; see moveLegacySpeech. */
const MOVE_BATCH = 50;

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
  // Moving an older version's download, which everything reading the saved speech waits for.
  let legacyMove: Promise<void> | undefined;

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

  /** What a voice has saved, without creating a cache for it if it has none. */
  async function savedUrls(cacheStorage: CacheStorage, voice: string): Promise<Set<string>> {
    const name = speechCacheName(voice);
    if (!(await cacheStorage.has(name))) return new Set();
    const keys = await (await cacheStorage.open(name)).keys();
    return new Set(keys.map((request) => request.url));
  }

  /**
   * Moves a download saved by an older version, which kept every voice in one cache, into the
   * per-voice caches, so it doesn't have to be fetched again. It goes by URL, since listing that
   * cache is what fails once it is big, and each clip leaves it as it is copied, so the move
   * needs no extra space. Runs once; everything that reads the saved speech waits for it.
   */
  function moveLegacySpeech(cacheStorage: CacheStorage, files: readonly PlannedFile[]) {
    legacyMove ??= moveLegacy(cacheStorage, files).catch((error: unknown) => {
      // Tried again next time.
      legacyMove = undefined;
      throw error;
    });
    return legacyMove;
  }

  async function moveLegacy(cacheStorage: CacheStorage, files: readonly PlannedFile[]) {
    if (!(await cacheStorage.has(LEGACY_SPEECH_CACHE))) return;
    const legacy = await cacheStorage.open(LEGACY_SPEECH_CACHE);
    try {
      for (const [voice, planned] of byVoice(files)) {
        const cache = await cacheStorage.open(speechCacheName(voice));
        for (let start = 0; start < planned.length; start += MOVE_BATCH) {
          await Promise.all(
            planned.slice(start, start + MOVE_BATCH).map(async ({ url }) => {
              const response = await legacy.match(url);
              if (!response) return;
              await cache.put(url, response);
              await legacy.delete(url);
            }),
          );
        }
      }
    } catch (error) {
      // Out of space even so: keep what has moved, and download the rest again.
      if (!isQuotaError(error)) throw error;
    }
    await cacheStorage.delete(LEGACY_SPEECH_CACHE);
  }

  /**
   * Deletes saved recordings the app no longer uses (left over from older versions, they'd only
   * take up space), including voices it no longer has, and returns what is left.
   */
  async function tidy(
    cacheStorage: CacheStorage,
    files: readonly PlannedFile[],
  ): Promise<Set<string>> {
    await moveLegacySpeech(cacheStorage, files);
    const voices = byVoice(files);
    const names = await cacheStorage.keys();
    const gone = names.filter(
      (name) =>
        name.startsWith(SPEECH_CACHE_PREFIX) && !voices.has(name.slice(SPEECH_CACHE_PREFIX.length)),
    );
    await Promise.all(gone.map((name) => cacheStorage.delete(name)));

    const have = new Set<string>();
    for (const [voice, planned] of voices) {
      const name = speechCacheName(voice);
      // Nothing saved for this voice; opening it would only create an empty cache.
      if (!names.includes(name)) continue;
      const wanted = new Set(planned.map((file) => file.url));
      const cache = await cacheStorage.open(name);
      const keys = await cache.keys();
      await Promise.all(keys.filter((key) => !wanted.has(key.url)).map((key) => cache.delete(key)));
      for (const key of keys) if (wanted.has(key.url)) have.add(key.url);
    }
    return have;
  }

  async function check(cacheStorage: CacheStorage): Promise<void> {
    const before = changes;
    // A download or removal that started meanwhile reports its own progress.
    const unchanged = () => !running && changes === before;
    try {
      const files = await planned;
      const have = await tidy(cacheStorage, files);
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

    const have = await tidy(cacheStorage, files);
    const missing = files.filter((file) => !have.has(file.url));
    const opened = new Map<string, Promise<Cache>>();
    const cacheFor = (voice: string) => {
      let cache = opened.get(voice);
      if (!cache) {
        cache = cacheStorage.open(speechCacheName(voice));
        opened.set(voice, cache);
      }
      return cache;
    };

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

    async function saveOne({ voice, url }: PlannedFile): Promise<void> {
      for (let failures = 0; ;) {
        if (!isOnline()) await untilOnline();
        try {
          const response = await fetchFile(url, { signal });
          if (!response.ok) throw new Error(`${response.status} for ${url}`);
          await (await cacheFor(voice)).put(url, response);
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
        const file = missing[next++] as PlannedFile;
        try {
          await saveOne(file);
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
        // Let a stopped download, or a move of an older one, settle first, so neither can save
        // anything after this.
        await previous?.done;
        await legacyMove?.catch(() => undefined);
        store.write(SAVED_ONCE, false);
        set({ phase: 'removing', saved: current.saved, total: current.total });
        // The caches it knows of, plus any others it finds. Should deleting fail, the next
        // visit's look at the caches counts what's still there.
        const voices = await planned.then(
          (files) => [...byVoice(files).keys()],
          (): string[] => [],
        );
        const listed = await caches.keys().catch((): string[] => []);
        const names = new Set([
          LEGACY_SPEECH_CACHE,
          ...voices.map(speechCacheName),
          ...listed.filter(isSpeechCache),
        ]);
        await Promise.all([...names].map((name) => caches.delete(name).catch(() => false)));
        set({ phase: 'idle', saved: 0, total: current.total });
      });
    },
    async savedVoices() {
      if (!caches) return [];
      const files = await planned;
      // A download saved by an older version counts once it has moved.
      await moveLegacySpeech(caches, files);
      const voices = [...byVoice(files)];
      const complete = await Promise.all(
        voices.map(async ([voice, planned]) => {
          const have = await savedUrls(caches, voice);
          return planned.every((file) => have.has(file.url));
        }),
      );
      return voices.filter((_, i) => complete[i]).map(([voice]) => voice);
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
