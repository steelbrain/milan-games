import type { CardExample as Example } from '../content/cards';
import styles from './CardExample.module.css';
import { TenFrame } from './TenFrame';

/** "🏀 Ball", or a ten frame for numbers: what a card means, shown once it is named. */
export function CardExample({ example }: { example: Example }) {
  if (example.kind === 'quantity') {
    return (
      <div className={styles.example}>
        <TenFrame count={example.count} />
      </div>
    );
  }
  return (
    <figure className={styles.example}>
      <span className={styles.emoji} aria-hidden="true">
        {example.emoji}
      </span>
      <figcaption className={styles.word}>{example.word}</figcaption>
    </figure>
  );
}
