import { describe, expect, it } from 'vitest';
import { range } from '../core/random';
import { countingMidi, cueNotes, cueVariants, midiToFrequency, type SoundCue } from './soundCues';

const CUES: SoundCue[] = ['tap', 'count', 'correct', 'tryAgain', 'reveal', 'celebrate'];

const everyVariant = CUES.flatMap((cue) =>
  range(0, cueVariants(cue) - 1).map((variant) => [cue, variant] as const),
);

describe('midiToFrequency', () => {
  it('tunes A4 to 440 Hz and doubles per octave', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(81)).toBeCloseTo(880);
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
  });
});

describe('countingMidi', () => {
  it('climbs the major scale from middle C', () => {
    expect(range(1, 8).map(countingMidi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('keeps rising all the way to 20 without getting shrill', () => {
    const notes = range(1, 20).map(countingMidi);
    notes.slice(1).forEach((note, i) => expect(note).toBeGreaterThan(notes[i] as number));
    expect(midiToFrequency(notes.at(-1) as number)).toBeLessThan(2000);
  });

  it('treats odd steps as the first note', () => {
    expect(countingMidi(0)).toBe(60);
    expect(countingMidi(-3)).toBe(60);
  });
});

describe('cue variants', () => {
  it.each(CUES)('%s has several variants', (cue) => {
    expect(cueVariants(cue)).toBeGreaterThanOrEqual(3);
  });

  it.each(everyVariant)('%s #%i is a short, gentle jingle', (cue, variant) => {
    const notes = cueNotes(cue, { variant, step: 20 });
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      expect(note.start).toBeGreaterThanOrEqual(0);
      expect(note.duration).toBeGreaterThan(0);
      expect(note.start + note.duration).toBeLessThanOrEqual(2);
      expect(note.volume).toBeGreaterThan(0);
      expect(note.volume).toBeLessThanOrEqual(0.3);
      expect(note.frequency).toBeGreaterThan(100);
      expect(note.frequency).toBeLessThan(4000);
    }
  });

  it('are actually different from each other', () => {
    for (const cue of CUES) {
      const sounds = range(0, cueVariants(cue) - 1).map((variant) =>
        JSON.stringify(cueNotes(cue, { variant })),
      );
      expect(new Set(sounds).size).toBe(sounds.length);
    }
  });

  it('wrap around instead of failing for out-of-range variants', () => {
    expect(cueNotes('tap', { variant: cueVariants('tap') })).toEqual(cueNotes('tap'));
    expect(cueNotes('tap', { variant: -1 })).toEqual(
      cueNotes('tap', { variant: cueVariants('tap') - 1 }),
    );
  });
});

describe('counting sounds', () => {
  it('always include the scale note for the count, whatever the variant', () => {
    for (const variant of range(0, cueVariants('count') - 1)) {
      for (const step of range(1, 20)) {
        const frequencies = cueNotes('count', { step, variant }).map((note) => note.frequency);
        expect(frequencies).toContainEqual(midiToFrequency(countingMidi(step)));
      }
    }
  });

  it('start from middle C', () => {
    expect(cueNotes('count')[0]?.frequency).toBeCloseTo(midiToFrequency(60));
  });
});

describe('cue moods', () => {
  it('make "try again" go down and "correct" go up', () => {
    for (const variant of range(0, cueVariants('correct') - 1)) {
      const notes = cueNotes('correct', { variant }).map((note) => note.frequency);
      expect(notes.at(-1)).toBeGreaterThan(notes[0] as number);
    }
    for (const variant of range(0, cueVariants('tryAgain') - 1)) {
      const notes = cueNotes('tryAgain', { variant });
      const first = notes[0];
      const last = notes.at(-1);
      const end = last?.glideTo ?? last?.frequency ?? 0;
      expect(end).toBeLessThan(first?.frequency ?? 0);
    }
  });
});
