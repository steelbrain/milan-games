import type { Line } from '../content/line';
import { createNoRepeatPicker, pickOne, type Random } from '../core/random';
import { clipId } from '../speech/clipId';
import type { ClipInfo, SpeechManifest, VoiceInfo } from '../speech/manifest';
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
 * How many takes of a clip to try before giving up on it. A take can fail to download or decode
 * (a dropped connection, a busy decoder on a burst of taps); the robotic fallback voice is a last
 * resort, so another take gets a chance first.
 */
const LOAD_ATTEMPTS = 3;

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

  /** A random take of the clip, trying other takes if one fails to load. */
  async function loadTake(
    context: ClipAudioContext,
    voice: string,
    id: string,
    clip: ClipInfo,
    mine: number,
  ): Promise<AudioBuffer> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await load(context, clipUrl(voice, id, pickTake(id, clip.takes), clip.version));
      } catch (error) {
        if (attempt >= LOAD_ATTEMPTS || mine !== generation) throw error;
      }
    }
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
    const clips: { id: string; clip: ClipInfo }[] = [];
    for (const line of lines) {
      const id = clipId(line);
      const clip =
        available && Object.hasOwn(available.clips, id) ? available.clips[id] : undefined;
      if (clip) clips.push({ id, clip });
    }
    // Anything unrecorded means the whole utterance falls back, rather than mixing two voices.
    if (!context || !speaking || clips.length < lines.length) {
      if (mine === generation) fallBack(lines, finish);
      return;
    }
    try {
      const buffers = await Promise.all(
        clips.map(({ id, clip }) => loadTake(context, speaking.id, id, clip, mine)),
      );
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
      // Done when the last clip has really played, by the audio clock rather than a timer: a
      // suspended context (iOS after a phone call, say) plays nothing, so nothing has been said.
      const last = playing.at(-1);
      if (last) last.onended = () => finish();
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
