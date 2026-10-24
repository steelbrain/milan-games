import { createContext, useContext, useEffect, useEffectEvent } from 'react';
import type { Line } from '../content/line';
import type { CueOptions, SoundCue } from './soundCues';
import type { Speech } from './speech';

/** Speech and sound effects, already respecting the mute switch. */
export interface Audio {
  readonly muted: boolean;
  readonly setMuted: (muted: boolean) => void;
  readonly say: (...lines: Line[]) => Speech;
  readonly play: (cue: SoundCue, options?: CueOptions) => void;
}

export const GameAudioContext = createContext<Audio | null>(null);

export function useAudio(): Audio {
  const audio = useContext(GameAudioContext);
  if (!audio) throw new Error('useAudio must be used inside <AppProviders>');
  return audio;
}

/**
 * Says `line` when the component mounts and whenever the words change. Keyed on the strings,
 * not the object, so re-renders don't repeat it, and not on `say`, which changes with the mute
 * switch: unmuting must not replay a question that has since been answered.
 */
export function useAnnouncement(line: Line | undefined): void {
  const { say } = useAudio();
  const text = line?.text;
  const speech = line?.speech;
  const announce = useEffectEvent((words: Line) => {
    say(words);
  });
  useEffect(() => {
    if (text !== undefined) announce(speech === undefined ? { text } : { text, speech });
  }, [text, speech]);
}
