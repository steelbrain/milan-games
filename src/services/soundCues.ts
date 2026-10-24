/**
 * The audio cues the games use. Each is a short synthesized jingle (no audio files needed), and
 * each comes in a few variants so the sounds a child hears hundreds of times don't get stale.
 */
export type SoundCue = 'tap' | 'count' | 'correct' | 'tryAgain' | 'reveal' | 'celebrate';

export interface CueOptions {
  /** For 'count': which item this is (1-based). Each count plays the next note up the scale. */
  readonly step?: number;
  /** Which variant to play; see cueVariants. */
  readonly variant?: number;
}

export interface Note {
  readonly frequency: number;
  /** Seconds after the cue starts. */
  readonly start: number;
  readonly duration: number;
  readonly wave: OscillatorType;
  /** Peak gain, 0..1. Kept low; these play next to speech. */
  readonly volume: number;
  /** Optional pitch glide target, for "pop" and "boing" sounds. */
  readonly glideTo?: number;
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const C4 = 60;
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

/** Counting climbs the major scale (do, re, mi...) so the music rises with the number. */
export function countingMidi(step: number): number {
  const index = Math.max(0, Math.floor(step) - 1);
  const octave = Math.floor(index / MAJOR_SCALE.length);
  return C4 + 12 * octave + (MAJOR_SCALE[index % MAJOR_SCALE.length] as number);
}

type NoteStyle = Pick<Note, 'duration' | 'wave' | 'volume'>;

function note(midi: number, start: number, style: NoteStyle, glide?: number): Note {
  const frequency = midiToFrequency(midi);
  return glide === undefined
    ? { frequency, start, ...style }
    : { frequency, start, ...style, glideTo: frequency * glide };
}

function melody(midis: readonly number[], gap: number, style: NoteStyle): Note[] {
  return midis.map((midi, i) => note(midi, i * gap, style));
}

const BLIP: NoteStyle = { duration: 0.08, wave: 'sine', volume: 0.2 };
const POP: NoteStyle = { duration: 0.18, wave: 'triangle', volume: 0.3 };
const BRIGHT: NoteStyle = { duration: 0.22, wave: 'triangle', volume: 0.25 };
const SOFT: NoteStyle = { duration: 0.2, wave: 'sine', volume: 0.2 };
const SPARKLE: NoteStyle = { duration: 0.12, wave: 'sine', volume: 0.15 };
const HORN: NoteStyle = { duration: 0.12, wave: 'triangle', volume: 0.25 };

const long = (style: NoteStyle, duration: number): NoteStyle => ({ ...style, duration });

type Variant = (step: number) => Note[];

const VARIANTS: Record<SoundCue, readonly Variant[]> = {
  tap: [
    () => [note(74, 0, BLIP)],
    () => [note(76, 0, BLIP)],
    () => [note(79, 0, BLIP)],
    () => melody([72, 79], 0.05, long(BLIP, 0.05)),
  ],
  // Every variant keeps the scale note for the step, so the climbing tune is never lost.
  count: [
    // A bouncy pop.
    (step) => [note(countingMidi(step), 0, POP, 1.06)],
    // A little bell: the note plus a quiet octave on top.
    (step) => [
      note(countingMidi(step), 0, { ...POP, wave: 'sine', volume: 0.26 }),
      note(countingMidi(step) + 12, 0, { duration: 0.22, wave: 'sine', volume: 0.07 }),
    ],
    // A "bloop": a quick grace note sliding up into the scale note.
    (step) => [
      note(countingMidi(step) - 5, 0, { duration: 0.05, wave: 'triangle', volume: 0.15 }),
      note(countingMidi(step), 0.04, { ...POP, duration: 0.16 }, 1.03),
    ],
  ],
  correct: [
    () => melody([72, 76, 79, 84], 0.09, BRIGHT),
    () => melody([67, 72, 76, 79], 0.09, BRIGHT),
    () => melody([72, 74, 76, 79, 84], 0.07, long(BRIGHT, 0.18)),
    () => melody([65, 69, 72, 77], 0.09, BRIGHT),
    () => [...melody([76, 79, 84], 0.08, BRIGHT), note(88, 0.26, SPARKLE)],
  ],
  // Soft notes going down. Gentle "hmm, not quite" sounds, never a buzzer.
  tryAgain: [
    () => melody([64, 60], 0.16, SOFT),
    () => melody([67, 64], 0.16, SOFT),
    () => melody([69, 65], 0.18, SOFT),
    () => [note(62, 0, long(SOFT, 0.35), 0.92)],
  ],
  reveal: [
    () => melody([84, 86, 88, 91, 93], 0.05, SPARKLE),
    () => melody([79, 84, 88, 91, 96], 0.05, SPARKLE),
    () => melody([93, 91, 88, 91, 96], 0.05, SPARKLE),
  ],
  celebrate: [
    // Da-da-da-DAAA, da-DAAA.
    () => [
      ...melody([67, 72, 76], 0.13, HORN),
      note(79, 0.39, long(HORN, 0.35)),
      note(76, 0.78, HORN),
      note(84, 0.91, long(HORN, 0.6)),
    ],
    // Up the arpeggio and a long happy top note.
    () => [...melody([72, 76, 79, 84, 88], 0.1, HORN), note(91, 0.5, long(HORN, 0.7))],
    // Ta-DAAA! with a chord.
    () => [
      note(67, 0, HORN),
      ...[72, 76, 79].map((midi) => note(midi, 0.18, { ...HORN, duration: 0.9, volume: 0.16 })),
      note(84, 0.6, long(SPARKLE, 0.5)),
    ],
  ],
};

export function cueVariants(cue: SoundCue): number {
  return VARIANTS[cue].length;
}

export function cueNotes(cue: SoundCue, { step = 1, variant = 0 }: CueOptions = {}): Note[] {
  const variants = VARIANTS[cue];
  const index = ((Math.floor(variant) % variants.length) + variants.length) % variants.length;
  return (variants[index] as Variant)(step);
}
