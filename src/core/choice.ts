/**
 * Multiple-choice answering, shared by every "pick the right one" game. Wrong picks are
 * remembered so they can be greyed out; the round is solved by the first right pick. A game can
 * also end the round after a number of wrong picks: it is then missed, and the answer is shown.
 */
export interface ChoiceState<T> {
  readonly wrong: readonly T[];
  readonly solved: boolean;
  /** Too many wrong picks: the round is over without being won. */
  readonly missed: boolean;
}

export type ChoiceOutcome = 'correct' | 'wrong' | 'missed' | 'ignored';

/** `answer` is the right choice shown after a missed round, without the cheering of `correct`. */
export type ChoiceStatus = 'idle' | 'correct' | 'answer' | 'wrong' | 'faded';

/**
 * A wrong pick misses the round: no star, and the game shows the right answer. The games still
 * handle a higher limit, where each wrong pick before the last one gets a gentle "try again".
 */
export const WRONG_PICKS_TO_MISS = 1;

export interface ChooseOptions {
  /** The wrong pick that makes this many misses the round. Unlimited by default. */
  readonly missAfter?: number;
}

export function initialChoiceState<T>(): ChoiceState<T> {
  return { wrong: [], solved: false, missed: false };
}

export function choose<T>(
  state: ChoiceState<T>,
  answer: T,
  choice: T,
  { missAfter = Infinity }: ChooseOptions = {},
): { state: ChoiceState<T>; outcome: ChoiceOutcome } {
  if (state.solved || state.missed || state.wrong.includes(choice)) {
    return { state, outcome: 'ignored' };
  }
  if (choice === answer) return { state: { ...state, solved: true }, outcome: 'correct' };
  const wrong = [...state.wrong, choice];
  if (wrong.length >= missAfter)
    return { state: { ...state, wrong, missed: true }, outcome: 'missed' };
  return { state: { ...state, wrong }, outcome: 'wrong' };
}

export function choiceStatus<T>(state: ChoiceState<T>, answer: T, choice: T): ChoiceStatus {
  if (choice === answer && state.solved) return 'correct';
  if (choice === answer && state.missed) return 'answer';
  if (state.wrong.includes(choice)) return 'wrong';
  return state.solved || state.missed ? 'faded' : 'idle';
}
