import { afterEach, describe, expect, it, vi } from 'vitest';
import { line, type Line } from '../content/line';
import { createSeededRandom } from '../core/random';
import { clipId } from '../speech/clipId';
import type { SpeechManifest } from '../speech/manifest';
import { RecordingSpeaker } from '../test/fakes';
import { type ClipAudioContext, createClipSpeaker } from './clipSpeaker';

const hello = line('Hello');
const there = line('there');
const cheer = line('Yay!');
const unrecorded = line('Not recorded');

const manifest: SpeechManifest = {
  voices: [
    { id: 'katie', name: 'Katie' },
    { id: 'lulu', name: 'Lulu' },
    { id: 'clara', name: 'Clara' },
  ],
  clips: {
    [clipId(hello)]: { words: 'Hello', takes: 1 },
    [clipId(there)]: { words: 'there', takes: 1 },
    [clipId(cheer)]: { words: 'Yay!', takes: 4 },
  },
};

interface FakeSource {
  buffer: { url: string } | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

/** A fake Web Audio context whose "buffers" remember which URL they came from. */
function fakeAudio() {
  const sources: FakeSource[] = [];
  const raw = {
    currentTime: 5,
    destination: {},
    decodeAudioData: vi.fn((data: ArrayBuffer) =>
      Promise.resolve({ duration: 1, url: new TextDecoder().decode(data) }),
    ),
    createBufferSource: vi.fn(() => {
      const source: FakeSource = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      sources.push(source);
      return source;
    }),
  };
  const started = () =>
    sources
      .filter((source) => source.start.mock.calls.length > 0)
      .map((source) => ({
        url: source.buffer?.url,
        at: source.start.mock.calls[0]?.[0] as number,
      }));
  return { context: raw as unknown as ClipAudioContext, raw, sources, started };
}

function setup({
  available = Promise.resolve<SpeechManifest | undefined>(manifest),
  webAudio = true,
  fetchClip = vi.fn((url: string) => Promise.resolve(new TextEncoder().encode(url).buffer)),
  cacheSize,
  seed = 1,
}: {
  available?: Promise<SpeechManifest | undefined>;
  webAudio?: boolean;
  fetchClip?: (url: string) => Promise<ArrayBuffer>;
  cacheSize?: number;
  seed?: number;
} = {}) {
  const audio = webAudio ? fakeAudio() : undefined;
  const fallback = new RecordingSpeaker(false);
  const getContext = vi.fn(() => audio?.context);
  const speaker = createClipSpeaker({
    manifest: available,
    clipUrl: (voice, id, take, version) =>
      `${voice}/${id}#${take}${version ? `?v=${version}` : ''}`,
    getContext,
    fallback,
    fetchClip,
    random: createSeededRandom(seed),
    ...(cacheSize === undefined ? {} : { cacheSize }),
  });
  return { speaker, fallback, audio, fetchClip, getContext };
}

/** The voice a seeded speaker picked, read from the first clip it played. */
const voiceOf = (url: string | undefined) => url?.split('/')[0];
const urlOf = (said: Line, voice: string, take = 0) => `${voice}/${clipId(said)}#${take}`;

describe('createClipSpeaker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays recorded lines back to back, with a short pause between them', async () => {
    const { speaker, audio, fallback } = setup();
    speaker.say(hello, there);
    await vi.waitFor(() => expect(audio?.started()).toHaveLength(2));
    const voice = voiceOf(audio?.started()[0]?.url) ?? '';
    expect(audio?.started()).toEqual([
      { url: urlOf(hello, voice), at: 5.01 },
      { url: urlOf(there, voice), at: 5.01 + 1 + 0.18 },
    ]);
    expect(fallback.lines).toEqual([]);
  });

