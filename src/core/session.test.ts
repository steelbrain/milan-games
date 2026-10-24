import { describe, expect, it } from 'vitest';
import {
  advance,
  currentRound,
  isLastRound,
  solveRound,
  starsEarned,
  startSession,
} from './session';

describe('session', () => {
  it('starts at the first round with no stars', () => {
    const session = startSession(['a', 'b']);
    expect(currentRound(session)).toBe('a');
    expect(starsEarned(session)).toBe(0);
    expect(session.complete).toBe(false);
  });

  it('needs at least one round', () => {
    expect(() => startSession([])).toThrow(RangeError);
  });

  it('earns a star when a round is solved', () => {
    const solved = solveRound(startSession(['a', 'b']));
    expect(solved.roundSolved).toBe(true);
    expect(starsEarned(solved)).toBe(1);
    expect(solveRound(solved)).toBe(solved);
  });

  it('only moves on once the round is solved', () => {
    const session = startSession(['a', 'b']);
    expect(advance(session)).toBe(session);
    const next = advance(solveRound(session));
    expect(currentRound(next)).toBe('b');
    expect(next.roundSolved).toBe(false);
    expect(starsEarned(next)).toBe(1);
  });

  it('completes after the last round, keeping every star', () => {
    let session = startSession(['a', 'b']);
    session = advance(solveRound(session));
    expect(isLastRound(session)).toBe(true);
    session = advance(solveRound(session));
    expect(session.complete).toBe(true);
    expect(starsEarned(session)).toBe(2);
    expect(advance(session)).toBe(session);
    expect(solveRound(session)).toBe(session);
  });
});
