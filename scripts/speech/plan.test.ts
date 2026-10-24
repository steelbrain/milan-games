import { describe, expect, it } from 'vitest';
import {
  buildManifest,
  type ClipSpec,
  expectedFiles,
  fingerprint,
  planJobs,
  seedFor,
} from './plan.ts';
import type { VoiceSpec } from './voices.ts';

const voices: VoiceSpec[] = [
  { id: 'katie', name: 'Katie', elevenLabsId: 'k' },
  { id: 'lulu', name: 'Lulu', elevenLabsId: 'l' },
];
const clips: ClipSpec[] = [
  { id: 'b', words: 'Yay!', takes: 3 },
  { id: 'a', words: '7!', takes: 2 },
];
const fileName = (id: string, take: number) => (take === 0 ? `${id}.m4a` : `${id}-${take}.m4a`);

describe('planJobs', () => {
  it('records the first take of everything, for every voice, before any second take', () => {
    const jobs = planJobs(clips, voices, fileName, () => false);
    expect(jobs.map((job) => job.file)).toEqual([
      'katie/b.m4a',
      'katie/a.m4a',
      'lulu/b.m4a',
      'lulu/a.m4a',
      'katie/b-1.m4a',
      'katie/a-1.m4a',
      'lulu/b-1.m4a',
      'lulu/a-1.m4a',
      'katie/b-2.m4a',
      'lulu/b-2.m4a',
    ]);
  });

  it('skips what is already recorded, so runs can resume', () => {
    const done = new Set(['katie/b.m4a', 'lulu/a-1.m4a']);
    const files = planJobs(clips, voices, fileName, (file) => done.has(file)).map(
      (job) => job.file,
    );
    expect(files).not.toContain('katie/b.m4a');
    expect(files).not.toContain('lulu/a-1.m4a');
    expect(files).toHaveLength(8);
  });

  it('gives every take its own stable seed', () => {
    const jobs = planJobs(clips, voices, fileName, () => false);
    const seeds = jobs.map((job) => job.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(jobs[0]?.seed).toBe(seedFor('katie', 'b', 0));
    for (const seed of seeds) expect(seed).toBeLessThan(2 ** 32);
  });
});

describe('expectedFiles', () => {
  it('lists every take for every voice', () => {
    expect(expectedFiles(clips, voices, fileName).size).toBe((3 + 2) * 2);
  });
});

describe('buildManifest', () => {
  const recipe = { model: 'm' };
  // Each "recording" holds its own path, so versions and sizes show which files went into them.
  const read = (file: string) => new TextEncoder().encode(file);
  const versionOf = (...files: string[]) => fingerprint(files.map(read));
  const sizeOf = (...files: string[]) => files.join('').length;
  const build = (exists: (file: string) => boolean) =>
    buildManifest(clips, voices, fileName, { exists, read }, recipe);

  it('describes complete recordings, versioning each clip by all its files', () => {
    const a = ['katie/a.m4a', 'katie/a-1.m4a', 'lulu/a.m4a', 'lulu/a-1.m4a'];
    const b = [
      'katie/b.m4a',
      'katie/b-1.m4a',
      'katie/b-2.m4a',
      'lulu/b.m4a',
      'lulu/b-1.m4a',
      'lulu/b-2.m4a',
    ];
    expect(build(() => true)).toEqual({
      voices: [
        { id: 'katie', name: 'Katie' },
        { id: 'lulu', name: 'Lulu' },
      ],
      recipe,
      bytes: sizeOf(...a, ...b),
      clips: {
        a: { words: '7!', takes: 2, version: versionOf(...a) },
        b: { words: 'Yay!', takes: 3, version: versionOf(...b) },
      },
    });
  });

  it('only offers voices that have every line, and takes that every voice has', () => {
    const done = new Set([
      ...expectedFiles(clips, [voices[0] as VoiceSpec], fileName),
      'lulu/a.m4a',
      'lulu/b.m4a',
      'lulu/b-1.m4a',
    ]);
    done.delete('katie/b-2.m4a');
    const manifest = build((file) => done.has(file));
    expect(manifest.voices.map((voice) => voice.id)).toEqual(['katie', 'lulu']);
    expect(manifest.clips).toEqual({
      a: { words: '7!', takes: 1, version: versionOf('katie/a.m4a', 'lulu/a.m4a') },
      b: {
        words: 'Yay!',
        takes: 2,
        version: versionOf('katie/b.m4a', 'katie/b-1.m4a', 'lulu/b.m4a', 'lulu/b-1.m4a'),
      },
    });
    // Only what is offered counts towards the size, not Katie's extra take of "7!".
    expect(manifest.bytes).toBe(
      sizeOf(
        'katie/a.m4a',
        'lulu/a.m4a',
        'katie/b.m4a',
        'katie/b-1.m4a',
        'lulu/b.m4a',
        'lulu/b-1.m4a',
      ),
    );
  });

  it('leaves out voices with missing lines, and is empty with no complete voice', () => {
    const katieOnly = expectedFiles(clips, [voices[0] as VoiceSpec], fileName);
    const manifest = build((file) => katieOnly.has(file));
    expect(manifest.voices).toEqual([{ id: 'katie', name: 'Katie' }]);
    expect(build(() => false)).toMatchObject({ bytes: 0, clips: {} });
  });
});

describe('fingerprint', () => {
  const bytes = (text: string) => new TextEncoder().encode(text);

  it('is short and the same for the same recordings', () => {
    expect(fingerprint([bytes('take 0'), bytes('take 1')])).toMatch(/^[0-9a-f]{10}$/);
    expect(fingerprint([bytes('take 0'), bytes('take 1')])).toBe(
      fingerprint([bytes('take 0'), bytes('take 1')]),
    );
  });

  it('changes when any recording does', () => {
    expect(fingerprint([bytes('take 0'), bytes('take 1')])).not.toBe(
      fingerprint([bytes('take 0'), bytes('new take 1')]),
    );
  });
});
