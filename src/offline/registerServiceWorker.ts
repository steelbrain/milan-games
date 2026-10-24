export type ServiceWorkerHost = Pick<ServiceWorkerContainer, 'register' | 'ready'>;

export interface RegisterOptions {
  /** Undefined where service workers aren't available (old browsers, or plain http). */
  readonly container?: ServiceWorkerHost | undefined;
  /** Registration waits for this, so saving the app doesn't slow down the first visit. */
  readonly loaded?: Promise<unknown>;
  /** How long to wait for the app to be saved before calling it a failure. */
  readonly timeoutMs?: number;
}

/**
 * Registers the service worker that keeps the app working offline. Returns a check that
 * resolves to true once the app itself is saved, or undefined if this browser can't do it.
 */
export function registerServiceWorker(
  url: string,
  {
    container = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    loaded = pageLoaded(),
    timeoutMs = 60_000,
  }: RegisterOptions = {},
): (() => Promise<boolean>) | undefined {
  if (!container) return undefined;
  const registration = loaded.then(() => container.register(url));
  // A failed registration is reported by the check below.
  registration.catch(() => undefined);

  return async () => {
    try {
      const current = await registration;
      // An install that failed, say on a first visit that lost its connection, gets another go.
      if (!current.active && !current.installing && !current.waiting) await current.update();
      return await Promise.race([
        container.ready.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);
    } catch {
      return false;
    }
  };
}

function pageLoaded(): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
}
