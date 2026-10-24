import { describe, expect, it } from 'vitest';
import {
  createSeededRandom,
  createNoRepeatPicker,
  drawSequence,
  pickOne,
  randomInt,
  range,
  sample,
  shuffle,
} from './random';

describe('createSeededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const a = createSeededRandom(123);
    const b = createSeededRandom(123);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(Array.from({ length: 5 }, a)).not.toEqual(Array.from({ length: 5 }, b));
  });

  it('stays within [0, 1)', () => {
    const random = createSeededRandom(99);
    for (let i = 0; i < 2000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('covers the whole inclusive range and nothing outside it', () => {
    const random = createSeededRandom(5);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randomInt(random, 3, 7));
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('handles the edges of the generator', () => {
    expect(randomInt(() => 0, 1, 6)).toBe(1);
    expect(randomInt(() => 0.999999, 1, 6)).toBe(6);
  });

  it('rejects invalid ranges', () => {
    expect(() => randomInt(Math.random, 5, 1)).toThrow(RangeError);
    expect(() => randomInt(Math.random, 1.5, 3)).toThrow(RangeError);
  });
});

describe('range', () => {
  it('is inclusive', () => {
    expect(range(1, 4)).toEqual([1, 2, 3, 4]);
    expect(range(3, 3)).toEqual([3]);
  });

  it('is empty when max < min', () => {
    expect(range(4, 1)).toEqual([]);
  });
});

describe('pickOne', () => {
  it('picks an item from the list', () => {
    expect(pickOne(() => 0.5, ['a', 'b', 'c'])).toBe('b');
  });

  it('refuses an empty list', () => {
    expect(() => pickOne(Math.random, [])).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  it('returns a permutation without touching the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const output = shuffle(createSeededRandom(3), input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...output].sort()).toEqual(input);
    expect(output).not.toEqual(input);
  });
});

describe('sample', () => {
  it('returns distinct items', () => {
    const picked = sample(createSeededRandom(8), range(1, 10), 4);
    expect(picked).toHaveLength(4);
    expect(new Set(picked).size).toBe(4);
  });

  it('refuses to take more than there is', () => {
    expect(() => sample(Math.random, [1, 2], 3)).toThrow(RangeError);
  });
});

describe('drawSequence', () => {
  it('does not repeat until every item has been used', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const drawn = drawSequence(createSeededRandom(11), items, 5);
    expect([...drawn].sort()).toEqual(items);
  });

  it('never shows the same item twice in a row, across many seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const drawn = drawSequence(createSeededRandom(seed), ['a', 'b', 'c'], 12);
      expect(drawn).toHaveLength(12);
      drawn.slice(1).forEach((item, i) => expect(item).not.toBe(drawn[i]));
    }
  });

  it('works with a single item', () => {
    expect(drawSequence(Math.random, ['only'], 3)).toEqual(['only', 'only', 'only']);
  });

  it('refuses an empty list', () => {
    expect(() => drawSequence(Math.random, [], 1)).toThrow(RangeError);
  });
});

describe('createNoRepeatPicker', () => {
  it('never picks the same option twice in a row, and uses them all', () => {
    const pick = createNoRepeatPicker<string>(createSeededRandom(4));
    const picks = Array.from({ length: 300 }, () => pick('yes', 4));
    picks.slice(1).forEach((value, i) => expect(value).not.toBe(picks[i]));
    expect(new Set(picks)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('remembers each key separately', () => {
    const pick = createNoRepeatPicker<string>(() => 0);
    expect(pick('a', 3)).toBe(0);
    expect(pick('b', 3)).toBe(0);
    expect(pick('a', 3)).toBe(1);
  });

  it('handles a single option and a shrinking option count', () => {
    const pick = createNoRepeatPicker<string>(() => 0.99);
    expect(pick('a', 1)).toBe(0);
    expect(pick('a', 5)).toBe(4);
    expect(pick('a', 2)).toBe(1);
  });
});
