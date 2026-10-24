import { createOfflineSaver, preferSavedVoices } from '../offline/offlineSaver';
import { registerServiceWorker } from '../offline/registerServiceWorker';
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
  const manifest = loadSpeechManifest(`${speechBaseUrl}manifest.json`);
  const clipUrl = (voice: string, id: string, take: number) =>
    `${speechBaseUrl}${voice}/${clipFileName(id, take)}`;
  // Only production builds have a service worker (see scripts/build/serviceWorker.ts).
  const appSaved = import.meta.env.PROD
    ? registerServiceWorker(`${import.meta.env.BASE_URL}sw.js`)
    : undefined;
  const offline = createOfflineSaver({
    manifest,
    clipUrl,
    caches: appSaved && 'caches' in window ? window.caches : undefined,
    appSaved: appSaved ?? (() => Promise.resolve(false)),
    persist: async () => navigator.storage?.persist?.(),
  });
  return {
    speaker: createClipSpeaker({
      // Without internet, a visit sticks to voices saved for offline.
      manifest: navigator.onLine
        ? manifest
        : manifest.then((available) => preferSavedVoices(available, offline)),
      clipUrl,
      getContext: getAudioContext,
      fallback: createWebSpeechSpeaker(),
    }),
    sounds: createSynthSoundPlayer(getAudioContext),
    random: Math.random,
    now: () => Date.now(),
    store: createWebStore(browserLocalStorage()),
    offline,
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
