import { useCallback, useState } from 'react';
import {
  advance,
  currentRound,
  isLastRound,
  isRoundOver,
  missRound,
  type RoundResult,
  type Session,
  solveRound,
  starsEarned,
  startSession,
} from './session';

export interface GameSession<R> {
  readonly round: R;
  /** Changes whenever a new round starts, including after a restart. Use it as a React key. */
  readonly roundKey: string;
  /** How each finished round went, in order, for the star bar. */
  readonly results: readonly RoundResult[];
  readonly stars: number;
  readonly total: number;
  readonly roundOver: boolean;
  readonly isLastRound: boolean;
  readonly complete: boolean;
  /** Ends the round with its star. */
  readonly solve: () => void;
  /** Ends the round without its star. */
  readonly miss: () => void;
  readonly next: () => void;
  readonly restart: () => void;
}

interface State<R> {
  readonly session: Session<R>;
  /** Bumped on restart so rounds remount even when the index is the same. */
  readonly generation: number;
}

export function useGameSession<R>(createRounds: () => readonly R[]): GameSession<R> {
  const [state, setState] = useState<State<R>>(() => ({
    session: startSession(createRounds()),
    generation: 0,
  }));
  const { session, generation } = state;

  const solve = useCallback(() => {
    setState((s) => ({ ...s, session: solveRound(s.session) }));
  }, []);
  const miss = useCallback(() => {
    setState((s) => ({ ...s, session: missRound(s.session) }));
  }, []);
  const next = useCallback(() => {
    setState((s) => ({ ...s, session: advance(s.session) }));
  }, []);
  const restart = () => {
    setState((s) => ({ session: startSession(createRounds()), generation: s.generation + 1 }));
  };

  return {
    round: currentRound(session),
    roundKey: `${generation}:${session.index}`,
    results: session.results,
    stars: starsEarned(session),
    total: session.rounds.length,
    roundOver: isRoundOver(session),
    isLastRound: isLastRound(session),
    complete: session.complete,
    solve,
    miss,
    next,
    restart,
  };
}
