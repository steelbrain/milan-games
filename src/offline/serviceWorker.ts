import { LEGACY_SPEECH_CACHE, SHELL_CACHE_PREFIX, speechCacheName } from './cacheNames';

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
  // Vite puts a content hash in these names, so a saved copy can never be out of date.
  const hashed = resolve('assets/');

  // By URL alone: the page asks for scripts and styles in CORS mode, and a server that sends
  // "Vary: Origin" would otherwise make them miss the copies saved without one.
  const saved = (url: string, cacheName: string) =>
    scope.caches.match(url, { cacheName, ignoreVary: true });

  async function cacheFirst(cacheName: string, request: Request): Promise<Response> {
    return (await saved(request.url, cacheName)) ?? scope.fetch(request);
  }

  /**
   * A clip from its voice's cache (speech/<voice>/…), or from the one cache older versions kept
   * for every voice, until its download moves; otherwise from the network.
   */
  async function speechFirst(request: Request): Promise<Response> {
    const voice = request.url.slice(speech.length).split('/')[0] ?? '';
    return (
      (await saved(request.url, speechCacheName(voice))) ??
      (await saved(request.url, LEGACY_SPEECH_CACHE)) ??
      scope.fetch(request)
    );
  }

  /** Tries the network, and falls back to the saved `fallbackUrl` if it fails or is slow. */
  async function networkFirst(request: Request, fallbackUrl: string): Promise<Response> {
    const response = scope.fetch(request);
    try {
      return await withTimeout(response, networkTimeoutMs);
    } catch {
      // Without a saved copy, a slow network is still better than none.
      return (await saved(fallbackUrl, shellCache)) ?? response;
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
    if (request.mode === 'navigate') event.respondWith(networkFirst(request, page));
    else if (shellUrls.has(request.url))
      // Files that keep their name across builds, such as speech/manifest.json, must match the
      // page the network just sent, so they too try the network first.
      event.respondWith(
        request.url.startsWith(hashed)
          ? cacheFirst(shellCache, request)
          : networkFirst(request, request.url),
      );
    else if (request.url.startsWith(speech)) event.respondWith(speechFirst(request));
  });
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No response in ${ms} ms`)), ms);
    void work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
