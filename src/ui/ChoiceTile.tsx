import type { ReactNode } from 'react';
import type { ChoiceStatus } from '../core/choice';
import { Burst } from './Burst';
import { cx } from './cx';
import styles from './ChoiceTile.module.css';

interface ChoiceTileProps {
  readonly label: string;
  readonly status: ChoiceStatus;
  readonly onChoose: () => void;
  readonly children: ReactNode;
}

/** A big square answer button. Wrong picks wiggle and grey out; the right one bursts. */
export function ChoiceTile({ label, status, onChoose, children }: ChoiceTileProps) {
  return (
    <button
      type="button"
      className={cx(styles.tile, styles[status])}
      aria-label={label}
      data-status={status}
      disabled={status === 'wrong' || status === 'faded'}
      onClick={onChoose}
    >
      {children}
      {status === 'correct' && <Burst />}
    </button>
  );
}
