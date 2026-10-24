import { useCallback, useState } from 'react';
import { cx } from '../ui/cx';
import topBar from '../ui/TopBar.module.css';
import styles from './Offline.module.css';
import { OfflineSheet } from './OfflineSheet';
import { type OfflineStatus, percentSaved } from './offlineSaver';
import { useOfflineStatus } from './useOfflineStatus';

interface Badge {
  readonly text: string;
  readonly tone: 'busy' | 'done' | 'attention';
}

/** The little sign on the button: progress, all saved, or something waiting for a tap. */
function badgeFor(status: OfflineStatus): Badge | undefined {
  switch (status.phase) {
    case 'downloading':
    case 'waiting':
      return { text: `${percentSaved(status)}%`, tone: 'busy' };
    case 'saved':
      return { text: '✓', tone: 'done' };
    case 'outdated':
      return { text: '↻', tone: 'attention' };
    case 'failed':
      return { text: '!', tone: 'attention' };
    default:
      return undefined;
  }
}

/** The 💾 button on the home screen. It shows download progress and opens the offline sheet. */
export function OfflineButton() {
  const status = useOfflineStatus();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (status.phase === 'unsupported') return <span className={topBar.spacer} />;
  const badge = badgeFor(status);
  return (
    <>
      <button
        type="button"
        className={cx(topBar.iconButton, styles.button)}
        aria-label="Play offline"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">💾</span>
        {badge && (
          <span className={cx(styles.badge, styles[badge.tone])} aria-hidden="true">
            {badge.text}
          </span>
        )}
      </button>
      {open && <OfflineSheet onClose={close} />}
    </>
  );
}
