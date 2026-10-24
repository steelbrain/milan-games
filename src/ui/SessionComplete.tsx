import { useEffect, useEffectEvent, useState } from 'react';
import type { Line } from '../content/line';
import { pickOne } from '../core/random';
import { useAnnouncement, useAudio } from '../services/audio';
import { useServices } from '../services/services';
import { BigButton } from './BigButton';
import { Burst } from './Burst';
import styles from './SessionComplete.module.css';
import { StarProgress } from './StarProgress';

interface SessionCompleteProps {
  /** One of these cheers the child on, picked afresh for every finished game. */
  readonly heroes: readonly string[];
  /** Likewise, one of these is said. */
  readonly finales: readonly Line[];
  readonly stars: number;
  readonly onPlayAgain: () => void;
  readonly onDone: () => void;
}

export function SessionComplete({
  heroes,
  finales,
  stars,
  onPlayAgain,
  onDone,
}: SessionCompleteProps) {
  const { random } = useServices();
  const [{ hero, finale }] = useState(() => ({
    hero: pickOne(random, heroes),
    finale: pickOne(random, finales),
  }));
  const { play } = useAudio();
  const celebrate = useEffectEvent(() => play('celebrate'));
  useEffect(() => celebrate(), []);
  useAnnouncement(finale);

  return (
    <section className={styles.complete} aria-labelledby="complete-title">
      <div className={styles.hero} aria-hidden="true">
        {hero}
        <Burst pieces={28} reach={140} />
      </div>
      <h2 id="complete-title" className={styles.title}>
        You did it!
      </h2>
      <p className={styles.finale}>{finale.text}</p>
      <StarProgress earned={stars} total={stars} />
      <div className={styles.actions}>
        <BigButton icon="🔁" onClick={onPlayAgain} pulse>
          Play again
        </BigButton>
        <BigButton icon="🏁" variant="plain" onClick={onDone}>
          All done
        </BigButton>
      </div>
    </section>
  );
}
