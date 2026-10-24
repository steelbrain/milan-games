import type { ReactNode } from 'react';
import { MuteToggle } from './MuteToggle';
import styles from './TopBar.module.css';

interface TopBarProps {
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly backIcon?: string;
  /** Shown on the left when there is no back button. */
  readonly leading?: ReactNode;
  readonly children?: ReactNode;
}

export function TopBar({
  onBack,
  backLabel = 'Back',
  backIcon = '⬅️',
  leading,
  children,
}: TopBarProps) {
  return (
    <header className={styles.bar}>
      {onBack ? (
        <button type="button" className={styles.iconButton} aria-label={backLabel} onClick={onBack}>
          <span aria-hidden="true">{backIcon}</span>
        </button>
      ) : (
        (leading ?? <span className={styles.spacer} />)
      )}
      <div className={styles.middle}>{children}</div>
      <MuteToggle />
    </header>
  );
}
