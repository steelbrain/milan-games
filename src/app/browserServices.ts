import { createAudioContextGetter } from '../services/audioContext';
import { createClipSpeaker } from '../services/clipSpeaker';
import type { Services } from '../services/services';
import { createSynthSoundPlayer } from '../services/sounds';
import { createWebSpeechSpeaker } from '../services/speech';
import { browserLocalStorage, createWebStore } from '../services/storage';
import { clipFileName } from '../speech/clipId';
import { loadSpeechManifest } from '../speech/manifest';

export function createBrowserServices(
  speechBaseUrl = `${import.meta.env.BASE_URL}speech/`,
): Services {
  const getAudioContext = createAudioContextGetter();
  return {
    speaker: createClipSpeaker({
      manifest: loadSpeechManifest(`${speechBaseUrl}manifest.json`),
      clipUrl: (voice, id, take) => `${speechBaseUrl}${voice}/${clipFileName(id, take)}`,
      getContext: getAudioContext,
      fallback: createWebSpeechSpeaker(),
    }),
    sounds: createSynthSoundPlayer(getAudioContext),
    random: Math.random,
    store: createWebStore(browserLocalStorage()),
  };
}

const GESTURES = ['pointerup', 'touchend', 'keydown', 'click'] as const;

/**
 * Browsers (iOS Safari especially) keep audio and speech locked until the first user gesture.
 * Unlock both on the very first tap or key press, before any game code needs them.
 */
export function unlockAudioOnFirstGesture(
  target: EventTarget,
  { speaker, sounds }: Pick<Services, 'speaker' | 'sounds'>,
): () => void {
  const unlock = () => {
    speaker.unlock();
    sounds.unlock();
    stop();
  };
  const stop = () => {
    for (const type of GESTURES) target.removeEventListener(type, unlock, true);
  };
  for (const type of GESTURES) target.addEventListener(type, unlock, true);
  return stop;
}
