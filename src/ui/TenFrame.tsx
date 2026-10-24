import { range } from '../core/random';
import { cx } from './cx';
import styles from './TenFrame.module.css';

/**
 * Dots in frames of ten (two rows of five), the way preschools show quantities: it makes
 * "7 is 5 and 2 more" visible at a glance.
 */
export function TenFrame({ count }: { count: number }) {
  const frames = Math.max(1, Math.ceil(count / 10));
  return (
    <div
      className={styles.frames}
      role="img"
      aria-label={`${count} ${count === 1 ? 'dot' : 'dots'}`}
    >
      {range(0, frames - 1).map((frame) => (
        <div key={frame} className={styles.frame}>
          {range(1, 10).map((cell) => {
            const filled = frame * 10 + cell <= count;
            return (
              <span
                key={cell}
                className={cx(styles.cell, filled && styles.filled)}
                style={{ animationDelay: `${(frame * 10 + cell) * 60}ms` }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
