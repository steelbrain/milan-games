import { useCallback, useState } from 'react';
import { cx } from '../ui/cx';
import topBar from '../ui/TopBar.module.css';
import styles from './Offline.module.css';
import { OfflineSheet } from './OfflineSheet';
import { percentSaved, useOfflineStatus } from './useOfflineStatus';

/** The ✈️ button on the home screen. It shows download progress and opens the offline sheet. */
export function OfflineButton() {
  const status = useOfflineStatus();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (status.phase === 'unsupported') return <span className={topBar.spacer} />;
  const busy = status.phase === 'downloading' || status.phase === 'waiting';
  return (
    <>
      <button
        type="button"
        className={cx(topBar.iconButton, styles.button)}
        aria-label="Play offline"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">✈️</span>
        {busy && (
          <span className={styles.badge} aria-hidden="true">
            {percentSaved(status)}%
          </span>
        )}
        {status.phase === 'saved' && (
          <span className={cx(styles.badge, styles.done)} aria-hidden="true">
            ✓
          </span>
        )}
      </button>
      {open && <OfflineSheet onClose={close} />}
    </>
  );
}
