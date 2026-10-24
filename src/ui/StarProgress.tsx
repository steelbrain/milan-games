import { range } from '../core/random';
import { cx } from './cx';
import styles from './StarProgress.module.css';

export function StarProgress({ earned, total }: { earned: number; total: number }) {
  return (
    <div className={styles.stars} role="img" aria-label={`${earned} of ${total} stars`}>
      {range(1, total).map((n) => (
        <span key={n} className={cx(styles.star, n <= earned && styles.earned)}>
          {n <= earned ? '⭐' : '☆'}
        </span>
      ))}
    </div>
  );
}
