import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { speechCatalog } from '../../src/speech/catalog';
import { clipFileName, clipId, clipWords } from '../../src/speech/clipId';
import { isSpeechManifest } from '../../src/speech/manifest';
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
    expect(manifest.clips).toEqual(expected);
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
