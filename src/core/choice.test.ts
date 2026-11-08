import { describe, expect, it } from 'vitest';
import { choiceStatus, choose, initialChoiceState } from './choice';

describe('choose', () => {
  it('solves on the right answer', () => {
    const { state, outcome } = choose(initialChoiceState<string>(), 'b', 'b');
    expect(outcome).toBe('correct');
    expect(state.solved).toBe(true);
  });

  it('remembers wrong answers and ignores repeats of them', () => {
    const first = choose(initialChoiceState<string>(), 'b', 'a');
    expect(first.outcome).toBe('wrong');
    expect(first.state.wrong).toEqual(['a']);
    const again = choose(first.state, 'b', 'a');
    expect(again.outcome).toBe('ignored');
    expect(again.state).toBe(first.state);
  });

  it('misses the round on the wrong pick that reaches the limit', () => {
    const options = { missAfter: 2 };
    const first = choose(initialChoiceState<number>(), 3, 1, options);
    expect(first.outcome).toBe('wrong');
    expect(first.state.missed).toBe(false);
    const second = choose(first.state, 3, 2, options);
    expect(second.outcome).toBe('missed');
    expect(second.state).toEqual({ wrong: [1, 2], solved: false, missed: true });
    // The answer can't be won by elimination after that.
    expect(choose(second.state, 3, 3, options).outcome).toBe('ignored');
  });

  it('never misses without a limit', () => {
    let state = initialChoiceState<number>();
    for (const n of [1, 2, 4, 5]) state = choose(state, 3, n).state;
    expect(state.missed).toBe(false);
    expect(choose(state, 3, 3).outcome).toBe('correct');
  });

  it('ignores everything once solved', () => {
    const solved = choose(initialChoiceState<number>(), 3, 3).state;
    expect(choose(solved, 3, 4).outcome).toBe('ignored');
    expect(choose(solved, 3, 3).outcome).toBe('ignored');
  });
});

describe('choiceStatus', () => {
  it('describes each tile', () => {
    const afterWrong = choose(initialChoiceState<string>(), 'b', 'a').state;
    expect(choiceStatus(afterWrong, 'b', 'a')).toBe('wrong');
    expect(choiceStatus(afterWrong, 'b', 'b')).toBe('idle');
    expect(choiceStatus(afterWrong, 'b', 'c')).toBe('idle');

    const solved = choose(afterWrong, 'b', 'b').state;
    expect(choiceStatus(solved, 'b', 'b')).toBe('correct');
    expect(choiceStatus(solved, 'b', 'a')).toBe('wrong');
    expect(choiceStatus(solved, 'b', 'c')).toBe('faded');

    const missed = choose(afterWrong, 'b', 'c', { missAfter: 2 }).state;
    expect(choiceStatus(missed, 'b', 'b')).toBe('answer');
    expect(choiceStatus(missed, 'b', 'a')).toBe('wrong');
    expect(choiceStatus(missed, 'b', 'c')).toBe('wrong');
    expect(choiceStatus(missed, 'b', 'd')).toBe('faded');
  });
});
