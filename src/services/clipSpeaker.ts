import type { Line } from '../content/line';
import { createNoRepeatPicker, pickOne, type Random } from '../core/random';
import { clipId } from '../speech/clipId';
import type { SpeechManifest, VoiceInfo } from '../speech/manifest';
import type { Speaker } from './speech';

/** The parts of the Web Audio API needed to play recorded clips. */
export type ClipAudioContext = Pick<
  AudioContext,
  'currentTime' | 'destination' | 'createBufferSource' | 'decodeAudioData'
>;

export interface ClipSpeakerOptions {
  /** Which clips exist. Undefined means there are no recordings. */
  readonly manifest: Promise<SpeechManifest | undefined>;
  readonly clipUrl: (voice: string, id: string, take: number, version?: string) => string;
  readonly getContext: () => ClipAudioContext | undefined;
  /** Used for anything without a recording, so the game is never silent. */
  readonly fallback: Speaker;
  readonly fetchClip?: (url: string) => Promise<ArrayBuffer>;
  /** Pause between the clips of one utterance. */
  readonly gapSeconds?: number;
  /** How many decoded clips to keep in memory. */
  readonly cacheSize?: number;
  /** Picks the voice and which take of each clip to play. */
  readonly random?: Random;
}

/**
 * Speaks with pre-recorded clips (see scripts/speech), falling back to live speech synthesis.
 * One voice is picked at random when the recordings load and kept for the whole visit, so the
 * game always sounds like the same person; each line plays a random take in that voice.
 */
export function createClipSpeaker({
  manifest,
  clipUrl,
  getContext,
  fallback,
  fetchClip = fetchArrayBuffer,
  gapSeconds = 0.18,
  cacheSize = 80,
  random = Math.random,
}: ClipSpeakerOptions): Speaker {
  // Bumped by every say/stop, so slow loads for an older utterance never play late.
  let generation = 0;
  let playing: AudioBufferSourceNode[] = [];
  // Settles the current utterance's `finished` when something cuts it off.
  let cutOff = () => {};
  const cache = new Map<string, Promise<AudioBuffer>>();
  // A random take, but never the one played last time, so repeats always sound different.
  const pickTake = createNoRepeatPicker<string>(random);
  const voice: Promise<VoiceInfo | undefined> = manifest.then((available) =>
    available && available.voices.length > 0 ? pickOne(random, available.voices) : undefined,
  );

  function load(context: ClipAudioContext, url: string): Promise<AudioBuffer> {
    const cached = cache.get(url);
    if (cached) {
      // Move to the back: the map's insertion order doubles as least-recently-used order.
      cache.delete(url);
      cache.set(url, cached);
      return cached;
    }
    const buffer = fetchClip(url).then((data) => context.decodeAudioData(data));
    cache.set(url, buffer);
    buffer.catch(() => {
      // Only if still ours: an evicted and re-requested clip may have a newer load by now.
      if (cache.get(url) === buffer) cache.delete(url);
    });
    const oldest = cache.keys().next().value;
    if (cache.size > cacheSize && oldest !== undefined) cache.delete(oldest);
    return buffer;
  }

  function silence(): void {
    for (const source of playing) {
      try {
        source.stop();
      } catch {
        // Already finished.
      }
    }
    playing = [];
  }

  /** Speaks with the fallback voice, and finishes when it does. */
  function fallBack(lines: Line[], finish: () => void): void {
    void fallback.say(...lines).finished.then(finish);
  }

  async function speak(lines: Line[], mine: number, finish: () => void): Promise<void> {
    const [available, speaking] = await Promise.all([manifest, voice]);
    const context = getContext();
    const urls: string[] = [];
    for (const line of lines) {
      const id = clipId(line);
      const clip =
        available && Object.hasOwn(available.clips, id) ? available.clips[id] : undefined;
      if (clip && speaking) {
        urls.push(clipUrl(speaking.id, id, pickTake(id, clip.takes), clip.version));
      }
    }
    // Anything unrecorded means the whole utterance falls back, rather than mixing two voices.
    if (!context || urls.length < lines.length) {
      if (mine === generation) fallBack(lines, finish);
      return;
    }
    try {
      const buffers = await Promise.all(urls.map((url) => load(context, url)));
      if (mine !== generation) return;
      let startAt = context.currentTime + 0.01;
      playing = buffers.map((buffer) => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(startAt);
        startAt += buffer.duration + gapSeconds;
        return source;
      });
      const endsAt = startAt - gapSeconds;
      setTimeout(finish, Math.max(0, endsAt - context.currentTime) * 1000);
    } catch {
      if (mine === generation) fallBack(lines, finish);
    }
  }

  return {
    say(...lines) {
      cutOff();
      generation++;
      silence();
      fallback.stop();
      const finished = new Promise<void>((resolve) => {
        cutOff = resolve;
      });
      if (lines.length > 0) void speak(lines, generation, cutOff);
      else cutOff();
      return { finished };
    },
    stop() {
      cutOff();
      generation++;
      silence();
      fallback.stop();
    },
    unlock() {
      getContext();
      fallback.unlock();
    },
  };
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.arrayBuffer();
}
