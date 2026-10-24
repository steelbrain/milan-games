import type { Card, Deck, ShapeName } from './cards';
import { capitalize, line, withArticle } from './line';

const SHAPES: readonly { id: ShapeName; emoji: string; word: string }[] = [
  { id: 'circle', emoji: '🍪', word: 'cookie' },
  { id: 'square', emoji: '🎁', word: 'present' },
  { id: 'triangle', emoji: '🍕', word: 'slice of pizza' },
  { id: 'star', emoji: '🌟', word: 'twinkly star' },
  { id: 'heart', emoji: '💌', word: 'valentine' },
  { id: 'rectangle', emoji: '🚪', word: 'door' },
  { id: 'oval', emoji: '🥚', word: 'egg' },
  { id: 'diamond', emoji: '🪁', word: 'kite' },
];

export const BASIC_SHAPE_COUNT = 5;

export function shapeCards(count = SHAPES.length): Card[] {
  return SHAPES.slice(0, count).map((shape) => ({
    id: shape.id,
    name: line(shape.id),
    visual: { kind: 'shape', shape: shape.id },
    example: { kind: 'picture', emoji: shape.emoji, word: shape.word },
  }));
}

export function createShapeDeck(count?: number): Deck {
  return {
    noun: 'shape',
    cards: shapeCards(count),
    findPrompt: (card) => line(`Find the ${card.name.text}!`),
    askPrompt: line('What shape is this?'),
    describe: (card) => [
      card.example.kind === 'picture'
        ? line(`${capitalize(card.name.text)}! Like ${withArticle(card.example.word)}.`)
        : line(`${capitalize(card.name.text)}!`),
    ],
  };
}
