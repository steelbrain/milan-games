/**
 * Multiple-choice answering, shared by every "pick the right one" game. Wrong picks are
 * remembered so they can be greyed out; the round is solved by the first right pick.
 */
export interface ChoiceState<T> {
  readonly wrong: readonly T[];
  readonly solved: boolean;
}

export type ChoiceOutcome = 'correct' | 'wrong' | 'ignored';

export type ChoiceStatus = 'idle' | 'correct' | 'wrong' | 'faded';

export function initialChoiceState<T>(): ChoiceState<T> {
  return { wrong: [], solved: false };
}

export function choose<T>(
  state: ChoiceState<T>,
  answer: T,
  choice: T,
): { state: ChoiceState<T>; outcome: ChoiceOutcome } {
  if (state.solved || state.wrong.includes(choice)) return { state, outcome: 'ignored' };
  if (choice === answer) return { state: { ...state, solved: true }, outcome: 'correct' };
  return { state: { ...state, wrong: [...state.wrong, choice] }, outcome: 'wrong' };
}

export function choiceStatus<T>(state: ChoiceState<T>, answer: T, choice: T): ChoiceStatus {
  if (state.solved && choice === answer) return 'correct';
  if (state.wrong.includes(choice)) return 'wrong';
  return state.solved ? 'faded' : 'idle';
}
