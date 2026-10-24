import { type Card, type Deck, describeWithExample } from './cards';
import { line, phrase } from './line';

interface ColorInfo {
  readonly id: string;
  readonly css: string;
  readonly emoji: string;
  readonly word: string;
}

const COLORS: readonly ColorInfo[] = [
  { id: 'red', css: '#e63946', emoji: '🍎', word: 'apple' },
  { id: 'blue', css: '#1d6fdc', emoji: '🐳', word: 'whale' },
  { id: 'yellow', css: '#ffd60a', emoji: '🍌', word: 'banana' },
  { id: 'green', css: '#2fb344', emoji: '🐸', word: 'frog' },
  { id: 'orange', css: '#ff8c1a', emoji: '🍊', word: 'orange' },
  { id: 'purple', css: '#8e44c9', emoji: '🍆', word: 'eggplant' },
  { id: 'pink', css: '#ff7eb6', emoji: '🐷', word: 'pig' },
  { id: 'brown', css: '#8b5a2b', emoji: '🐻', word: 'bear' },
  { id: 'black', css: '#1f1f1f', emoji: '🦇', word: 'bat' },
  { id: 'white', css: '#ffffff', emoji: '☁️', word: 'cloud' },
];

/** The first six are the classic rainbow colors; the rest come later. */
export const BASIC_COLOR_COUNT = 6;

export function colorCards(count = COLORS.length): Card[] {
  return COLORS.slice(0, count).map((color) => ({
    id: color.id,
    name: line(color.id),
    visual: { kind: 'color', color: color.css },
    example: { kind: 'picture', emoji: color.emoji, word: color.word },
  }));
}

export function createColorDeck(count?: number): Deck {
  return {
    noun: 'color',
    cards: colorCards(count),
    findPrompt: (card) => phrase`Can you find ${card.name}?`,
    askPrompt: line('What color is this?'),
    describe: describeWithExample,
  };
}
