import { describe, expect, it } from 'vitest';
import { line } from '../content/line';
import { clipFileName, clipId, clipPath, clipWords } from './clipId';

describe('clipId', () => {
  it('is a stable 14-digit hex name', () => {
    expect(clipId(line('Yes!'))).toMatch(/^[0-9a-f]{14}$/);
    expect(clipId(line('Yes!'))).toBe(clipId(line('Yes!')));
  });

  it('depends only on the spoken words', () => {
    expect(clipId(line('b', 'B'))).toBe(clipId(line('B')));
    expect(clipId(line('Yes!  '))).toBe(clipId(line('Yes!')));
    expect(clipId(line('Yes!'))).not.toBe(clipId(line('Yes.')));
  });
});

describe('clipWords', () => {
  it('normalizes whitespace in the spoken form', () => {
    expect(clipWords(line('a', ' Find  the\nletter A! '))).toBe('Find the letter A!');
  });
});

describe('clipFileName', () => {
  it('names the first take plainly and numbers the rest', () => {
    expect(clipFileName('abc')).toBe('abc.m4a');
    expect(clipFileName('abc', 0)).toBe('abc.m4a');
    expect(clipFileName('abc', 3)).toBe('abc-3.m4a');
  });
});

describe('clipPath', () => {
  it("puts a take in its voice's folder", () => {
    expect(clipPath('katie', 'abc', 2)).toBe('katie/abc-2.m4a');
  });

  it("adds the clip's version, so a re-recording has a new URL", () => {
    expect(clipPath('katie', 'abc', 0, '3f9a2c1d00')).toBe('katie/abc.m4a?v=3f9a2c1d00');
  });
});
