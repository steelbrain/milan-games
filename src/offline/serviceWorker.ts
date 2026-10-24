import { SHELL_CACHE_PREFIX, SPEECH_CACHE } from './cacheNames';

/** One build of the app: everything it needs to start without a network. */
export interface Shell {
  /** Changes whenever any file does, so each build gets its own cache. */
  readonly version: string;
  /** Paths relative to the service worker, such as "index.html" and "assets/index-3f2a.js". */
  readonly files: readonly string[];
}

/** The parts of service worker events used here; the DOM typings don't include them. */
export interface ExtendableEventLike {
  readonly waitUntil: (work: Promise<unknown>) => void;
}

export interface FetchEventLike {
  readonly request: Request;
  readonly respondWith: (response: Promise<Response>) => void;
}

/** The parts of the service worker's global scope used here, so tests can supply a fake. */
export interface WorkerScope {
  readonly location: { readonly href: string };
  readonly caches: CacheStorage;
  readonly clients: { readonly claim: () => Promise<void> };
  readonly skipWaiting: () => Promise<void>;
  readonly fetch: (request: Request) => Promise<Response>;
  readonly addEventListener: {
    (type: 'install' | 'activate', listener: (event: ExtendableEventLike) => void): void;
    (type: 'fetch', listener: (event: FetchEventLike) => void): void;
  };
}

export interface ServiceWorkerOptions {
  /** How long a page load waits for the network before opening the saved copy. */
  readonly networkTimeoutMs?: number;
}

/**
 * Keeps the app working offline. Installing saves this build's files; the page itself always
 * tries the network first, so a new version shows up as soon as it's deployed, and falls back to
 * the saved copy without one. Speech clips come from the "Play offline" download when it has them.
 */
export function installServiceWorker(
  scope: WorkerScope,
  shell: Shell,
  { networkTimeoutMs = 3000 }: ServiceWorkerOptions = {},
): void {
  const shellCache = SHELL_CACHE_PREFIX + shell.version;
  const base = new URL('./', scope.location.href);
  const resolve = (path: string) => new URL(path, base).href;
  const shellUrls = new Set(shell.files.map(resolve));
  const page = resolve('index.html');
  const speech = resolve('speech/');

  // By URL alone: the page asks for scripts and styles in CORS mode, and a server that sends
  // "Vary: Origin" would otherwise make them miss the copies saved without one.
  const saved = (url: string, cacheName: string) =>
    scope.caches.match(url, { cacheName, ignoreVary: true });

  async function cacheFirst(cacheName: string, request: Request): Promise<Response> {
    return (await saved(request.url, cacheName)) ?? scope.fetch(request);
  }

  async function networkFirst(request: Request): Promise<Response> {
    try {
      return await withTimeout(scope.fetch(request), networkTimeoutMs);
    } catch (error) {
      const copy = await saved(page, shellCache);
      if (copy) return copy;
      throw error;
    }
  }

  scope.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        const cache = await scope.caches.open(shellCache);
        // Straight from the server, so nothing stale from the HTTP cache gets saved.
        await cache.addAll([...shellUrls].map((url) => new Request(url, { cache: 'reload' })));
        await scope.skipWaiting();
      })(),
    );
  });

  scope.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const old = (await scope.caches.keys()).filter(
          (name) => name.startsWith(SHELL_CACHE_PREFIX) && name !== shellCache,
        );
        await Promise.all(old.map((name) => scope.caches.delete(name)));
        await scope.clients.claim();
      })(),
    );
  });

  scope.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    if (request.mode === 'navigate') event.respondWith(networkFirst(request));
    else if (shellUrls.has(request.url)) event.respondWith(cacheFirst(shellCache, request));
    else if (request.url.startsWith(speech)) event.respondWith(cacheFirst(SPEECH_CACHE, request));
  });
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No response in ${ms} ms`)), ms);
    void work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
