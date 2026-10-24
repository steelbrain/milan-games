import { createContext, useContext, useEffect } from 'react';
import type { Line } from '../content/line';
import type { CueOptions, SoundCue } from './soundCues';

/** Speech and sound effects, already respecting the mute switch. */
export interface Audio {
  readonly muted: boolean;
  readonly setMuted: (muted: boolean) => void;
  readonly say: (...lines: Line[]) => void;
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
 * not the object, so re-renders don't repeat it.
 */
export function useAnnouncement(line: Line | undefined): void {
  const { say } = useAudio();
  const text = line?.text;
  const speech = line?.speech;
  useEffect(() => {
    if (text !== undefined) say(speech === undefined ? { text } : { text, speech });
  }, [say, text, speech]);
}
