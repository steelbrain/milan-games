import { useCallback, useState } from 'react';
import {
  advance,
  currentRound,
  isLastRound,
  type Session,
  solveRound,
  starsEarned,
  startSession,
} from './session';

export interface GameSession<R> {
  readonly round: R;
  /** Changes whenever a new round starts, including after a restart. Use it as a React key. */
  readonly roundKey: string;
  readonly stars: number;
  readonly total: number;
  readonly roundSolved: boolean;
  readonly isLastRound: boolean;
  readonly complete: boolean;
  readonly solve: () => void;
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
  const next = useCallback(() => {
    setState((s) => ({ ...s, session: advance(s.session) }));
  }, []);
  const restart = () => {
    setState((s) => ({ session: startSession(createRounds()), generation: s.generation + 1 }));
  };

  return {
    round: currentRound(session),
    roundKey: `${generation}:${session.index}`,
    stars: starsEarned(session),
    total: session.rounds.length,
    roundSolved: session.roundSolved,
    isLastRound: isLastRound(session),
    complete: session.complete,
    solve,
    next,
    restart,
  };
}
