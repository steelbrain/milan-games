import { type Line, spokenText } from '../content/line';

export interface Speaker {
  /**
   * Says the lines one after another, cutting off whatever was being said so rapid taps never
   * queue up.
   */
  readonly say: (...lines: Line[]) => void;
  readonly stop: () => void;
  /** Mobile browsers only allow speech after a user gesture; call this from one. */
  readonly unlock: () => void;
}

export const silentSpeaker: Speaker = {
  say() {},
  stop() {},
  unlock() {},
};

/** Clear, friendly voices that ship with common platforms, best first. */
const PREFERRED_VOICES = [
  'Samantha',
  'Google US English',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Karen',
  'Moira',
  'Tessa',
  'Daniel',
];

/**
 * Picks a voice for `lang`. Some platforms list novelty voices ("Bubbles", "Bad News") under
 * en-US, so known good voices win over list order.
 */
export function chooseVoice(
  voices: readonly SpeechSynthesisVoice[],
  lang = 'en-US',
): SpeechSynthesisVoice | undefined {
  const language = lang.split('-')[0] ?? lang;
  const english = voices.filter((voice) => voice.lang.replace('_', '-').startsWith(language));
  for (const name of PREFERRED_VOICES) {
    const match = english.find((voice) => voice.name.startsWith(name));
    if (match) return match;
  }
  return (
    english.find((voice) => voice.default) ??
    english.find((voice) => voice.lang.replace('_', '-') === lang) ??
    english[0]
  );
}

export interface WebSpeechOptions {
  readonly lang?: string;
  /** Slightly slow and bright reads best for small children. */
  readonly rate?: number;
  readonly pitch?: number;
}

export function createWebSpeechSpeaker(
  synth: SpeechSynthesis | undefined = globalThis.speechSynthesis,
  Utterance: typeof SpeechSynthesisUtterance | undefined = globalThis.SpeechSynthesisUtterance,
  { lang = 'en-US', rate = 0.9, pitch = 1.1 }: WebSpeechOptions = {},
): Speaker {
  if (!synth || !Utterance) return silentSpeaker;

  let voice: SpeechSynthesisVoice | undefined;
  let unlocked = false;

  return {
    say(...lines) {
      try {
        // Voices load asynchronously, so keep looking until one shows up.
        voice ??= chooseVoice(synth.getVoices(), lang);
        synth.cancel();
        const utterance = new Utterance(lines.map(spokenText).join(' '));
        utterance.lang = lang;
        utterance.rate = rate;
        utterance.pitch = pitch;
        if (voice) utterance.voice = voice;
        synth.speak(utterance);
      } catch {
        // Speech is a nicety; a broken speech engine must never break the game.
      }
    },
    stop() {
      try {
        synth.cancel();
      } catch {
        // Ignored, see above.
      }
    },
    unlock() {
      if (unlocked) return;
      unlocked = true;
      try {
        const utterance = new Utterance('');
        utterance.volume = 0;
        synth.speak(utterance);
      } catch {
        // Ignored, see above.
      }
    },
  };
}
