import type { Deck } from '../content/cards';
import { BASIC_COLOR_COUNT, createColorDeck } from '../content/colors';
import { createLetterDeck } from '../content/letters';
import { line, type Line } from '../content/line';
import { createNumberDeck } from '../content/numbers';
import { BASIC_SHAPE_COUNT, createShapeDeck } from '../content/shapes';
import { STORIES, type Story } from '../content/stories';

/** A starting option picked before a game begins ("Count to 10", "abc"). */
export interface Level {
  readonly id: string;
  readonly label: string;
}

export interface CardLevel extends Level {
  readonly deck: Deck;
}

export interface CountingLevel extends Level {
  readonly min: number;
  readonly max: number;
  /** Items are scattered over a gridSize × gridSize board. */
  readonly gridSize: number;
}

interface TopicBase {
  readonly id: string;
  readonly title: string;
  readonly emoji: string;
  /** Theme color for the topic's screens. */
  readonly tint: string;
  /** Said when the topic's menu opens. */
  readonly greeting: Line;
  readonly levelQuestion: string;
  readonly activityQuestion: string;
}

/** Topics built from a deck of cards, played as "Find it" or "What is this?". */
export interface CardTopic extends TopicBase {
  readonly kind: 'cards';
  readonly levels: readonly CardLevel[];
}

/** Story-driven counting, where each story is its own game. */
export interface CountingTopic extends TopicBase {
  readonly kind: 'counting';
  readonly levels: readonly CountingLevel[];
  readonly stories: readonly Story[];
}

export type Topic = CardTopic | CountingTopic;

export type CardActivity = 'find' | 'say';

export interface ActivityChoice {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
}

/** What to play, fully resolved from a URL. */
export type Game =
  | { readonly kind: CardActivity; readonly topic: CardTopic; readonly level: CardLevel }
  | {
      readonly kind: 'count';
      readonly topic: CountingTopic;
      readonly level: CountingLevel;
      readonly story: Story;
    };

export const ROUNDS_PER_CARD_GAME = 5;
export const CHOICES_PER_ROUND = 3;

export const TOPICS: readonly Topic[] = [
  {
    kind: 'counting',
    id: 'counting',
    title: 'Counting',
    emoji: '🧮',
    tint: '#f77f00',
    greeting: line("Let's count! Pick a story."),
    levelQuestion: 'How high?',
    activityQuestion: 'Pick a story',
    levels: [
      { id: '5', label: 'Count to 5', min: 1, max: 5, gridSize: 3 },
      { id: '10', label: 'Count to 10', min: 3, max: 10, gridSize: 4 },
      { id: '20', label: 'Count to 20', min: 6, max: 20, gridSize: 5 },
    ],
    stories: STORIES,
  },
  {
    kind: 'cards',
    id: 'letters',
    title: 'Letters',
    emoji: '🔤',
    tint: '#e5386d',
    greeting: line("Let's play with letters!"),
    levelQuestion: 'Big or small letters?',
    activityQuestion: 'Pick a game',
    levels: [
      { id: 'upper', label: 'ABC', deck: createLetterDeck('upper') },
      { id: 'lower', label: 'abc', deck: createLetterDeck('lower') },
    ],
  },
  {
    kind: 'cards',
    id: 'numbers',
    title: 'Numbers',
    emoji: '🔢',
    tint: '#1b8ac4',
    greeting: line("Let's play with numbers!"),
    levelQuestion: 'Which numbers?',
    activityQuestion: 'Pick a game',
    levels: [
      { id: '5', label: '1 to 5', deck: createNumberDeck(1, 5) },
      { id: '10', label: '1 to 10', deck: createNumberDeck(1, 10) },
      { id: '20', label: '1 to 20', deck: createNumberDeck(1, 20) },
    ],
  },
  {
    kind: 'cards',
    id: 'colors',
    title: 'Colors',
    emoji: '🎨',
    tint: '#8e44c9',
    greeting: line("Let's play with colors!"),
    levelQuestion: 'Which colors?',
    activityQuestion: 'Pick a game',
    levels: [
      { id: 'rainbow', label: 'Rainbow', deck: createColorDeck(BASIC_COLOR_COUNT) },
      { id: 'all', label: 'All colors', deck: createColorDeck() },
    ],
  },
  {
    kind: 'cards',
    id: 'shapes',
    title: 'Shapes',
    emoji: '🔺',
    tint: '#0f9d76',
    greeting: line("Let's play with shapes!"),
    levelQuestion: 'Which shapes?',
    activityQuestion: 'Pick a game',
    levels: [
      { id: 'easy', label: 'Easy', deck: createShapeDeck(BASIC_SHAPE_COUNT) },
      { id: 'all', label: 'All shapes', deck: createShapeDeck() },
    ],
  },
];

export function findTopic(id: string | undefined): Topic | undefined {
  return TOPICS.find((topic) => topic.id === id);
}

export function findLevel<L extends Level>(
  levels: readonly L[],
  id: string | undefined,
): L | undefined {
  return levels.find((level) => level.id === id);
}

export function activityChoices(topic: Topic): ActivityChoice[] {
  if (topic.kind === 'counting') {
    return topic.stories.map((story) => ({ id: story.id, label: story.title, emoji: story.hero }));
  }
  const deck = topic.levels[0]?.deck;
  return [
    { id: 'find', label: `Find the ${deck?.noun ?? 'card'}`, emoji: '🔍' },
    { id: 'say', label: deck?.askPrompt.text ?? 'What is this?', emoji: '💬' },
  ];
}

const isCardActivity = (id: string | undefined): id is CardActivity =>
  id === 'find' || id === 'say';

export function resolveGame(
  topicId: string | undefined,
  levelId: string | undefined,
  activityId: string | undefined,
): Game | undefined {
  const topic = findTopic(topicId);
  if (!topic) return undefined;
  if (topic.kind === 'counting') {
    const level = findLevel(topic.levels, levelId);
    const story = topic.stories.find((s) => s.id === activityId);
    return level && story ? { kind: 'count', topic, level, story } : undefined;
  }
  const level = findLevel(topic.levels, levelId);
  return level && isCardActivity(activityId) ? { kind: activityId, topic, level } : undefined;
}

export const paths = {
  home: '/',
  topic: (topicId: string) => `/topic/${topicId}`,
  play: (topicId: string, levelId: string, activityId: string) =>
    `/play/${topicId}/${levelId}/${activityId}`,
};
