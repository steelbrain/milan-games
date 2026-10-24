import type { Card } from '../content/cards';
import { cx } from './cx';
import styles from './CardFace.module.css';
import { Shape } from './Shape';

const BLOB = 'M50 6 C 70 4 92 18 94 42 C 96 64 84 90 58 94 C 34 98 10 86 6 60 C 2 36 26 8 50 6 Z';

/** A big letter or number that fills its container. */
export function Glyph({ text }: { text: string }) {
  return (
    <span className={cx(styles.glyph, text.length > 1 && styles.wide)} aria-hidden="true">
      {text}
    </span>
  );
}

/** Draws a card's face. Sizes itself to the parent, so it works in small tiles and big cards. */
export function CardFace({ card }: { card: Card }) {
  const { visual } = card;
  switch (visual.kind) {
    case 'glyph':
      return <Glyph text={visual.glyph} />;
    case 'color':
      return (
        <span className={cx(styles.picture, styles.paint)} aria-hidden="true">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <path d={BLOB} fill={visual.color} stroke="rgb(0 0 0 / 0.35)" strokeWidth="3" />
          </svg>
        </span>
      );
    case 'shape':
      return (
        <span className={styles.picture} aria-hidden="true">
          <Shape shape={visual.shape} fill="var(--tint)" />
        </span>
      );
  }
}
