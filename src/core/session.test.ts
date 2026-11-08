import { describe, expect, it } from 'vitest';
import {
  advance,
  currentRound,
  earnedEveryStar,
  isLastRound,
  isRoundOver,
  missRound,
  solveRound,
  starsEarned,
  startSession,
} from './session';

describe('session', () => {
  it('starts at the first round with no stars', () => {
    const session = startSession(['a', 'b']);
    expect(currentRound(session)).toBe('a');
    expect(starsEarned(session)).toBe(0);
    expect(session.results).toEqual([]);
    expect(session.complete).toBe(false);
  });

  it('needs at least one round', () => {
    expect(() => startSession([])).toThrow(RangeError);
  });

  it('earns a star when a round is solved', () => {
    const solved = solveRound(startSession(['a', 'b']));
    expect(isRoundOver(solved)).toBe(true);
    expect(solved.results).toEqual(['star']);
    expect(starsEarned(solved)).toBe(1);
    expect(solveRound(solved)).toBe(solved);
  });

  it('earns nothing for a missed round, and keeps the first result', () => {
    const missed = missRound(startSession(['a', 'b']));
    expect(isRoundOver(missed)).toBe(true);
    expect(missed.results).toEqual(['missed']);
    expect(starsEarned(missed)).toBe(0);
    expect(solveRound(missed)).toBe(missed);
    expect(missRound(solveRound(startSession(['a'])))).toEqual(solveRound(startSession(['a'])));
  });

  it('only moves on once the round is over', () => {
    const session = startSession(['a', 'b']);
    expect(advance(session)).toBe(session);
    const next = advance(solveRound(session));
    expect(currentRound(next)).toBe('b');
    expect(isRoundOver(next)).toBe(false);
    expect(starsEarned(next)).toBe(1);
    expect(currentRound(advance(missRound(session)))).toBe('b');
  });

  it('knows when every star was earned', () => {
    expect(earnedEveryStar(['star', 'star'], 2)).toBe(true);
    expect(earnedEveryStar(['star', 'missed'], 2)).toBe(false);
    expect(earnedEveryStar(['star'], 2)).toBe(false);
  });

  it('completes after the last round, keeping every result', () => {
    let session = startSession(['a', 'b', 'c']);
    session = advance(solveRound(session));
    session = advance(missRound(session));
    expect(isLastRound(session)).toBe(true);
    session = advance(solveRound(session));
    expect(session.complete).toBe(true);
    expect(session.results).toEqual(['star', 'missed', 'star']);
    expect(starsEarned(session)).toBe(2);
    expect(advance(session)).toBe(session);
    expect(solveRound(session)).toBe(session);
    expect(missRound(session)).toBe(session);
  });
});
