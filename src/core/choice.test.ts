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
  });
});
