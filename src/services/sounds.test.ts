import { describe, expect, it, vi } from 'vitest';
import { createSeededRandom } from '../core/random';
import { cueNotes, cueVariants } from './soundCues';
import { createSynthSoundPlayer, type SynthAudioContext } from './sounds';

function fakeParam() {
  return { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}

function fakeContext() {
  const oscillators: {
    type: string;
    frequency: ReturnType<typeof fakeParam>;
    start: ReturnType<typeof vi.fn>;
  }[] = [];
  const raw = {
    currentTime: 10,
    destination: {},
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: 'sine',
        frequency: fakeParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => ({ gain: fakeParam(), connect: vi.fn() })),
  };
  return { context: raw as unknown as SynthAudioContext, raw, oscillators };
}

describe('createSynthSoundPlayer', () => {
  it('schedules one oscillator per note, from the current time', () => {
    const { context, oscillators } = fakeContext();
    createSynthSoundPlayer(() => context).play('correct', { variant: 0 });
    const notes = cueNotes('correct', { variant: 0 });
    expect(oscillators).toHaveLength(notes.length);
    expect(oscillators[0]?.type).toBe('triangle');
    expect(oscillators[0]?.start).toHaveBeenCalledWith(10);
    expect(oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(notes[0]?.frequency, 10);
  });

  it('glides the pitch for counting pops', () => {
    const { context, oscillators } = fakeContext();
    createSynthSoundPlayer(() => context).play('count', { step: 2, variant: 0 });
    expect(oscillators[0]?.frequency.exponentialRampToValueAtTime).toHaveBeenCalled();
  });

  it('plays a different variant each time a cue repeats', () => {
    const { context, oscillators } = fakeContext();
    const player = createSynthSoundPlayer(() => context, createSeededRandom(3));
    const heard: string[] = [];
    for (let i = 0; i < 30; i++) {
      oscillators.length = 0;
      player.play('tap');
      heard.push(
        JSON.stringify(
          oscillators.map((o) => o.frequency.setValueAtTime.mock.calls[0]?.[0] as unknown),
        ),
      );
    }
    heard.slice(1).forEach((sound, i) => expect(sound).not.toBe(heard[i]));
    expect(new Set(heard).size).toBe(cueVariants('tap'));
  });

  it('asks for the shared context on unlock', () => {
    const getContext = vi.fn(() => undefined);
    createSynthSoundPlayer(getContext).unlock();
    expect(getContext).toHaveBeenCalled();
  });

  it('stays quiet without Web Audio', () => {
    expect(() => createSynthSoundPlayer(() => undefined).play('celebrate')).not.toThrow();
  });

  it('never throws when Web Audio does', () => {
    const { context, raw } = fakeContext();
    raw.createOscillator.mockImplementation(() => {
      throw new Error('broken');
    });
    expect(() => createSynthSoundPlayer(() => context).play('tap')).not.toThrow();
    const throwing = () => {
      throw new Error('no audio');
    };
    expect(() => createSynthSoundPlayer(throwing).play('tap')).not.toThrow();
  });
});
