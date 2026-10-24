import { type ReactNode, useCallback, useMemo } from 'react';
import type { Line } from '../content/line';
import { type Audio, GameAudioContext } from '../services/audio';
import { type Services, ServicesContext, useServices } from '../services/services';
import type { CueOptions, SoundCue } from '../services/soundCues';
import { NO_SPEECH } from '../services/speech';
import { usePersistentState } from '../services/usePersistentState';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

function AudioProvider({ children }: { children: ReactNode }) {
  const { speaker, sounds } = useServices();
  const [muted, storeMuted] = usePersistentState('muted', false, isBoolean);

  const setMuted = useCallback(
    (next: boolean) => {
      if (next) speaker.stop();
      storeMuted(next);
    },
    [speaker, storeMuted],
  );

  const audio = useMemo<Audio>(
    () => ({
      muted,
      setMuted,
      say: (...lines: Line[]) => (muted ? NO_SPEECH : speaker.say(...lines)),
      play: (cue: SoundCue, options?: CueOptions) => {
        if (!muted) sounds.play(cue, options);
      },
    }),
    [muted, setMuted, speaker, sounds],
  );

  return <GameAudioContext value={audio}>{children}</GameAudioContext>;
}

export function AppProviders({ services, children }: { services: Services; children: ReactNode }) {
  return (
    <ServicesContext value={services}>
      <AudioProvider>{children}</AudioProvider>
    </ServicesContext>
  );
}
