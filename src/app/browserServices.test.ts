import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordingSoundPlayer, RecordingSpeaker } from '../test/fakes';
import { createBrowserServices, unlockAudioOnFirstGesture } from './browserServices';

describe('unlockAudioOnFirstGesture', () => {
  it('unlocks speech and sound on the first gesture only', () => {
    const target = new EventTarget();
    const speaker = new RecordingSpeaker();
    const sounds = new RecordingSoundPlayer();
    unlockAudioOnFirstGesture(target, { speaker, sounds });

    target.dispatchEvent(new Event('pointerup'));
    target.dispatchEvent(new Event('click'));
    target.dispatchEvent(new Event('keydown'));

    expect(speaker.unlocks).toBe(1);
    expect(sounds.unlocks).toBe(1);
  });

  it('can be cancelled before any gesture', () => {
    const target = new EventTarget();
    const speaker = new RecordingSpeaker();
    const sounds = new RecordingSoundPlayer();
    const stop = unlockAudioOnFirstGesture(target, { speaker, sounds });
    stop();
    target.dispatchEvent(new Event('touchend'));
    expect(speaker.unlocks).toBe(0);
  });
});

describe('createBrowserServices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds working services even where audio APIs and recordings are missing', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    const services = createBrowserServices();
    expect(() => services.speaker.say({ text: 'hi' })).not.toThrow();
    expect(() => services.sounds.play('tap')).not.toThrow();
    const value = services.random();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    services.store.write('probe', 1);
    expect(services.store.read('probe')).toBe(1);
    // Only production builds can save the app for offline use.
    expect(services.offline.status().phase).toBe('unsupported');
  });
});
