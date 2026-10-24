import { describe, expect, it } from 'vitest';
import { capitalize, caption, line, phrase, plural, spokenText, withArticle } from './line';

describe('line', () => {
  it('drops a speech override that matches the text', () => {
    expect(line('Hi', 'Hi')).toEqual({ text: 'Hi' });
    expect(line('A', 'ay')).toEqual({ text: 'A', speech: 'ay' });
  });

  it('speaks the override when there is one', () => {
    expect(spokenText(line('A', 'ay'))).toBe('ay');
    expect(spokenText(line('B'))).toBe('B');
  });
});

describe('phrase', () => {
  it('keeps caption and speech in step', () => {
    const a = line('A', 'ay');
    expect(phrase`Find the letter ${a}!`).toEqual({
      text: 'Find the letter A!',
      speech: 'Find the letter ay!',
    });
  });

  it('accepts plain strings and numbers', () => {
    expect(phrase`${3} ${'apples'}`).toEqual({ text: '3 apples' });
  });

  it('nests lines', () => {
    const inner = phrase`Find ${line('A', 'ay')}!`;
    expect(phrase`Oops. ${inner}`).toEqual({ text: 'Oops. Find A!', speech: 'Oops. Find ay!' });
  });
});

describe('caption', () => {
  it('joins the lines of an utterance', () => {
    expect(caption([line('Yes!'), line('A', 'ay')])).toBe('Yes! A');
    expect(caption([])).toBe('');
  });
});

describe('word helpers', () => {
  it('capitalizes', () => {
    expect(capitalize('red')).toBe('Red');
    expect(capitalize('')).toBe('');
  });

  it('chooses a or an', () => {
    expect(withArticle('apple')).toBe('an apple');
    expect(withArticle('egg')).toBe('an egg');
    expect(withArticle('banana')).toBe('a banana');
  });

  it('pluralizes', () => {
    expect(plural(1, 'fish', 'fish')).toBe('fish');
    expect(plural(1, 'crab', 'crabs')).toBe('crab');
    expect(plural(2, 'crab', 'crabs')).toBe('crabs');
    expect(plural(0, 'crab', 'crabs')).toBe('crabs');
  });
});
