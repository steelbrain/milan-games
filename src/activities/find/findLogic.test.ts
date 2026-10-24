import { describe, expect, it } from 'vitest';
import { createLetterDeck } from '../../content/letters';
import { createShapeDeck } from '../../content/shapes';
import { createSeededRandom } from '../../core/random';
import { createFindRounds } from './findLogic';

describe('createFindRounds', () => {
  const cards = createLetterDeck('upper').cards;

  it('makes the requested rounds, each with the target among distinct choices', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rounds = createFindRounds(cards, createSeededRandom(seed), { rounds: 5, choices: 3 });
      expect(rounds).toHaveLength(5);
      for (const round of rounds) {
        const ids = round.choices.map((card) => card.id);
        expect(ids).toHaveLength(3);
        expect(new Set(ids).size).toBe(3);
        expect(ids).toContain(round.target.id);
      }
    }
  });

  it('does not repeat a target within a session', () => {
    const rounds = createFindRounds(cards, createSeededRandom(1), { rounds: 5, choices: 3 });
    const targets = rounds.map((round) => round.target.id);
    expect(new Set(targets).size).toBe(5);
  });

  it('puts the target in different positions', () => {
    const positions = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const [round] = createFindRounds(cards, createSeededRandom(seed), { rounds: 1, choices: 3 });
      if (round) positions.add(round.choices.indexOf(round.target));
    }
    expect(positions).toEqual(new Set([0, 1, 2]));
  });

  it('copes with small decks', () => {
    const small = createShapeDeck(3).cards;
    const rounds = createFindRounds(small, createSeededRandom(2), { rounds: 5, choices: 4 });
    expect(rounds).toHaveLength(5);
    for (const round of rounds) expect(round.choices).toHaveLength(3);
  });
});
