import type { RoundResult } from '../core/session';
import { range } from '../core/random';
import { cx } from './cx';
import styles from './StarProgress.module.css';

/** One star per round: gold once earned, grey if the round was missed, an outline until then. */
export function StarProgress({
  results,
  total,
}: {
  results: readonly RoundResult[];
  total: number;
}) {
  const earned = results.filter((result) => result === 'star').length;
  return (
    <div className={styles.stars} role="img" aria-label={`${earned} of ${total} stars`}>
      {range(0, total - 1).map((n) => {
        const result = results[n];
        return (
          <span
            key={n}
            className={cx(
              styles.star,
              result === 'star' && styles.earned,
              result === 'missed' && styles.missed,
            )}
            data-result={result ?? 'ahead'}
          >
            {result ? '⭐' : '☆'}
          </span>
        );
      })}
    </div>
  );
}
