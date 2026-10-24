import { Fragment, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { Line } from '../content/line';
import type { GameSession } from '../core/useGameSession';
import styles from './GameFrame.module.css';
import { SessionComplete } from './SessionComplete';
import { StarProgress } from './StarProgress';
import { TopBar } from './TopBar';

interface GameFrameProps<R> {
  readonly session: GameSession<R>;
  readonly exitTo: string;
  /** Character shown on the "You did it!" screen. */
  readonly hero: string;
  readonly finale: Line;
  /** Renders one round. Each round is remounted fresh, so its local state starts clean. */
  readonly children: (round: R) => ReactNode;
}

/** The chrome every game shares: back button, star progress, and the end-of-game party. */
export function GameFrame<R>({ session, exitTo, hero, finale, children }: GameFrameProps<R>) {
  const navigate = useNavigate();
  const exit = () => void navigate(exitTo);
  return (
    <div className={styles.frame}>
      <TopBar onBack={exit}>
        <StarProgress earned={session.stars} total={session.total} />
      </TopBar>
      <main className={styles.main}>
        {session.complete ? (
          <SessionComplete
            hero={hero}
            finale={finale}
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
