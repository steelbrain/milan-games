import { createNoRepeatPicker, type Random } from '../core/random';
import { type CueOptions, cueNotes, cueVariants, type Note, type SoundCue } from './soundCues';

export interface SoundPlayer {
  readonly play: (cue: SoundCue, options?: CueOptions) => void;
  /** Browsers start audio suspended until a user gesture; call this from one. */
  readonly unlock: () => void;
}

/** The parts of the Web Audio API the synth needs, so tests can supply a fake. */
export type SynthAudioContext = Pick<
  AudioContext,
  'currentTime' | 'destination' | 'createOscillator' | 'createGain'
>;

const SILENCE = 0.0001; // Exponential ramps cannot reach 0.

function scheduleNote(context: SynthAudioContext, note: Note, startAt: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const begin = startAt + note.start;
  const end = begin + note.duration;

  oscillator.type = note.wave;
  oscillator.frequency.setValueAtTime(note.frequency, begin);
  if (note.glideTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(note.glideTo, end);
  }
  // Quick attack, smooth decay: no clicks.
  gain.gain.setValueAtTime(SILENCE, begin);
  gain.gain.exponentialRampToValueAtTime(note.volume, begin + 0.015);
  gain.gain.exponentialRampToValueAtTime(SILENCE, end);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(begin);
  oscillator.stop(end + 0.05);
}

/**
 * Plays the cues with oscillators, on the shared audio context. Each play picks a random variant
 * of the cue, never the same one twice in a row.
 */
export function createSynthSoundPlayer(
  getContext: () => SynthAudioContext | undefined,
  random: Random = Math.random,
): SoundPlayer {
  const pickVariant = createNoRepeatPicker<SoundCue>(random);

  return {
    unlock() {
      getContext();
    },
    play(cue, options) {
      try {
        const context = getContext();
        if (!context) return;
        const variant = options?.variant ?? pickVariant(cue, cueVariants(cue));
        for (const note of cueNotes(cue, { ...options, variant })) {
          scheduleNote(context, note, context.currentTime);
        }
      } catch {
        // Sound effects are a nicety; never let them break the game.
      }
    },
  };
}
