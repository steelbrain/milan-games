import { describe, expect, it } from 'vitest';
import type { Deck } from './cards';
import { BASIC_COLOR_COUNT, colorCards, createColorDeck } from './colors';
import { ALPHABET, createLetterDeck, letterCards } from './letters';
import { caption, spokenText } from './line';
import { createNumberDeck, numberCards } from './numbers';
import { BASIC_SHAPE_COUNT, createShapeDeck, shapeCards } from './shapes';

const ALL_DECKS: [string, Deck][] = [
  ['upper-case letters', createLetterDeck('upper')],
  ['lower-case letters', createLetterDeck('lower')],
  ['numbers', createNumberDeck(1, 20)],
  ['colors', createColorDeck()],
  ['shapes', createShapeDeck()],
];

describe.each(ALL_DECKS)('%s deck', (_name, deck) => {
  it('has unique card ids', () => {
    const ids = deck.cards.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has enough cards for three choices', () => {
    expect(deck.cards.length).toBeGreaterThanOrEqual(3);
  });

  it('can talk about every card', () => {
    for (const card of deck.cards) {
      expect(deck.findPrompt(card).text).toContain(card.name.text);
      expect(caption(deck.describe(card)).length).toBeGreaterThan(0);
    }
    expect(deck.askPrompt.text).toMatch(/\?$/);
  });
});

describe('letters', () => {
  it('covers the alphabet in both cases', () => {
    expect(ALPHABET.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(letterCards('upper').map((card) => card.id)).toEqual(ALPHABET);
    expect(letterCards('lower').map((card) => card.id)).toEqual(
      ALPHABET.map((letter) => letter.toLowerCase()),
    );
  });

  it('pairs each letter with a word that starts with it', () => {
    for (const card of letterCards('upper')) {
      expect(card.example.kind).toBe('picture');
      if (card.example.kind === 'picture') {
        expect(card.example.word[0]?.toUpperCase()).toBe(card.id);
        expect(card.example.emoji.length).toBeGreaterThan(0);
      }
    }
  });

  it('speaks lower-case letters as upper case, so both levels share recordings', () => {
    const deck = createLetterDeck('lower');
    const a = deck.cards[0];
    expect(a?.name).toEqual({ text: 'a', speech: 'A' });
    if (a) {
      expect(deck.findPrompt(a)).toEqual({
        text: 'Find the letter a!',
        speech: 'Find the letter A!',
      });
      expect(deck.describe(a).map(spokenText)).toEqual(['A is for Apple!']);
    }
    expect(createLetterDeck('upper').cards[0]?.name).toEqual({ text: 'A' });
  });

  it('describes letters with their word', () => {
    const deck = createLetterDeck('upper');
    const b = deck.cards.find((card) => card.id === 'B');
    // Just once: "B! B is for Ball." sounded like a stutter.
    expect(b && caption(deck.describe(b))).toBe('B is for Ball!');
  });
});

describe('numbers', () => {
  it('covers the requested range', () => {
    expect(numberCards(1, 5).map((card) => card.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(createNumberDeck(1, 20).cards).toHaveLength(20);
  });

  it('shows each number as a quantity', () => {
    for (const card of numberCards(1, 20)) {
      expect(card.example).toEqual({ kind: 'quantity', count: Number(card.id) });
    }
  });

  it('gets the grammar right for one', () => {
    const [one, two] = createNumberDeck(1, 2).cards;
    const deck = createNumberDeck(1, 2);
    expect(one && caption(deck.describe(one))).toBe('1! Here is 1 dot.');
    expect(two && caption(deck.describe(two))).toBe('2! Here are 2 dots.');
  });
});

describe('colors', () => {
  it('starts with the basic rainbow colors', () => {
    expect(colorCards(BASIC_COLOR_COUNT).map((card) => card.id)).toEqual([
      'red',
      'blue',
      'yellow',
      'green',
      'orange',
      'purple',
    ]);
    expect(colorCards().length).toBeGreaterThan(BASIC_COLOR_COUNT);
  });

  it('uses valid CSS hex colors', () => {
    for (const { visual } of colorCards()) {
      expect(visual.kind).toBe('color');
      if (visual.kind === 'color') expect(visual.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('describes colors with an example', () => {
    const deck = createColorDeck();
    const orange = deck.cards.find((card) => card.id === 'orange');
    expect(orange && caption(deck.describe(orange))).toBe('Orange! Like an orange.');
    expect(orange && deck.findPrompt(orange).text).toBe('Can you find orange?');
  });
});

describe('shapes', () => {
  it('starts with the easy shapes', () => {
    expect(shapeCards(BASIC_SHAPE_COUNT).map((card) => card.id)).toEqual([
      'circle',
      'square',
      'triangle',
      'star',
      'heart',
    ]);
  });

  it('describes shapes with an example', () => {
    const deck = createShapeDeck();
    const triangle = deck.cards.find((card) => card.id === 'triangle');
    expect(triangle && caption(deck.describe(triangle))).toBe('Triangle! Like a slice of pizza.');
    expect(triangle && deck.findPrompt(triangle).text).toBe('Find the triangle!');
  });
});
