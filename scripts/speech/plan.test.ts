import { describe, expect, it } from 'vitest';
import { buildManifest, type ClipSpec, expectedFiles, planJobs, seedFor } from './plan.ts';
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

  it('describes complete recordings', () => {
    expect(buildManifest(clips, voices, fileName, () => true, recipe)).toEqual({
      voices: [
        { id: 'katie', name: 'Katie' },
        { id: 'lulu', name: 'Lulu' },
      ],
      recipe,
      clips: { a: { words: '7!', takes: 2 }, b: { words: 'Yay!', takes: 3 } },
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
    const manifest = buildManifest(clips, voices, fileName, (file) => done.has(file), recipe);
    expect(manifest.voices.map((voice) => voice.id)).toEqual(['katie', 'lulu']);
    expect(manifest.clips).toEqual({
      a: { words: '7!', takes: 1 },
      b: { words: 'Yay!', takes: 2 },
    });
  });

  it('leaves out voices with missing lines, and is empty with no complete voice', () => {
    const katieOnly = expectedFiles(clips, [voices[0] as VoiceSpec], fileName);
    const manifest = buildManifest(clips, voices, fileName, (file) => katieOnly.has(file), recipe);
    expect(manifest.voices).toEqual([{ id: 'katie', name: 'Katie' }]);
    expect(buildManifest(clips, voices, fileName, () => false, recipe).clips).toEqual({});
  });
});
