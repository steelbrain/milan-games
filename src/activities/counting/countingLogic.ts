import { type ChoiceState, initialChoiceState } from '../../core/choice';
import { drawSequence, pickOne, type Random, randomInt, range, sample } from '../../core/random';
import { line, type Line, plural, type Utterance } from '../../content/line';
import type { Story, StoryScene } from '../../content/stories';

/** One thing to count, placed in a grid cell with a little jiggle so it looks hand-scattered. */
export interface ItemSlot {
  /** 0-based position in reading order; also the order the items pop in and get help-counted. */
  readonly id: number;
  /** Degrees. */
  readonly tilt: number;
  /** Offsets within the cell, in percent of the cell size. */
  readonly nudgeX: number;
  readonly nudgeY: number;
}

export interface CountingRound {
  readonly scene: StoryScene;
  readonly count: number;
  /** Number buttons, in ascending order, one of which is `count`. */
  readonly choices: readonly number[];
  readonly gridSize: number;
  /** gridSize² cells in reading order; null cells stay empty. */
  readonly cells: readonly (ItemSlot | null)[];
}

export interface CountingRange {
  readonly min: number;
  readonly max: number;
  readonly gridSize: number;
}

export function layoutItems(random: Random, count: number, gridSize: number): (ItemSlot | null)[] {
  const cellCount = gridSize * gridSize;
  if (count > cellCount) {
    throw new RangeError(`${count} items do not fit on a ${gridSize}×${gridSize} board`);
  }
  const filled = new Set(sample(random, range(0, cellCount - 1), count));
  let nextId = 0;
  return range(0, cellCount - 1).map((cell) =>
    filled.has(cell)
      ? {
          id: nextId++,
          tilt: randomInt(random, -14, 14),
          nudgeX: randomInt(random, -10, 10),
          nudgeY: randomInt(random, -10, 10),
        }
      : null,
  );
}

/** The answer plus nearby numbers, so the choice is about counting rather than guessing. */
export function countChoices(random: Random, answer: number, max: number, size = 3): number[] {
  const near = range(Math.max(1, answer - 3), Math.min(max, answer + 3)).filter(
    (n) => n !== answer,
  );
  const pool = near.length >= size - 1 ? near : range(1, max).filter((n) => n !== answer);
  const others = sample(random, pool, Math.min(size - 1, pool.length));
  return [answer, ...others].sort((a, b) => a - b);
}

/** How many pages of its story each game tells; one star each. */
export const PAGES_PER_GAME = 5;

/**
 * A random few of the story's scenes, told in story order so it still flows. Stories have more
 * scenes than a game uses, so playing the same story again tells it differently.
 */
export function pickScenes(
  random: Random,
  scenes: readonly StoryScene[],
  count = PAGES_PER_GAME,
): StoryScene[] {
  const picked = new Set(
    sample(random, range(0, scenes.length - 1), Math.min(count, scenes.length)),
  );
  return scenes.filter((_, i) => picked.has(i));
}

export function createCountingRounds(
  random: Random,
  story: Story,
  { min, max, gridSize }: CountingRange,
): CountingRound[] {
  const scenes = pickScenes(random, story.scenes);
  const counts = drawSequence(random, range(min, max), scenes.length);
  return scenes.map((scene, i) => {
    const count = counts[i] as number;
    return {
      scene,
      count,
      choices: countChoices(random, count, max),
      gridSize,
      cells: layoutItems(random, count, gridSize),
    };
  });
}

export function itemIds(round: CountingRound): number[] {
  return round.cells.flatMap((cell) => (cell ? [cell.id] : []));
}

export interface CountingState {
  /** Item ids in the order they were tapped; an item's count is its position + 1. */
  readonly counted: readonly number[];
  readonly answer: ChoiceState<number>;
}

export function initialCountingState(): CountingState {
  return { counted: [], answer: initialChoiceState() };
}

/** Counts one more item. Returns the same state if the tap should be ignored. */
export function countItem(state: CountingState, itemId: number): CountingState {
  if (state.answer.solved || state.counted.includes(itemId)) return state;
  return { ...state, counted: [...state.counted, itemId] };
}

export function resetCount(state: CountingState): CountingState {
  return state.counted.length === 0 ? state : { ...state, counted: [] };
}

export function storyEnding(story: Story): Line {
  return line(story.ending);
}

export function countingQuestion(scene: StoryScene): Line {
  return line(`${scene.setup} How many ${scene.item.many}?`);
}

/** Ways to say the last one has been counted, so the end of every count sounds different. */
export const ALL_COUNTED: readonly Line[] = [
  "That's all of them!",
  "That's all!",
  "That's every one!",
  'We counted them all!',
  'All counted!',
  'And that was the last one!',
].map((text) => line(text));
export const TRY_AGAIN = line("Let's try again!");
/** Said when the child races through the items to make the voice do the counting. */
export const SLOW_DOWN = line("Whoa, slow down! Let's count them one at a time.");

/**
 * This many taps this close together is faster than the voice can say the numbers, so the
 * child is racing it rather than counting along.
 */
export const TOO_FAST = { taps: 5, withinMs: 2000 } as const;

/** Whether the latest taps (times in ms, oldest first) came too fast to be counting along. */
export function tappingTooFast(times: readonly number[]): boolean {
  const recent = times.slice(-TOO_FAST.taps);
  const first = recent[0];
  const last = recent.at(-1);
  if (recent.length < TOO_FAST.taps || first === undefined || last === undefined) return false;
  return last - first < TOO_FAST.withinMs;
}

/** "7!", said as each item is counted. */
export function countWord(count: number): Line {
  return line(`${count}!`);
}

/** "7!", and after the last one something like "That's all of them!". */
export function countAloud(random: Random, count: number, total: number): Utterance {
  return count === total ? [countWord(count), pickOne(random, ALL_COUNTED)] : [countWord(count)];
}

export function countTogether(scene: StoryScene): Line {
  return line(`Let's count the ${scene.item.many} together!`);
}

export function countedItems(scene: StoryScene, count: number): Line {
  return line(`${count} ${plural(count, scene.item.one, scene.item.many)}!`);
}

/** "Hooray! 4 carrots! Crunch crunch!" */
export function countingSuccess(cheer: Line, scene: StoryScene, count: number): Utterance {
  return [cheer, countedItems(scene, count), line(scene.cheer)];
}

export function notThisMany(choice: number): Line {
  return line(`Not ${choice}.`);
}

export function countingRetry(choice: number): Utterance {
  return [notThisMany(choice), TRY_AGAIN];
}
