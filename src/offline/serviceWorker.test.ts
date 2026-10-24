import { describe, expect, it, vi } from 'vitest';
import { FakeCacheStorage } from '../test/fakeCaches';
import {
  type ExtendableEventLike,
  type FetchEventLike,
  installServiceWorker,
} from './serviceWorker';

const ORIGIN = 'https://games.test';
const FILES = ['index.html', 'assets/index-abc.js', 'speech/manifest.json'];

type Network = (request: Request) => Promise<Response>;
const online: Network = (request) => Promise.resolve(new Response(`network ${request.url}`));
const offline: Network = () => Promise.reject(new TypeError('Failed to fetch'));

function setup(network: Network = online) {
  const listeners = new Map<string, (event: never) => void>();
  const caches = new FakeCacheStorage((request) => network(request));
  const fetch = vi.fn((request: Request) => network(request));
  const scope = {
    location: { href: `${ORIGIN}/sw.js` },
    caches: caches.asCacheStorage,
    clients: { claim: vi.fn(() => Promise.resolve()) },
    skipWaiting: vi.fn(() => Promise.resolve()),
    fetch,
    addEventListener: (type: string, listener: (event: never) => void) => {
      listeners.set(type, listener);
    },
  };
  installServiceWorker(
    scope,
    { version: 'v2', files: FILES },
    {
      networkTimeoutMs: 20,
    },
  );

  async function lifecycle(type: 'install' | 'activate'): Promise<void> {
    let work: Promise<unknown> = Promise.resolve();
    const event: ExtendableEventLike = {
      waitUntil: (promise) => {
        work = promise;
      },
    };
    listeners.get(type)?.(event as never);
    await work;
  }

  /** What the worker answers for a request, or undefined if it lets the browser handle it. */
  async function request(
    path: string,
    { method = 'GET', mode = 'cors' }: { method?: string; mode?: string } = {},
  ): Promise<string | undefined> {
    let answer: Promise<Response> | undefined;
    const event: FetchEventLike = {
      request: { url: `${ORIGIN}/${path}`, method, mode } as Request,
      respondWith: (response) => {
        answer = response;
      },
    };
    listeners.get('fetch')?.(event as never);
    return answer && (await answer).text();
  }

  return { caches, scope, fetch, lifecycle, request };
}

describe('installServiceWorker', () => {
  it("saves this build's files on install, fresh from the server, and takes over at once", async () => {
    const { caches, scope, lifecycle } = setup();
    await lifecycle('install');

    const shell = caches.cache('shell-v2');
    expect([...shell.entries.keys()]).toEqual(FILES.map((file) => `${ORIGIN}/${file}`));
    expect(shell.added.every((request) => request.cache === 'reload')).toBe(true);
    expect(scope.skipWaiting).toHaveBeenCalled();
  });

  it('deletes older builds when it activates, but keeps the offline speech', async () => {
    const { caches, scope, lifecycle } = setup();
    for (const name of ['shell-v1', 'shell-v2', 'speech']) caches.cache(name);
    await lifecycle('activate');

    expect(await caches.keys()).toEqual(['shell-v2', 'speech']);
    expect(scope.clients.claim).toHaveBeenCalled();
  });

  it('loads the page from the network when it can, so new versions show up right away', async () => {
    const { lifecycle, request } = setup();
    await lifecycle('install');
    expect(await request('', { mode: 'navigate' })).toBe(`network ${ORIGIN}/`);
  });

  it('opens the saved page without a network', async () => {
    let network = online;
    const { lifecycle, request } = setup((r) => network(r));
    await lifecycle('install');

    network = offline;
    expect(await request('', { mode: 'navigate' })).toBe(`network ${ORIGIN}/index.html`);
  });

  it("opens the saved page when the network doesn't answer in time", async () => {
    let network = online;
    const { lifecycle, request } = setup((r) => network(r));
    await lifecycle('install');

    network = () => new Promise(() => undefined);
    expect(await request('', { mode: 'navigate' })).toBe(`network ${ORIGIN}/index.html`);
  });

  it('fails the page load offline before anything is saved', async () => {
    const { request } = setup(offline);
    await expect(request('', { mode: 'navigate' })).rejects.toThrow('Failed to fetch');
  });

  it('waits for a slow network when nothing is saved yet', async () => {
    const { request } = setup(
      (r) => new Promise((resolve) => setTimeout(() => resolve(new Response(`late ${r.url}`)), 50)),
    );
    expect(await request('', { mode: 'navigate' })).toBe(`late ${ORIGIN}/`);
  });

  it('loads files that keep their name across builds from the network first', async () => {
    let network = online;
    const { lifecycle, request } = setup((r) => network(r));
    await lifecycle('install');

    network = (r) => Promise.resolve(new Response(`new ${r.url}`));
    expect(await request('speech/manifest.json')).toBe(`new ${ORIGIN}/speech/manifest.json`);
    network = offline;
    expect(await request('speech/manifest.json')).toBe(`network ${ORIGIN}/speech/manifest.json`);
  });

  it("serves this build's files from the saved copy", async () => {
    const { fetch, lifecycle, request } = setup();
    await lifecycle('install');
    fetch.mockClear();

    expect(await request('assets/index-abc.js')).toBe(`network ${ORIGIN}/assets/index-abc.js`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('plays speech from the offline download, or from the network when it is not saved', async () => {
    const { caches, fetch, request } = setup();
    caches.cache('speech-katie').fill([`${ORIGIN}/speech/katie/a.m4a`]);
    caches.cache('speech').fill([`${ORIGIN}/speech/lulu/a.m4a`]);

    expect(await request('speech/katie/a.m4a')).toBe(`saved ${ORIGIN}/speech/katie/a.m4a`);
    // Saved by an older version, in the one cache it kept for every voice.
    expect(await request('speech/lulu/a.m4a')).toBe(`saved ${ORIGIN}/speech/lulu/a.m4a`);
    expect(fetch).not.toHaveBeenCalled();
    expect(await request('speech/katie/b.m4a')).toBe(`network ${ORIGIN}/speech/katie/b.m4a`);
  });

  it('looks up saved files by URL alone, whatever Vary headers the server sent', async () => {
    const { caches, lifecycle, request } = setup();
    await lifecycle('install');
    const match = vi.spyOn(caches, 'match');

    await request('assets/index-abc.js');
    expect(match).toHaveBeenCalledWith(`${ORIGIN}/assets/index-abc.js`, {
      cacheName: 'shell-v2',
      ignoreVary: true,
    });
  });

  it('leaves other requests to the browser', async () => {
    const { request } = setup();
    expect(await request('elsewhere.json')).toBeUndefined();
    expect(await request('speech/katie/a.m4a', { method: 'POST' })).toBeUndefined();
  });
});
