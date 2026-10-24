import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpeechManifest } from '../speech/manifest';
import { FakeCacheStorage } from '../test/fakeCaches';
import {
  createOfflineSaver,
  type OfflinePhase,
  type OfflineSaverOptions,
  preferSavedVoices,
  retryDelay,
} from './offlineSaver';

const BASE = 'https://games.test/';

const MANIFEST: SpeechManifest = {
  voices: [
    { id: 'katie', name: 'Katie' },
    { id: 'lulu', name: 'Lulu' },
  ],
  clips: {
    aaa: { words: 'Yes!', takes: 2 },
    bbb: { words: 'Hooray!', takes: 1 },
  },
};

const fileUrl = (voice: string, id: string, take: number) =>
  `${BASE}speech/${voice}/${id}-${take}.m4a`;
const KATIE = [fileUrl('katie', 'aaa', 0), fileUrl('katie', 'aaa', 1), fileUrl('katie', 'bbb', 0)];
const LULU = [fileUrl('lulu', 'aaa', 0), fileUrl('lulu', 'aaa', 1), fileUrl('lulu', 'bbb', 0)];
const ALL = [...KATIE, ...LULU];

type Network = (url: string, signal: AbortSignal) => Promise<Response>;
const working: Network = (url) => Promise.resolve(new Response(`clip ${url}`));

function setup({
  network = working,
  online = true,
  manifest = MANIFEST,
  ...options
}: { network?: Network; online?: boolean; manifest?: SpeechManifest } & Partial<
  Pick<OfflineSaverOptions, 'appSaved' | 'concurrency' | 'attempts' | 'persist'>
> = {}) {
  const caches = new FakeCacheStorage();
  const connection = { online, listeners: new Set<() => void>() };
  const sleeps: number[] = [];
  const fetch = vi.fn((url: string, { signal }: { signal: AbortSignal }) => network(url, signal));
  const saver = createOfflineSaver({
    manifest: Promise.resolve(manifest),
    clipUrl: (voice, id, take) => `speech/${voice}/${id}-${take}.m4a`,
    caches: caches.asCacheStorage,
    appSaved: () => Promise.resolve(true),
    fetch,
    resolveUrl: (url) => new URL(url, BASE).href,
    isOnline: () => connection.online,
    onOnline: (listener) => {
      connection.listeners.add(listener);
      return () => connection.listeners.delete(listener);
    },
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    concurrency: 2,
    attempts: 3,
    ...options,
  });
  const updates: OfflinePhase[] = [];
  saver.subscribe(() => updates.push(saver.status().phase));

  return {
    saver,
    caches,
    speech: caches.cache('speech'),
    fetch,
    sleeps,
    updates,
    goOffline: () => (connection.online = false),
    goOnline: () => {
      connection.online = true;
      for (const listener of [...connection.listeners]) listener();
    },
    reaches: async (phase: OfflinePhase) => {
      await vi.waitFor(() => expect(saver.status().phase).toBe(phase));
      return saver.status();
    },
  };
}

const fetchedUrls = (fetch: { mock: { calls: [string, unknown][] } }) =>
  fetch.mock.calls.map(([url]) => url);

