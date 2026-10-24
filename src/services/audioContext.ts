/** The parts of an AudioContext needed to wake it up. */
export type ResumableAudioContext = Pick<AudioContext, 'state' | 'resume'>;

interface AudioSessionNavigator {
  audioSession?: { type: string };
}

/**
 * One shared, lazily created AudioContext for speech clips and sound effects. Each call also
 * resumes it if the browser suspended it, which is how audio gets unlocked by a first tap.
 */
export function createAudioContextGetter<T extends ResumableAudioContext = AudioContext>(
  create: () => T | undefined = createBrowserAudioContext as () => T | undefined,
  nav: AudioSessionNavigator | undefined = globalThis.navigator as
    AudioSessionNavigator | undefined,
): () => T | undefined {
  let context: T | undefined;
  let failed = false;
  return () => {
    if (!context && !failed) {
      try {
        context = create();
        preferPlaybackSession(nav);
      } catch {
        failed = true;
      }
    }
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
    return context;
  };
}

function createBrowserAudioContext(): AudioContext | undefined {
  return typeof AudioContext === 'undefined' ? undefined : new AudioContext();
}

/**
 * iOS silences Web Audio when the ring switch is on silent, which is easy to miss on a family
 * iPad. Asking for a "playback" session keeps the games audible, like a video would be.
 */
function preferPlaybackSession(nav: AudioSessionNavigator | undefined): void {
  try {
    if (nav?.audioSession) nav.audioSession.type = 'playback';
  } catch {
    // Not supported; nothing to do.
  }
}
