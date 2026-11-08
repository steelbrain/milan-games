/**
 * A game session is a fixed list of rounds played in order. Every round must be over before
 * moving on. A round is usually over once it is solved, which earns its star; a game may also
 * end a round as missed (after two wrong picks), which leaves its star empty.
 */
export type RoundResult = 'star' | 'missed';

export interface Session<R> {
  readonly rounds: readonly R[];
  readonly index: number;
  /** How each round went, in order. The current round has one once it is over. */
  readonly results: readonly RoundResult[];
  readonly complete: boolean;
}

export function startSession<R>(rounds: readonly R[]): Session<R> {
  if (rounds.length === 0) throw new RangeError('A session needs at least one round');
  return { rounds, index: 0, results: [], complete: false };
}

export function currentRound<R>(session: Session<R>): R {
  return session.rounds[session.index] as R;
}

export function isRoundOver<R>(session: Session<R>): boolean {
  return session.results.length > session.index;
}

/** Ends the current round with `result`. A round that is already over keeps its result. */
export function endRound<R>(session: Session<R>, result: RoundResult): Session<R> {
  if (session.complete || isRoundOver(session)) return session;
  return { ...session, results: [...session.results, result] };
}

export function solveRound<R>(session: Session<R>): Session<R> {
  return endRound(session, 'star');
}

export function missRound<R>(session: Session<R>): Session<R> {
  return endRound(session, 'missed');
}

/** Moves to the next round, or completes the session after the last one. */
export function advance<R>(session: Session<R>): Session<R> {
  if (session.complete || !isRoundOver(session)) return session;
  if (session.index + 1 >= session.rounds.length) return { ...session, complete: true };
  return { ...session, index: session.index + 1 };
}

export function starsEarned<R>(session: Session<R>): number {
  return session.results.filter((result) => result === 'star').length;
}

/** Whether all `total` rounds are over and every one earned its star. */
export function earnedEveryStar(results: readonly RoundResult[], total: number): boolean {
  return results.length === total && results.every((result) => result === 'star');
}

export function isLastRound<R>(session: Session<R>): boolean {
  return session.index === session.rounds.length - 1;
}
