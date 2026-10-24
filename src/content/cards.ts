import { capitalize, type Line, line, type Utterance, withArticle } from './line';

export type ShapeName =
  'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'rectangle' | 'oval' | 'diamond';

/** How a card is drawn. */
export type CardVisual =
  | { readonly kind: 'glyph'; readonly glyph: string }
  | { readonly kind: 'color'; readonly color: string }
  | { readonly kind: 'shape'; readonly shape: ShapeName };

/** The picture shown once a card is named, to connect it to something familiar. */
export type CardExample =
  | { readonly kind: 'picture'; readonly emoji: string; readonly word: string }
  | { readonly kind: 'quantity'; readonly count: number };

/** One thing to learn: a letter, a number, a color, a shape. */
export interface Card {
  readonly id: string;
  readonly name: Line;
  readonly visual: CardVisual;
  readonly example: CardExample;
}

/** A set of cards plus the phrases used to talk about them. */
export interface Deck {
  /** Singular noun for the kind of card: "letter", "number". */
  readonly noun: string;
  readonly cards: readonly Card[];
  /** "Find the letter B!" */
  readonly findPrompt: (card: Card) => Line;
  /** "What letter is this?" */
  readonly askPrompt: Line;
  /** "B is for Ball!" Said when a card is revealed or found. */
  readonly describe: (card: Card) => Utterance;
}

/** "Red! Like an apple.": names a card, then the familiar thing in its picture. */
export function describeWithExample(card: Card): Utterance {
  const name = `${capitalize(card.name.text)}!`;
  return [
    line(
      card.example.kind === 'picture' ? `${name} Like ${withArticle(card.example.word)}.` : name,
    ),
  ];
}
