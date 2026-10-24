import { Fragment, type ReactNode } from 'react';
import type { Line } from '../content/line';
import type { GameSession } from '../core/useGameSession';
import styles from './GameFrame.module.css';
import { SessionComplete } from './SessionComplete';
import { StarProgress } from './StarProgress';
import { TopBar } from './TopBar';
import { useExit } from './useExit';

interface GameFrameProps<R> {
  readonly session: GameSession<R>;
  readonly exitTo: string;
  /** Characters for the "You did it!" screen; each finished game shows one of them. */
  readonly heroes: readonly string[];
  /** What it might say; each finished game says one of them. */
  readonly finales: readonly Line[];
  /** Renders one round. Each round is remounted fresh, so its local state starts clean. */
  readonly children: (round: R) => ReactNode;
}

/** The chrome every game shares: back button, star progress, and the end-of-game party. */
export function GameFrame<R>({ session, exitTo, heroes, finales, children }: GameFrameProps<R>) {
  const exit = useExit(exitTo);
  return (
    <div className={styles.frame}>
      <TopBar onBack={exit}>
        <StarProgress earned={session.stars} total={session.total} />
      </TopBar>
      <main className={styles.main}>
        {session.complete ? (
          <SessionComplete
            heroes={heroes}
            finales={finales}
            stars={session.total}
            onPlayAgain={session.restart}
            onDone={exit}
          />
        ) : (
          <Fragment key={session.roundKey}>{children(session.round)}</Fragment>
        )}
      </main>
    </div>
  );
}
