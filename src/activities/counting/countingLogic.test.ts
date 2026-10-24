import { describe, expect, it } from 'vitest';
import { caption, line } from '../../content/line';
import { STORIES } from '../../content/stories';
import { choose } from '../../core/choice';
import { createSeededRandom, range } from '../../core/random';
import {
  countAloud,
  countChoices,
  countingQuestion,
  countingRetry,
  countingSuccess,
  countItem,
  countTogether,
  createCountingRounds,
  initialCountingState,
  itemIds,
  layoutItems,
  resetCount,
  storyEnding,
  tappingTooFast,
  TOO_FAST,
} from './countingLogic';

const story = STORIES[0]!;
const scene = story.scenes[0]!;

describe('layoutItems', () => {
  it('places exactly `count` items on the board, numbered in reading order', () => {
    for (let seed = 0; seed < 30; seed++) {
      const cells = layoutItems(createSeededRandom(seed), 7, 4);
      expect(cells).toHaveLength(16);
      const items = cells.filter((cell) => cell !== null);
      expect(items.map((item) => item.id)).toEqual(range(0, 6));
    }
  });

  it('keeps the jiggle small so items stay inside their cells', () => {
    for (const cell of layoutItems(createSeededRandom(4), 20, 5)) {
      if (!cell) continue;
      expect(Math.abs(cell.tilt)).toBeLessThanOrEqual(14);
      expect(Math.abs(cell.nudgeX)).toBeLessThanOrEqual(10);
      expect(Math.abs(cell.nudgeY)).toBeLessThanOrEqual(10);
    }
  });

  it('can fill the whole board', () => {
    expect(layoutItems(createSeededRandom(1), 9, 3).every((cell) => cell !== null)).toBe(true);
  });

  it('refuses more items than cells', () => {
    expect(() => layoutItems(createSeededRandom(1), 10, 3)).toThrow(RangeError);
  });
});

describe('countChoices', () => {
  it('offers the answer and two different nearby numbers, sorted', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const [answer, max] of [
        [1, 5],
        [5, 5],
        [3, 10],
        [20, 20],
        [12, 20],
      ] as const) {
        const choices = countChoices(createSeededRandom(seed), answer, max);
        expect(choices).toHaveLength(3);
        expect(choices).toContain(answer);
        expect(new Set(choices).size).toBe(3);
        expect(choices).toEqual([...choices].sort((a, b) => a - b));
        for (const choice of choices) {
          expect(choice).toBeGreaterThanOrEqual(1);
          expect(choice).toBeLessThanOrEqual(max);
          expect(Math.abs(choice - answer)).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('widens the pool when there are not enough nearby numbers', () => {
    const choices = countChoices(createSeededRandom(3), 1, 2, 3);
    expect(choices).toEqual([1, 2]);
  });
});

describe('createCountingRounds', () => {
  it('makes one round per story scene, in story order', () => {
    const rounds = createCountingRounds(createSeededRandom(5), story, {
      min: 1,
      max: 5,
      gridSize: 3,
    });
    expect(rounds.map((round) => round.scene)).toEqual(story.scenes);
  });

  it('keeps counts in range, all different, and laid out on the board', () => {
    for (let seed = 0; seed < 30; seed++) {
      const rounds = createCountingRounds(createSeededRandom(seed), story, {
        min: 6,
        max: 20,
        gridSize: 5,
      });
      const counts = rounds.map((round) => round.count);
      expect(new Set(counts).size).toBe(counts.length);
      for (const round of rounds) {
        expect(round.count).toBeGreaterThanOrEqual(6);
        expect(round.count).toBeLessThanOrEqual(20);
        expect(round.gridSize).toBe(5);
        expect(itemIds(round)).toHaveLength(round.count);
        expect(round.choices).toContain(round.count);
      }
    }
  });
});

describe('counting state', () => {
  it('counts each item once, in tap order', () => {
    let state = initialCountingState();
    state = countItem(state, 4);
    state = countItem(state, 1);
    expect(state.counted).toEqual([4, 1]);
    expect(countItem(state, 4)).toBe(state);
  });

  it('stops counting once the answer is found', () => {
    const state = {
      ...initialCountingState(),
      answer: choose(initialCountingState().answer, 2, 2).state,
    };
    expect(countItem(state, 0)).toBe(state);
  });

  it('resets the count but keeps the answers so far', () => {
    const wrong = choose(initialCountingState().answer, 3, 2).state;
    const state = countItem({ ...initialCountingState(), answer: wrong }, 0);
    const reset = resetCount(state);
    expect(reset.counted).toEqual([]);
    expect(reset.answer).toBe(wrong);
    expect(resetCount(reset)).toBe(reset);
  });
});

describe('tappingTooFast', () => {
  const taps = (gapMs: number, count: number = TOO_FAST.taps) =>
    Array.from({ length: count }, (_, i) => 10_000 + i * gapMs);

  it('spots taps faster than the voice can count', () => {
    expect(tappingTooFast(taps(300))).toBe(true);
    expect(tappingTooFast([...taps(2000, 3), ...taps(200).map((t) => t + 9000)])).toBe(true);
  });

  it('leaves a child counting along alone, however many items there are', () => {
    expect(tappingTooFast(taps(600))).toBe(false);
    expect(tappingTooFast(taps(700, 20))).toBe(false);
    expect(tappingTooFast(taps(100, TOO_FAST.taps - 1))).toBe(false);
    expect(tappingTooFast([])).toBe(false);
  });
});

describe('counting lines', () => {
  it('asks the question after setting the scene', () => {
    expect(countingQuestion(scene).text).toBe(
      'Bunny is packing a picnic basket. How many carrots?',
    );
  });

  it('counts out loud and marks the last one', () => {
    expect(caption(countAloud(2, 5))).toBe('2!');
    expect(caption(countAloud(5, 5))).toBe("5! That's all of them!");
  });

  it('cheers with the right noun form', () => {
    expect(caption(countingSuccess(line('Yes!'), scene, 1))).toBe('Yes! 1 carrot! Crunch crunch!');
    expect(caption(countingSuccess(line('Yay!'), scene, 4))).toBe('Yay! 4 carrots! Crunch crunch!');
  });

  it('encourages another try', () => {
    expect(caption(countingRetry(3))).toBe("Not 3. Let's try again!");
  });

  it('offers to count together and ends the story', () => {
    expect(countTogether(scene).text).toBe("Let's count the carrots together!");
    expect(storyEnding(story).text).toBe(story.ending);
  });
});
