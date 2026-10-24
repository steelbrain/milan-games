import { describe, expect, it, vi } from 'vitest';
import { line } from '../content/line';
import { chooseVoice, createWebSpeechSpeaker, silentSpeaker } from './speech';

function voice(name: string, lang: string, isDefault = false): SpeechSynthesisVoice {
  return { name, lang, default: isDefault, localService: true, voiceURI: name };
}

class FakeUtterance {
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
}

function fakeSynth(voices: SpeechSynthesisVoice[] = []) {
  const calls: string[] = [];
  const spoken: FakeUtterance[] = [];
  const synth = {
    getVoices: () => voices,
    cancel: vi.fn(() => calls.push('cancel')),
    speak: vi.fn((utterance: FakeUtterance) => {
      calls.push('speak');
      spoken.push(utterance);
    }),
  };
  return { synth, calls, spoken };
}

function speakerFor(synth: unknown) {
  return createWebSpeechSpeaker(
    synth as SpeechSynthesis,
    FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
  );
}

describe('chooseVoice', () => {
  it('prefers known friendly voices over list order', () => {
    const voices = [
      voice('Bubbles', 'en-US'),
      voice('Samantha', 'en-US'),
      voice('Thomas', 'fr-FR'),
    ];
    expect(chooseVoice(voices)?.name).toBe('Samantha');
  });

  it('falls back to the default English voice, then the exact locale, then any English', () => {
    expect(chooseVoice([voice('X', 'en-GB'), voice('Y', 'en-AU', true)])?.name).toBe('Y');
    expect(chooseVoice([voice('X', 'en-GB'), voice('Y', 'en-US')])?.name).toBe('Y');
    expect(chooseVoice([voice('X', 'en_GB')])?.name).toBe('X');
  });

  it('returns nothing when there is no English voice', () => {
    expect(chooseVoice([voice('Thomas', 'fr-FR')])).toBeUndefined();
    expect(chooseVoice([])).toBeUndefined();
  });
});

describe('createWebSpeechSpeaker', () => {
  it('cuts off the previous line and speaks the spoken form', () => {
    const { synth, calls, spoken } = fakeSynth([voice('Samantha', 'en-US')]);
    const speaker = speakerFor(synth);
    speaker.say(line('A', 'ay'));
    expect(calls).toEqual(['cancel', 'speak']);
    expect(spoken[0]).toMatchObject({ text: 'ay', lang: 'en-US', rate: 0.9, pitch: 1.1 });
    expect(spoken[0]?.voice?.name).toBe('Samantha');
  });

  it('says several lines as one utterance', () => {
    const { synth, spoken } = fakeSynth();
    speakerFor(synth).say(line('Yes!'), line('A', 'ay'));
    expect(spoken.map((utterance) => utterance.text)).toEqual(['Yes! ay']);
  });

  it('keeps looking for a voice until the list loads', () => {
    const voices: SpeechSynthesisVoice[] = [];
    const { synth, spoken } = fakeSynth(voices);
    const speaker = speakerFor(synth);
    speaker.say(line('one'));
    voices.push(voice('Samantha', 'en-US'));
    speaker.say(line('two'));
    expect(spoken[0]?.voice).toBeNull();
    expect(spoken[1]?.voice?.name).toBe('Samantha');
  });

  it('stops speaking', () => {
    const { synth } = fakeSynth();
    speakerFor(synth).stop();
    expect(synth.cancel).toHaveBeenCalled();
  });

  it('unlocks once with a silent utterance', () => {
    const { synth, spoken } = fakeSynth();
    const speaker = speakerFor(synth);
    speaker.unlock();
    speaker.unlock();
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatchObject({ text: '', volume: 0 });
  });

  it('never throws when the speech engine does', () => {
    const synth = {
      getVoices: () => [],
      cancel: () => {
        throw new Error('broken');
      },
      speak: () => {
        throw new Error('broken');
      },
    };
    const speaker = speakerFor(synth);
    expect(() => speaker.say(line('hi'))).not.toThrow();
    expect(() => speaker.stop()).not.toThrow();
    expect(() => speaker.unlock()).not.toThrow();
  });

  it('is silent where speech is unsupported', () => {
    expect(createWebSpeechSpeaker(undefined, undefined)).toBe(silentSpeaker);
    expect(() => silentSpeaker.say(line('hi'))).not.toThrow();
    expect(() => silentSpeaker.stop()).not.toThrow();
    expect(() => silentSpeaker.unlock()).not.toThrow();
  });
});