describe('createOfflineSaver', () => {
  it("is unsupported where the app can't work offline", async () => {
    const saver = createOfflineSaver({
      manifest: Promise.resolve(MANIFEST),
      clipUrl: () => '',
      caches: undefined,
      appSaved: () => Promise.resolve(false),
    });
    saver.subscribe(() => undefined);
    saver.start();
    expect(saver.status().phase).toBe('unsupported');
    expect(await saver.savedVoices()).toEqual([]);
  });

  it('keeps what is saved when the speech manifest is missing', async () => {
    const { saver, speech, reaches } = setup({ manifest: { voices: [], clips: {} } });
    speech.fill(ALL);
    expect(await reaches('idle')).toEqual({ phase: 'idle', saved: 0, total: 0 });

    saver.start();
    expect((await reaches('failed')).problem).toBe('network');
    expect([...speech.entries.keys()]).toEqual(ALL);
  });

  it('starts by counting what is already saved', async () => {
    const { speech, reaches } = setup();
    speech.fill(ALL.slice(0, 2));
    expect(await reaches('idle')).toEqual({ phase: 'idle', saved: 2, total: 6 });
  });

  it('is saved when every recording and the app itself are', async () => {
    const { speech, reaches } = setup();
    speech.fill(ALL);
    expect(await reaches('saved')).toEqual({ phase: 'saved', saved: 6, total: 6 });
  });

  it('is not saved until the app itself is, even with every recording', async () => {
    const { speech, reaches } = setup({ appSaved: () => Promise.resolve(false) });
    speech.fill(ALL);
    expect((await reaches('idle')).saved).toBe(6);
  });

  it('downloads every take of every line in every voice, one voice at a time', async () => {
    const persist = vi.fn(() => Promise.reject(new Error('not allowed')));
    const { saver, speech, fetch, reaches } = setup({ concurrency: 1, persist });
    saver.start();

    expect(await reaches('saved')).toEqual({ phase: 'saved', saved: 6, total: 6 });
    expect(fetchedUrls(fetch)).toEqual(ALL);
    expect([...speech.entries.keys()]).toEqual(ALL);
    expect(await speech.entries.get(ALL[0] as string)?.text()).toBe(`clip ${ALL[0]}`);
    expect(persist).toHaveBeenCalled();
  });

  it('picks up where it left off, and clears out recordings the app no longer uses', async () => {
    const { saver, speech, fetch, reaches } = setup();
    const stale = `${BASE}speech/old/zzz.m4a`;
    speech.fill([...KATIE, stale]);
    saver.start();

    await reaches('saved');
    expect(fetchedUrls(fetch)).toEqual(LULU);
    expect([...speech.entries.keys()].sort()).toEqual([...ALL].sort());
  });

  it('retries a failing file, waiting longer each time', async () => {
    let failuresLeft = 2;
    const { saver, sleeps, reaches } = setup({
      network: (url, signal) =>
        url === ALL[1] && failuresLeft-- > 0
          ? Promise.resolve(new Response('', { status: 503 }))
          : working(url, signal),
    });
    saver.start();

    expect((await reaches('saved')).saved).toBe(6);
    expect(sleeps).toEqual([1000, 2000]);
  });

  it('gives up on a file after a few tries but saves the rest, then can try again', async () => {
    let broken = true;
    const { saver, fetch, reaches } = setup({
      network: (url, signal) =>
        broken && url === ALL[4]
          ? Promise.reject(new TypeError('Load failed'))
          : working(url, signal),
    });
    saver.start();

    expect(await reaches('failed')).toEqual({
      phase: 'failed',
      problem: 'network',
      saved: 5,
      total: 6,
    });
    expect(fetchedUrls(fetch).filter((url) => url === ALL[4])).toHaveLength(3);

    broken = false;
    fetch.mockClear();
    saver.start();
    expect((await reaches('saved')).saved).toBe(6);
    expect(fetchedUrls(fetch)).toEqual([ALL[4]]);
  });

  it('stops when the device runs out of space', async () => {
    const { saver, speech, fetch, reaches } = setup({ concurrency: 1 });
    speech.putError = new DOMException('Full', 'QuotaExceededError');
    saver.start();

    expect(await reaches('failed')).toEqual({
      phase: 'failed',
      problem: 'space',
      saved: 0,
      total: 6,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('waits for the internet to come back instead of failing', async () => {
    const { saver, fetch, sleeps, goOnline, reaches } = setup({ online: false });
    saver.start();

    expect((await reaches('waiting')).saved).toBe(0);
    expect(fetch).not.toHaveBeenCalled();

    goOnline();
    expect((await reaches('saved')).saved).toBe(6);
    expect(sleeps).toEqual([]);
  });

  it("doesn't count dropping offline mid-download as a failed try", async () => {
    let drop = true;
    const setupResult = setup({
      concurrency: 1,
      attempts: 1,
      network: (url, signal) => {
        if (!drop) return working(url, signal);
        drop = false;
        setupResult.goOffline();
        return Promise.reject(new TypeError('Load failed'));
      },
    });
    const { saver, goOnline, reaches } = setupResult;
    saver.start();

    await reaches('waiting');
    goOnline();
    expect((await reaches('saved')).saved).toBe(6);
  });

  it('pauses, keeping what is saved, and resumes later', async () => {
    let hang = true;
    const { saver, fetch, reaches, speech } = setup({
      concurrency: 1,
      network: (url, signal) =>
        hang && url === ALL[2]
          ? new Promise((_, reject) =>
              signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError'))),
            )
          : working(url, signal),
    });
    saver.start();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));

    saver.stop();
    expect(await reaches('idle')).toEqual({ phase: 'idle', saved: 2, total: 6 });
    expect(speech.entries.size).toBe(2);

    hang = false;
    saver.start();
    expect((await reaches('saved')).saved).toBe(6);
  });

  it('pauses while still offline', async () => {
    const { saver, reaches } = setup({ online: false });
    saver.start();
    await reaches('waiting');
    saver.stop();
    expect((await reaches('idle')).saved).toBe(0);
  });

  it('fails if the app itself could not be saved', async () => {
    const { saver, reaches } = setup({ appSaved: () => Promise.resolve(false) });
    saver.start();
    expect((await reaches('failed')).problem).toBe('network');
  });

  it('runs one download at a time', async () => {
    const { saver, fetch, reaches } = setup();
    saver.start();
    saver.start();
    await reaches('saved');
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it('updates the progress about once per percent, not once per file', async () => {
    const manifest = {
      voices: [{ id: 'katie', name: 'Katie' }],
      clips: { aaa: { words: 'Yes!', takes: 1000 } },
    };
    const { saver, updates, reaches } = setup({ manifest, concurrency: 4 });
    saver.start();
    await reaches('saved');
    expect(updates.length).toBeGreaterThan(50);
    expect(updates.length).toBeLessThan(120);
  });

  describe("with the browser's own connection events and timers", () => {
    function browserSaver(network: Network) {
      return createOfflineSaver({
        manifest: Promise.resolve(MANIFEST),
        clipUrl: (voice, id, take) => `speech/${voice}/${id}-${take}.m4a`,
        caches: new FakeCacheStorage().asCacheStorage,
        appSaved: () => Promise.resolve(true),
        fetch: (url, { signal }) => network(url, signal),
        resolveUrl: (url) => new URL(url, BASE).href,
        concurrency: 1,
      });
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('waits for the "online" event, and a second before retrying', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      let failures = 1;
      const saver = browserSaver((url, signal) =>
        failures-- > 0 ? Promise.resolve(new Response('', { status: 500 })) : working(url, signal),
      );
      saver.start();
      await vi.waitFor(() => expect(saver.status().phase).toBe('waiting'));

      onLine.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(1000);
      await vi.waitFor(() => expect(saver.status().phase).toBe('saved'));
    });

    it('can pause while waiting to retry', async () => {
      const network = vi.fn(() => Promise.resolve(new Response('', { status: 500 })));
      const saver = browserSaver(network);
      saver.start();
      await vi.waitFor(() => expect(network).toHaveBeenCalled());

      saver.stop();
      await vi.waitFor(() => expect(saver.status().phase).toBe('idle'));
    });
  });

  it('lists the voices whose every recording is saved', async () => {
    const { saver, speech } = setup();
    speech.fill([...LULU, ...KATIE.slice(1)]);
    expect(await saver.savedVoices()).toEqual(['lulu']);
  });
});

describe('preferSavedVoices', () => {
  it('sticks to the saved voices', async () => {
    const preferred = await preferSavedVoices(MANIFEST, {
      savedVoices: () => Promise.resolve(['lulu']),
    });
    expect(preferred?.voices).toEqual([{ id: 'lulu', name: 'Lulu' }]);
    expect(preferred?.clips).toBe(MANIFEST.clips);
  });

  it('keeps every voice when none is saved, or the cache cannot be read', async () => {
    expect(await preferSavedVoices(MANIFEST, { savedVoices: () => Promise.resolve([]) })).toBe(
      MANIFEST,
    );
    expect(
      await preferSavedVoices(MANIFEST, { savedVoices: () => Promise.reject(new Error()) }),
    ).toBe(MANIFEST);
    expect(
      await preferSavedVoices(undefined, { savedVoices: () => Promise.resolve([]) }),
    ).toBeUndefined();
  });
});

describe('retryDelay', () => {
  it('doubles up to a cap', () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
  });
});
