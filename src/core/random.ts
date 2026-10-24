/** A source of uniformly distributed numbers in [0, 1), with the same contract as Math.random. */
export type Random = () => number;

/**
 * A small deterministic generator (mulberry32). Games take a `Random` instead of calling
 * Math.random directly, so tests can replay the exact same rounds from a seed.
 */
export function createSeededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max], both inclusive. */
export function randomInt(random: Random, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`Invalid integer range [${min}, ${max}]`);
  }
  return min + Math.floor(random() * (max - min + 1));
}

/** Inclusive integer range: range(1, 3) is [1, 2, 3]. */
export function range(min: number, max: number): number[] {
  return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
}

export function pickOne<T>(random: Random, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('Cannot pick from an empty list');
  return items[Math.floor(random() * items.length)] as T;
}

/** Fisher–Yates shuffle into a new array; the input is left untouched. */
export function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = temp;
  }
  return result;
}

/** `count` distinct items in random order. */
export function sample<T>(random: Random, items: readonly T[], count: number): T[] {
  if (count > items.length) {
    throw new RangeError(`Cannot sample ${count} items from a list of ${items.length}`);
  }
  return shuffle(random, items).slice(0, count);
}

/**
 * A sequence of `count` items that never repeats an item until every item has been used,
 * and never shows the same item twice in a row (when there is more than one item).
 * This keeps short game sessions varied even when the pool is smaller than the session.
 */
export function drawSequence<T>(random: Random, items: readonly T[], count: number): T[] {
  if (items.length === 0) throw new RangeError('Cannot draw from an empty list');
  const result: T[] = [];
  while (result.length < count) {
    let batch = shuffle(random, items);
    const previous = result.at(-1);
    if (batch.length > 1 && batch[0] === previous) {
      // Rotate the repeat to the back of the batch.
      batch = [...batch.slice(1), batch[0] as T];
    }
    result.push(...batch.slice(0, count - result.length));
  }
  return result;
}

/**
 * Picks one of `count` options at random, but never the same option twice in a row for the same
 * key (when there is more than one). Used to vary recordings and sound effects.
 */
export function createNoRepeatPicker<K>(random: Random): (key: K, count: number) => number {
  const last = new Map<K, number>();
  return (key, count) => {
    if (count <= 1) return 0;
    const previous = last.get(key);
    const avoid = previous !== undefined && previous < count;
    let pick = randomInt(random, 0, count - (avoid ? 2 : 1));
    if (avoid && pick >= previous) pick++;
    last.set(key, pick);
    return pick;
  };
}
