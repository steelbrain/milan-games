import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGameSession } from './useGameSession';

describe('useGameSession', () => {
  it('walks through the rounds and completes', () => {
    const { result } = renderHook(() => useGameSession(() => ['a', 'b']));
    expect(result.current.round).toBe('a');
    expect(result.current.total).toBe(2);
    expect(result.current.isLastRound).toBe(false);

    act(() => result.current.solve());
    expect(result.current.stars).toBe(1);
    expect(result.current.roundSolved).toBe(true);

    act(() => result.current.next());
    expect(result.current.round).toBe('b');
    expect(result.current.isLastRound).toBe(true);

    act(() => result.current.solve());
    act(() => result.current.next());
    expect(result.current.complete).toBe(true);
    expect(result.current.stars).toBe(2);
  });

  it('does not skip unsolved rounds', () => {
    const { result } = renderHook(() => useGameSession(() => ['a', 'b']));
    act(() => result.current.next());
    expect(result.current.round).toBe('a');
  });

  it('restarts with freshly created rounds and a new round key', () => {
    let calls = 0;
    const createRounds = vi.fn(() => [`set ${++calls}`]);
    const { result } = renderHook(() => useGameSession(createRounds));
    const firstKey = result.current.roundKey;

    act(() => result.current.solve());
    act(() => result.current.next());
    expect(result.current.complete).toBe(true);

    act(() => result.current.restart());
    expect(result.current.complete).toBe(false);
    expect(result.current.stars).toBe(0);
    expect(result.current.round).toBe('set 2');
    expect(result.current.roundKey).not.toBe(firstKey);
    expect(createRounds).toHaveBeenCalledTimes(2);
  });
});
