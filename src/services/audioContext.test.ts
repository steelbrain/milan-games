import { describe, expect, it, vi } from 'vitest';
import { createAudioContextGetter, type ResumableAudioContext } from './audioContext';

function fakeContext(state: AudioContextState = 'running') {
  return { state, resume: vi.fn(() => Promise.resolve()) } satisfies ResumableAudioContext;
}

describe('createAudioContextGetter', () => {
  it('creates one context lazily and shares it', () => {
    const context = fakeContext();
    const create = vi.fn(() => context);
    const get = createAudioContextGetter(create, {});
    expect(create).not.toHaveBeenCalled();
    expect(get()).toBe(context);
    expect(get()).toBe(context);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('resumes a suspended context every time it is asked for', () => {
    const context = fakeContext('suspended');
    const get = createAudioContextGetter(() => context, {});
    get();
    get();
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it('ignores a failed resume', async () => {
    const context = fakeContext('suspended');
    context.resume.mockImplementation(() => Promise.reject(new Error('not allowed')));
    const get = createAudioContextGetter(() => context, {});
    expect(get()).toBe(context);
    await Promise.resolve();
  });

  it('asks iOS to keep playing when the ring switch is on silent', () => {
    const nav = { audioSession: { type: 'auto' } };
    createAudioContextGetter(() => fakeContext(), nav)();
    expect(nav.audioSession.type).toBe('playback');
  });

  it('copes with browsers without an audio session', () => {
    const nav = {
      get audioSession(): { type: string } {
        throw new Error('nope');
      },
    };
    expect(createAudioContextGetter(() => fakeContext(), nav)()).toBeDefined();
  });

  it('gives up quietly when Web Audio is missing or broken', () => {
    expect(createAudioContextGetter(() => undefined, {})()).toBeUndefined();
    const create = vi.fn((): ResumableAudioContext => {
      throw new Error('too many contexts');
    });
    const get = createAudioContextGetter(create, {});
    expect(get()).toBeUndefined();
    expect(get()).toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('uses the browser AudioContext by default', () => {
    // jsdom has no Web Audio, so the default factory reports none.
    expect(createAudioContextGetter()()).toBeUndefined();
  });
});
