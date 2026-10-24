import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker, type ServiceWorkerHost } from './registerServiceWorker';

function fakeContainer({
  installed = true,
  ready = new Promise<ServiceWorkerRegistration>(() => undefined),
}: { installed?: boolean; ready?: Promise<ServiceWorkerRegistration> } = {}) {
  const registration = {
    active: installed ? {} : null,
    installing: null,
    waiting: null,
    update: vi.fn(() => Promise.resolve()),
  };
  const container = {
    register: vi.fn(() => Promise.resolve(registration as unknown as ServiceWorkerRegistration)),
    ready,
  } satisfies ServiceWorkerHost;
  return { container, registration };
}

const done = Promise.resolve({} as ServiceWorkerRegistration);

describe('registerServiceWorker', () => {
  it('does nothing where service workers are unavailable', () => {
    expect(registerServiceWorker('./sw.js', { container: undefined })).toBeUndefined();
  });

  it('registers once the page has loaded', async () => {
    let load = () => undefined as void;
    const loaded = new Promise<void>((resolve) => (load = resolve));
    const { container } = fakeContainer({ ready: done });
    const appSaved = registerServiceWorker('./sw.js', { container, loaded });

    await Promise.resolve();
    expect(container.register).not.toHaveBeenCalled();
    load();
    expect(await appSaved?.()).toBe(true);
    expect(container.register).toHaveBeenCalledWith('./sw.js');
  });

  it('tries the install again if an earlier one failed', async () => {
    const { container, registration } = fakeContainer({ installed: false, ready: done });
    const appSaved = registerServiceWorker('./sw.js', { container, loaded: Promise.resolve() });
    expect(await appSaved?.()).toBe(true);
    expect(registration.update).toHaveBeenCalled();
  });

  it('reports failure when registering fails', async () => {
    const { container } = fakeContainer();
    container.register.mockRejectedValue(new Error('blocked'));
    const appSaved = registerServiceWorker('./sw.js', { container, loaded: Promise.resolve() });
    expect(await appSaved?.()).toBe(false);
  });

  it('gives up waiting for the app to be saved after a while', async () => {
    const { container } = fakeContainer();
    const appSaved = registerServiceWorker('./sw.js', {
      container,
      loaded: Promise.resolve(),
      timeoutMs: 10,
    });
    expect(await appSaved?.()).toBe(false);
  });
});
