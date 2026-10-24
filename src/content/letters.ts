import type { Card, Deck } from './cards';
import { line, phrase } from './line';

export type LetterCase = 'upper' | 'lower';

const EXAMPLES: Record<string, readonly [emoji: string, word: string]> = {
  A: ['🍎', 'Apple'],
  B: ['🏀', 'Ball'],
  C: ['🐱', 'Cat'],
  D: ['🐶', 'Dog'],
  E: ['🐘', 'Elephant'],
  F: ['🐟', 'Fish'],
  G: ['🍇', 'Grapes'],
  H: ['🏠', 'House'],
  I: ['🍦', 'Ice cream'],
  J: ['🧃', 'Juice'],
  K: ['🪁', 'Kite'],
  L: ['🦁', 'Lion'],
  M: ['🌙', 'Moon'],
  N: ['👃', 'Nose'],
  O: ['🐙', 'Octopus'],
  P: ['🐷', 'Pig'],
  Q: ['👸', 'Queen'],
  R: ['🌈', 'Rainbow'],
  S: ['☀️', 'Sun'],
  T: ['🌳', 'Tree'],
  U: ['☂️', 'Umbrella'],
  V: ['🎻', 'Violin'],
  W: ['🐳', 'Whale'],
  X: ['🩻', 'X-ray'],
  Y: ['🪀', 'Yo-yo'],
  Z: ['🦓', 'Zebra'],
};

export const ALPHABET = Object.keys(EXAMPLES);

export function letterCards(letterCase: LetterCase): Card[] {
  return ALPHABET.map((upper) => {
    const [emoji, word] = EXAMPLES[upper] as readonly [string, string];
    const glyph = letterCase === 'upper' ? upper : upper.toLowerCase();
    return {
      id: glyph,
      // Spoken in upper case so "b" and "B" share one recording.
      name: line(glyph, upper),
      visual: { kind: 'glyph', glyph },
      example: { kind: 'picture', emoji, word },
    };
  });
}

export function createLetterDeck(letterCase: LetterCase): Deck {
  return {
    noun: 'letter',
    cards: letterCards(letterCase),
    findPrompt: (card) => phrase`Find the letter ${card.name}!`,
    askPrompt: line('What letter is this?'),
    describe: (card) => [
      card.example.kind === 'picture'
        ? phrase`${card.name}! ${card.name} is for ${card.example.word}.`
        : phrase`${card.name}!`,
    ],
  };
}
