import { namedCard } from '../activities/find/findLogic';
import {
  ALL_COUNTED,
  countedItems,
  countingQuestion,
  countTogether,
  countWord,
  notThisMany,
  storyEnding,
  SLOW_DOWN,
  TRY_AGAIN,
} from '../activities/counting/countingLogic';
import { CARD_GAME_FINALES, PRAISE } from '../activities/praise';
import { line, type Line } from '../content/line';
import { range } from '../core/random';
import { TOPICS, type Topic } from '../topics/topics';
import { clipId } from './clipId';

/**
 * How many different recordings ("takes") to make of a line. Lines a child hears over and over
 * get more takes, and the player picks a different one each time so they never sound canned.
 */
export const TAKES = {
  /** Counting out loud: said on every single tap. */
  constantly: 8,
  /** Cheering, retrying and questions asked every round. */
  often: 6,
  /** Prompts and story lines that come up every game or two. */
  sometimes: 5,
  /** Everything else still gets five takes, so nothing ever sounds canned. */
  rarely: 5,
} as const;

export interface CatalogEntry {
  readonly line: Line;
  readonly takes: number;
}

/**
 * Every line the games can say. The speech generator records each one ahead of time, and the
 * tests fail if a game says anything that is missing from here, so the two can't drift apart.
 *
 * Keep this in step with the games: when a game starts saying something new, add it here
 * (usually by reusing the same helper the game calls).
 */
export function speechCatalog(topics: readonly Topic[] = TOPICS): CatalogEntry[] {
  const entries = new Map<string, CatalogEntry>();
  const add = (takes: number, ...lines: Line[]) => {
    for (const line of lines) {
      const id = clipId(line);
      const known = entries.get(id);
      // Lines that sound the same share a clip; keep the most takes anyone asked for.
      if (!known || known.takes < takes) entries.set(id, { line: known?.line ?? line, takes });
    }
  };

  add(TAKES.often, ...PRAISE);
  add(TAKES.sometimes, ...CARD_GAME_FINALES);

  for (const topic of topics) {
    add(TAKES.sometimes, topic.greeting);
    if (topic.kind === 'cards') {
      for (const { deck } of topic.levels) {
        add(TAKES.often, deck.askPrompt);
        for (const card of deck.cards) {
          add(TAKES.sometimes, deck.findPrompt(card));
          add(TAKES.rarely, namedCard(card), ...deck.describe(card));
        }
      }
    } else {
      const highest = Math.max(...topic.levels.map((level) => level.max));
      add(TAKES.often, ALL_COUNTED, TRY_AGAIN);
      add(TAKES.sometimes, SLOW_DOWN);
      for (const n of range(1, highest)) {
        add(TAKES.constantly, countWord(n));
        add(TAKES.sometimes, notThisMany(n));
      }
      for (const story of topic.stories) {
        add(TAKES.sometimes, storyEnding(story));
        for (const scene of story.scenes) {
          add(TAKES.sometimes, countingQuestion(scene), countTogether(scene), line(scene.cheer));
          for (const n of range(1, highest)) add(TAKES.rarely, countedItems(scene, n));
        }
      }
    }
  }

  return [...entries.values()];
}
