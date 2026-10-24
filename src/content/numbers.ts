import { range } from '../core/random';
import type { Card, Deck } from './cards';
import { line, phrase, plural } from './line';

export function numberCards(min: number, max: number): Card[] {
  return range(min, max).map((n) => ({
    id: String(n),
    name: line(String(n)),
    visual: { kind: 'glyph', glyph: String(n) },
    example: { kind: 'quantity', count: n },
  }));
}

export function createNumberDeck(min: number, max: number): Deck {
  return {
    noun: 'number',
    cards: numberCards(min, max),
    findPrompt: (card) => phrase`Find the number ${card.name}!`,
    askPrompt: line('What number is this?'),
    describe: (card) => {
      const count = Number(card.id);
      return [
        phrase`${card.name}!`,
        line(`Here ${plural(count, 'is', 'are')} ${count} ${plural(count, 'dot', 'dots')}.`),
      ];
    },
  };
}
