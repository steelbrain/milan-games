import type { CSSProperties } from 'react';
import { range } from '../core/random';
import styles from './Burst.module.css';

const COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#8e44c9', '#f77f00'];

/** A confetti pop from the middle of the parent. Purely decorative. */
export function Burst({ pieces = 18, reach = 90 }: { pieces?: number; reach?: number }) {
  return (
    <span className={styles.burst} aria-hidden="true" data-testid="burst">
      {range(0, pieces - 1).map((i) => (
        <span
          key={i}
          className={styles.piece}
          style={
            {
              '--angle': `${(360 / pieces) * i}deg`,
              '--distance': `${reach + (i % 3) * (reach / 3)}px`,
              '--color': COLORS[i % COLORS.length],
              '--delay': `${(i % 4) * 30}ms`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
