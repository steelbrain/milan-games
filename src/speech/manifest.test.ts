import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSpeechManifest, loadSpeechManifest } from './manifest';

const valid = {
  voices: [{ id: 'katie', name: 'Katie' }],
  clips: { abc: { words: 'Yes!', takes: 3 } },
};

describe('isSpeechManifest', () => {
  it('accepts a well-formed manifest', () => {
    expect(isSpeechManifest(valid)).toBe(true);
    expect(isSpeechManifest({ voices: [], clips: {} })).toBe(true);
  });

  it.each([
    null,
    'manifest',
    { clips: {} },
    { voices: [] },
    { voices: 'katie', clips: {} },
    { voices: [{ id: 'katie' }], clips: {} },
    { voices: [], clips: null },
    { voices: [], clips: { abc: 'Yes!' } },
    { voices: [], clips: { abc: { words: 'Yes!', takes: 0 } } },
    { voices: [], clips: { abc: { words: 'Yes!', takes: 1.5 } } },
    { voices: [], clips: { abc: { takes: 1 } } },
  ])('rejects %j', (value) => {
    expect(isSpeechManifest(value)).toBe(false);
  });
});

describe('loadSpeechManifest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a manifest', async () => {
    await expect(loadSpeechManifest('m.json', () => Promise.resolve(valid))).resolves.toEqual(
      valid,
    );
  });

  it('resolves to undefined for broken or missing manifests', async () => {
    await expect(loadSpeechManifest('m.json', () => Promise.resolve({}))).resolves.toBeUndefined();
    await expect(
      loadSpeechManifest('m.json', () => Promise.reject(new Error('offline'))),
    ).resolves.toBeUndefined();
  });

  it('fetches over HTTP by default', async () => {
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url === 'good.json'
          ? new Response(JSON.stringify(valid))
          : new Response('nope', { status: 404 }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(loadSpeechManifest('good.json')).resolves.toEqual(valid);
    await expect(loadSpeechManifest('missing.json')).resolves.toBeUndefined();
  });
});
