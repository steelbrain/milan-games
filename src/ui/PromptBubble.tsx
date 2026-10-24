import type { ReactNode } from 'react';
import styles from './PromptBubble.module.css';

interface PromptBubbleProps {
  readonly caption: string;
  readonly onReplay: () => void;
  /** Optional character "saying" the line. */
  readonly speaker?: ReactNode;
}

/** The current question, written down for grown-ups, with a button to hear it again. */
export function PromptBubble({ caption, onReplay, speaker }: PromptBubbleProps) {
  return (
    <div className={styles.row}>
      {speaker !== undefined && (
        <div className={styles.speaker} aria-hidden="true">
          {speaker}
        </div>
      )}
      <div className={styles.bubble}>
        <p className={styles.text} aria-live="polite">
          {caption}
        </p>
        <button
          type="button"
          className={styles.replay}
          aria-label="Say it again"
          onClick={onReplay}
        >
          <span aria-hidden="true">🔊</span>
        </button>
      </div>
    </div>
  );
}
