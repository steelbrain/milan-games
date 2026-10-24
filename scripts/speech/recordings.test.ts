import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { speechCatalog } from '../../src/speech/catalog';
import { clipFileName, clipId, clipWords } from '../../src/speech/clipId';
import { isSpeechManifest } from '../../src/speech/manifest';
import { fingerprint } from './plan.ts';
import { VOICES } from './voices.ts';

const speechDir = path.resolve(import.meta.dirname, '../../public/speech');

describe('the committed recordings (run `npm run speech` after changing what the games say)', () => {
  const manifest: unknown = JSON.parse(readFileSync(path.join(speechDir, 'manifest.json'), 'utf8'));

  it('cover every voice', () => {
    expect(isSpeechManifest(manifest)).toBe(true);
    if (!isSpeechManifest(manifest)) return;
    expect(manifest.voices).toEqual(VOICES.map(({ id, name }) => ({ id, name })));
  });

  it('cover every line in the catalog, with every take', () => {
    if (!isSpeechManifest(manifest)) throw new Error('Invalid manifest');
    const expected = Object.fromEntries(
      speechCatalog().map(({ line, takes }) => [clipId(line), { words: clipWords(line), takes }]),
    );
    const described = Object.fromEntries(
      Object.entries(manifest.clips).map(([id, { words, takes }]) => [id, { words, takes }]),
    );
    expect(described).toEqual(expected);
  });

  it('are versioned and sized by what is on disk, so changes reach saved copies', () => {
    if (!isSpeechManifest(manifest)) throw new Error('Invalid manifest');
    let bytes = 0;
    const stale = Object.entries(manifest.clips).filter(([id, { takes, version }]) => {
      const files = manifest.voices.flatMap((voice) =>
        Array.from({ length: takes }, (_, take) =>
          readFileSync(path.join(speechDir, voice.id, clipFileName(id, take))),
        ),
      );
      bytes += files.reduce((sum, file) => sum + file.byteLength, 0);
      return version !== fingerprint(files);
    });
    expect(stale.map(([id]) => id)).toEqual([]);
    expect((manifest as { bytes?: unknown }).bytes).toBe(bytes);
  });

  it.each(VOICES)('have every file for $name', (voice) => {
    if (!isSpeechManifest(manifest)) throw new Error('Invalid manifest');
    const files = new Set(readdirSync(path.join(speechDir, voice.id)));
    const missing = Object.entries(manifest.clips).flatMap(([id, { takes }]) =>
      Array.from({ length: takes }, (_, take) => clipFileName(id, take)).filter(
        (file) => !files.has(file),
      ),
    );
    expect(missing).toEqual([]);
    expect(existsSync(path.join(speechDir, voice.id))).toBe(true);
  });
});