  it("asks for a clip's current version, so a re-recording never plays an old copy", async () => {
    const versioned: SpeechManifest = {
      ...manifest,
      clips: { [clipId(hello)]: { words: 'Hello', takes: 1, version: 'v2' } },
    };
    const { speaker, audio } = setup({ available: Promise.resolve(versioned) });
    speaker.say(hello);
    await vi.waitFor(() => expect(audio?.started()).toHaveLength(1));
    const voice = voiceOf(audio?.started()[0]?.url) ?? '';
    expect(audio?.started()[0]?.url).toBe(`${urlOf(hello, voice)}?v=v2`);
  });

  it('finishes when the last clip ends', async () => {
    vi.useFakeTimers();
    const { speaker, audio } = setup();
    let done = false;
    void speaker.say(hello, there).finished.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(audio?.started()).toHaveLength(2);

    // Two one-second clips with a pause between them, starting 0.01 s from now.
    await vi.advanceTimersByTimeAsync(2100);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
  });

  it('finishes at once when cut off, or with nothing to say', async () => {
    const { speaker } = setup();
    const first = speaker.say(hello);
    speaker.say(there);
    await first.finished;
    const second = speaker.say(cheer);
    speaker.stop();
    await second.finished;
    await speaker.say().finished;
  });

  it('finishes when the fallback voice does', async () => {
    const { speaker, fallback } = setup();
    fallback.holdSpeech = true;
    let done = false;
    void speaker.say(unrecorded).finished.then(() => (done = true));
    await vi.waitFor(() => expect(fallback.texts).toEqual(['Not recorded']));
    expect(done).toBe(false);
    fallback.finishSpeaking();
    await vi.waitFor(() => expect(done).toBe(true));
  });

  it('falls back to live speech for anything unrecorded, rather than mixing voices', async () => {
    const { speaker, fallback, fetchClip } = setup();
    speaker.say(hello, unrecorded);
    await vi.waitFor(() => expect(fallback.texts).toEqual(['Hello', 'Not recorded']));
    expect(fetchClip).not.toHaveBeenCalled();
  });

  it('falls back when there are no recordings, no voices or no Web Audio', async () => {
    const noManifest = setup({ available: Promise.resolve(undefined) });
    noManifest.speaker.say(hello);
    await vi.waitFor(() => expect(noManifest.fallback.texts).toEqual(['Hello']));

    const noVoices = setup({ available: Promise.resolve({ ...manifest, voices: [] }) });
    noVoices.speaker.say(hello);
    await vi.waitFor(() => expect(noVoices.fallback.texts).toEqual(['Hello']));

    const noAudio = setup({ webAudio: false });
    noAudio.speaker.say(hello);
    await vi.waitFor(() => expect(noAudio.fallback.texts).toEqual(['Hello']));
  });

  it('falls back when a clip fails to load, and retries it next time', async () => {
    const fetchClip = vi
      .fn<(url: string) => Promise<ArrayBuffer>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation((url) => Promise.resolve(new TextEncoder().encode(url).buffer));
    const { speaker, fallback, audio } = setup({ fetchClip });
    speaker.say(hello);
    await vi.waitFor(() => expect(fallback.texts).toEqual(['Hello']));

    speaker.say(hello);
    await vi.waitFor(() => expect(audio?.started()).toHaveLength(1));
    expect(fetchClip).toHaveBeenCalledTimes(2);
  });

  it('drops an utterance that is interrupted while it loads', async () => {
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchClip = vi.fn(async (url: string) => {
      if (url.includes(clipId(hello))) await slow;
      return new TextEncoder().encode(url).buffer;
    });
    const { speaker, audio } = setup({ fetchClip });
    speaker.say(hello);
    speaker.say(there);
    await vi.waitFor(() => expect(audio?.started()).toHaveLength(1));
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(audio?.started().map((played) => played.url)).toEqual([
      urlOf(there, voiceOf(audio?.started()[0]?.url) ?? ''),
    ]);
  });

