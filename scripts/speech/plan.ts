import { createHash } from 'node:crypto';
import type { VoiceSpec } from './voices.ts';

export interface ClipSpec {
  readonly id: string;
  readonly words: string;
  /** How many takes the catalog wants. */
  readonly takes: number;
}

export interface Job {
  readonly voice: VoiceSpec;
  readonly clip: ClipSpec;
  readonly take: number;
  /** Path under public/speech/, like "katie/0a1b2c3d4e5f60-2.m4a". */
  readonly file: string;
  readonly seed: number;
}

export interface Manifest {
  readonly voices: readonly { id: string; name: string }[];
  readonly recipe: unknown;
  /** The total size of the recordings it offers, which the build shows as the download's size. */
  readonly bytes: number;
  readonly clips: Record<string, { words: string; takes: number; version: string }>;
}

/** The recordings on disk, by their path under public/speech/. */
export interface Recordings {
  readonly exists: (file: string) => boolean;
  readonly read: (file: string) => Uint8Array;
}

/** Take 0 is "<id>.m4a"; matches clipFileName in src/speech/clipId.ts. */
export type FileNamer = (id: string, take: number) => string;

export function filePath(voice: VoiceSpec, clipFile: string): string {
  return `${voice.id}/${clipFile}`;
}

/** A stable seed per voice, clip and take, so any single take can be re-recorded identically. */
export function seedFor(voiceId: string, clipId: string, take: number): number {
  let hash = 2166136261;
  for (const char of `${voiceId}/${clipId}/${take}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

/**
 * What still needs recording, in the order that is most useful if credits run out partway:
 * the first take of everything for every voice, then the second take, and so on. Any prefix of
 * the work leaves every finished voice complete, just with fewer variations.
 */
export function planJobs(
  clips: readonly ClipSpec[],
  voices: readonly VoiceSpec[],
  fileName: FileNamer,
  exists: (file: string) => boolean,
): Job[] {
  const jobs: Job[] = [];
  const mostTakes = Math.max(0, ...clips.map((clip) => clip.takes));
  for (let take = 0; take < mostTakes; take++) {
    for (const voice of voices) {
      for (const clip of clips) {
        if (take >= clip.takes) continue;
        const file = filePath(voice, fileName(clip.id, take));
        if (!exists(file)) {
          jobs.push({ voice, clip, take, file, seed: seedFor(voice.id, clip.id, take) });
        }
      }
    }
  }
  return jobs;
}

/** Every file the catalog calls for. Anything else in public/speech/ is stale. */
export function expectedFiles(
  clips: readonly ClipSpec[],
  voices: readonly VoiceSpec[],
  fileName: FileNamer,
): Set<string> {
  const files = new Set<string>();
  for (const voice of voices) {
    for (const clip of clips) {
      for (let take = 0; take < clip.takes; take++)
        files.add(filePath(voice, fileName(clip.id, take)));
    }
  }
  return files;
}

/** A short fingerprint of a clip's recordings that changes whenever any of them does. */
export function fingerprint(contents: Iterable<Uint8Array>): string {
  const hash = createHash('sha256');
  for (const content of contents) hash.update(content);
  return hash.digest('hex').slice(0, 10);
}

/**
 * Describes what is actually on disk. A voice is offered only if it has every clip; each clip
 * offers the takes that every offered voice has, so the app never asks for a missing file.
 * A clip's version fingerprints the files it offers, so the app can tell when one is re-recorded.
 */
export function buildManifest(
  clips: readonly ClipSpec[],
  voices: readonly VoiceSpec[],
  fileName: FileNamer,
  { exists, read }: Recordings,
  recipe: unknown,
): Manifest {
  const takesOnDisk = (voice: VoiceSpec, clip: ClipSpec) => {
    let take = 0;
    while (take < clip.takes && exists(filePath(voice, fileName(clip.id, take)))) take++;
    return take;
  };
  let bytes = 0;
  const complete = voices.filter((voice) => clips.every((clip) => takesOnDisk(voice, clip) > 0));
  const entries = [...clips]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((clip) => {
      const takes = Math.min(...complete.map((voice) => takesOnDisk(voice, clip)));
      const contents = complete.flatMap((voice) =>
        Array.from({ length: takes }, (_, take) => read(filePath(voice, fileName(clip.id, take)))),
      );
      bytes += contents.reduce((sum, content) => sum + content.byteLength, 0);
      return [clip.id, { words: clip.words, takes, version: fingerprint(contents) }] as const;
    });
  return {
    voices: complete.map(({ id, name }) => ({ id, name })),
    recipe,
    bytes,
    clips: complete.length > 0 ? Object.fromEntries(entries) : {},
  };
}
