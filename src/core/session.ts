/**
 * A game session is a fixed list of rounds played in order. Every round must be solved before
 * moving on (little players are never "failed"; they keep trying until they get it), and each
 * solved round earns a star.
 */
export interface Session<R> {
  readonly rounds: readonly R[];
  readonly index: number;
  readonly roundSolved: boolean;
  readonly complete: boolean;
}

export function startSession<R>(rounds: readonly R[]): Session<R> {
  if (rounds.length === 0) throw new RangeError('A session needs at least one round');
  return { rounds, index: 0, roundSolved: false, complete: false };
}

export function currentRound<R>(session: Session<R>): R {
  return session.rounds[session.index] as R;
}

export function solveRound<R>(session: Session<R>): Session<R> {
  if (session.complete || session.roundSolved) return session;
  return { ...session, roundSolved: true };
}

/** Moves to the next round, or completes the session after the last one. */
export function advance<R>(session: Session<R>): Session<R> {
  if (session.complete || !session.roundSolved) return session;
  if (session.index + 1 >= session.rounds.length) return { ...session, complete: true };
  return { ...session, index: session.index + 1, roundSolved: false };
}

export function starsEarned<R>(session: Session<R>): number {
  return session.index + (session.roundSolved ? 1 : 0);
}

export function isLastRound<R>(session: Session<R>): boolean {
  return session.index === session.rounds.length - 1;
}
