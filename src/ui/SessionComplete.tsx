import { useEffect, useEffectEvent } from 'react';
import type { Line } from '../content/line';
import { useAnnouncement, useAudio } from '../services/audio';
import { BigButton } from './BigButton';
import { Burst } from './Burst';
import styles from './SessionComplete.module.css';
import { StarProgress } from './StarProgress';

interface SessionCompleteProps {
  readonly hero: string;
  readonly finale: Line;
  readonly stars: number;
  readonly onPlayAgain: () => void;
  readonly onDone: () => void;
}

export function SessionComplete({
  hero,
  finale,
  stars,
  onPlayAgain,
  onDone,
}: SessionCompleteProps) {
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