  it('cuts off what is playing when told to stop or say something new', async () => {
    const { speaker, audio, fallback } = setup();
    speaker.say(hello, there);
    await vi.waitFor(() => expect(audio?.started()).toHaveLength(2));
    speaker.stop();
    for (const source of audio?.sources ?? []) expect(source.stop).toHaveBeenCalled();
    expect(fallback.stops).toBeGreaterThan(0);
  });

  it('plays a different take each time a line repeats', async () => {
    const { speaker, audio } = setup();
    for (let i = 1; i <= 12; i++) {
      speaker.say(cheer);
      await vi.waitFor(() => expect(audio?.started()).toHaveLength(i));
    }
    const takes = audio?.started().map((played) => played.url) ?? [];
    takes.slice(1).forEach((take, i) => expect(take).not.toBe(takes[i]));
    expect(new Set(takes).size).toBeGreaterThan(2);
  });

  it('keeps one voice for the whole visit', async () => {
    const { speaker, audio } = setup({ seed: 5 });
    for (let i = 1; i <= 10; i++) {
      speaker.say(i % 2 ? cheer : hello, there);
      await vi.waitFor(() => expect(audio?.started()).toHaveLength(i * 2));
    }
    const voices = new Set(audio?.started().map((played) => voiceOf(played.url)));
    expect(voices.size).toBe(1);
  });

  it('picks voices at random across visits', async () => {
    const picked = new Set<string | undefined>();
    for (let seed = 0; seed < 30; seed++) {
      const { speaker, audio } = setup({ seed });
      speaker.say(hello);
      await vi.waitFor(() => expect(audio?.started()).toHaveLength(1));
      picked.add(voiceOf(audio?.started()[0]?.url));
    }
    expect(picked).toEqual(new Set(['katie', 'lulu', 'clara']));
  });

  it('keeps recently used clips decoded, up to the cache size', async () => {
    const { speaker, audio, fetchClip } = setup({ cacheSize: 1 });
    const sayAndWait = async (said: Line, plays: number) => {
      speaker.say(said);
      await vi.waitFor(() => expect(audio?.started()).toHaveLength(plays));
    };
    await sayAndWait(hello, 1);
    await sayAndWait(hello, 2);
    expect(fetchClip).toHaveBeenCalledTimes(1);
    await sayAndWait(there, 3);
    await sayAndWait(hello, 4);
    expect(fetchClip).toHaveBeenCalledTimes(3);
  });

  it('ignores sources that already finished when stopping', async () => {
    const { speaker, audio } = setup();
    speaker.say(hello);
    await vi.waitFor(() => expect(audio?.started()).toHaveLength(1));
    audio?.sources[0]?.stop.mockImplementation(() => {
      throw new Error('already stopped');
    });
    expect(() => speaker.stop()).not.toThrow();
  });

  it('does nothing for an empty utterance', async () => {
    const { speaker, fallback, fetchClip } = setup();
    speaker.say();
    await Promise.resolve();
    expect(fetchClip).not.toHaveBeenCalled();
    expect(fallback.lines).toEqual([]);
  });

  it('unlocks both the audio context and the fallback', () => {
    const { speaker, fallback, getContext } = setup();
    speaker.unlock();
    expect(getContext).toHaveBeenCalled();
    expect(fallback.unlocks).toBe(1);
  });

  it('fetches clips over HTTP by default', async () => {
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url.startsWith(clipId(hello))
          ? new Response(new TextEncoder().encode(url))
          : new Response('nope', { status: 404 }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    try {
      const audio = fakeAudio();
      const fallback = new RecordingSpeaker(false);
      const speaker = createClipSpeaker({
        manifest: Promise.resolve(manifest),
        clipUrl: (voice, id, take) => `${id}/${voice}#${take}`,
        getContext: () => audio.context,
        fallback,
      });
      speaker.say(hello);
      await vi.waitFor(() => expect(audio.started()).toHaveLength(1));
      speaker.say(there);
      await vi.waitFor(() => expect(fallback.texts).toEqual(['there']));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
