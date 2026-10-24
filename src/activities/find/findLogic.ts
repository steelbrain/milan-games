import type { Card } from '../../content/cards';
import { type Line, phrase } from '../../content/line';
import { drawSequence, type Random, sample, shuffle } from '../../core/random';

export interface FindRound {
  readonly target: Card;
  /** The target plus distractors, in display order. */
  readonly choices: readonly Card[];
}

export function createFindRounds(
  cards: readonly Card[],
  random: Random,
  { rounds, choices }: { rounds: number; choices: number },
): FindRound[] {
  return drawSequence(random, cards, rounds).map((target) => {
    const others = cards.filter((card) => card.id !== target.id);
    const distractors = sample(random, others, Math.min(choices - 1, others.length));
    return { target, choices: shuffle(random, [target, ...distractors]) };
  });
}

/** Said when the child picks the wrong card, before repeating the question. */
export function namedCard(card: Card): Line {
  return phrase`That's ${card.name}.`;
}
