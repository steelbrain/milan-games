import { describe, expect, it } from 'vitest';
import { line } from '../content/line';
import { clipFileName, clipId, clipWords } from './clipId';

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
