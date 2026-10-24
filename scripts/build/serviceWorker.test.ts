import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { listFiles, shellOf, totalBytes } from './serviceWorker.ts';

const dir = mkdtempSync(path.join(os.tmpdir(), 'shell-'));
mkdirSync(path.join(dir, 'speech/katie'), { recursive: true });
writeFileSync(path.join(dir, 'icon.svg'), '<svg/>');
writeFileSync(path.join(dir, '.DS_Store'), 'junk');
writeFileSync(path.join(dir, 'speech/manifest.json'), '{}');
writeFileSync(path.join(dir, 'speech/katie/a.m4a'), 'aaaa');
writeFileSync(path.join(dir, 'speech/katie/b.m4a'), 'bbbbbb');

afterAll(() => rmSync(dir, { recursive: true }));

describe('listFiles', () => {
  it('lists every file with forward slashes, in order, skipping dotfiles', () => {
    expect(listFiles(dir)).toEqual([
      'icon.svg',
      'speech/katie/a.m4a',
      'speech/katie/b.m4a',
      'speech/manifest.json',
    ]);
  });
});

describe('totalBytes', () => {
  it('adds up the sizes of the chosen files', () => {
    expect(totalBytes(dir, (file) => file.endsWith('.m4a'))).toBe(10);
  });
});

describe('shellOf', () => {
  const build = (script: string) =>
    shellOf(
      new Map<string, string | Uint8Array>([
        ['index.html', '<html>'],
        ['assets/app.js', script],
        ['icon.png', new Uint8Array([1, 2, 3])],
      ]),
    );

  it('lists the files in order', () => {
    expect(build('one').files).toEqual(['assets/app.js', 'icon.png', 'index.html']);
  });

  it('gives each build its own version, and the same build the same one', () => {
    expect(build('one').version).toMatch(/^[0-9a-f]{12}$/);
    expect(build('one').version).toBe(build('one').version);
    expect(build('two').version).not.toBe(build('one').version);
  });
});
