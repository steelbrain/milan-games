import { useEffect, useId, useRef, useState } from 'react';
import { useServices } from '../services/services';
import { BigButton } from '../ui/BigButton';
import styles from './Offline.module.css';
import { type OfflinePhase, type OfflineStatus, percentSaved } from './offlineSaver';
import { useOfflineStatus } from './useOfflineStatus';

/** The speech plus the app itself (about half a megabyte), rounded up; never split over lines. */
const DOWNLOAD_SIZE = `${Math.ceil(__SPEECH_BYTES__ / 1_000_000) + 1}\u00a0MB`;

/** Roughly the space `files` of the `total` recordings take up; never split over lines. */
function sizeOf(files: number, total: number): string {
  const bytes = total > 0 ? (__SPEECH_BYTES__ * files) / total : 0;
  return `${Math.max(1, Math.ceil(bytes / 1_000_000))}\u00a0MB`;
}

const fileCount = (files: number) => `${files.toLocaleString()} ${files === 1 ? 'file' : 'files'}`;

/** When there's a download to remove (and nothing busy with it). */
const REMOVABLE: ReadonlySet<OfflinePhase> = new Set(['idle', 'outdated', 'saved', 'failed']);

interface Copy {
  readonly message: string;
  readonly progress: boolean;
  readonly action?: { readonly label: string; readonly icon: string; readonly does: Action };
}

type Action = 'start' | 'stop' | 'close';

function copyFor(status: OfflineStatus): Copy {
  const pause = { label: 'Pause', icon: '⏸️', does: 'stop' } as const;
  switch (status.phase) {
    case 'unsupported':
      return { message: "This browser can't save the games for offline play.", progress: false };
    case 'checking':
      return { message: "Checking what's saved…", progress: false };
    case 'idle':
      return status.saved === 0
        ? {
            message:
              `Save all the games and voices on this device (${DOWNLOAD_SIZE}), so they work ` +
              'without internet, like on a plane.',
            progress: false,
            action: { label: 'Download', icon: '⬇️', does: 'start' },
          }
        : {
            message: 'Part of it is saved. Download the rest to play offline.',
            progress: true,
            action: { label: 'Keep downloading', icon: '⬇️', does: 'start' },
          };
    case 'outdated': {
      const missing = status.total - status.saved;
      return {
        message:
          'The games have changed since you downloaded them. Update to keep playing offline' +
          (missing > 0 ? ` (${fileCount(missing)}, about ${sizeOf(missing, status.total)}).` : '.'),
        progress: false,
        action: { label: 'Update', icon: '🔄', does: 'start' },
      };
    }
    case 'downloading':
      return {
        message: 'Downloading… You can close this and keep playing while it works.',
        progress: true,
        action: pause,
      };
    case 'waiting':
      return {
        message: 'Waiting for the internet to come back. The download carries on by itself.',
        progress: true,
        action: pause,
      };
    case 'saved':
      return {
        message: 'All saved and up to date! The games work without internet now.',
        progress: true,
        action: { label: 'Done', icon: '👍', does: 'close' },
      };
    case 'removing':
      return { message: 'Removing the download…', progress: false };
    case 'failed':
      return {
        message:
          status.problem === 'space'
            ? 'This device is out of space. Free some up, then try again.'
            : "Some files didn't download. Check the internet connection, then try again.",
        progress: true,
        action: { label: 'Try again', icon: '🔁', does: 'start' },
      };
  }
}

/**
 * iOS keeps a home screen app's storage apart from Safari's, so a download in a Safari tab
 * wouldn't help the installed app.
 */
function inIosSafariTab(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === false;
}

/**
 * Downloads everything for offline play, with progress, pause and retry. Once downloaded, it
 * keeps the copy up to date, and can remove it again.
 */
export function OfflineSheet({ onClose }: { onClose: () => void }) {
  const { offline } = useServices();
  const status = useOfflineStatus();
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);
  const [confirming, setConfirming] = useState(false);

  // Also when switching to and from "Remove?", whose buttons replace the one that had focus.
  useEffect(() => {
    dialog.current?.focus();
  }, [confirming]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = copyFor(status);
  const percent = percentSaved(status);
  const actions: Record<Action, () => void> = {
    start: offline.start,
    stop: offline.stop,
    close: onClose,
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={styles.sheet}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          <span aria-hidden="true">✕</span>
        </button>
        <h2 id={titleId} className={styles.title}>
          <span aria-hidden="true">⬇️</span> Play offline
        </h2>
        {confirming ? (
          <>
            <p className={styles.message}>
              Remove the saved voices ({sizeOf(status.saved, status.total)}) from this device? The
              games will need internet until you download them again.
            </p>
            {/* "Keep" goes last, where "Remove download" was, so a second tap there is harmless. */}
            <div className={styles.choices}>
              <BigButton
                variant="plain"
                icon="🗑️"
                className={styles.danger}
                onClick={() => {
                  void offline.remove();
                  setConfirming(false);
                }}
              >
                Remove
              </BigButton>
              <BigButton icon="👍" onClick={() => setConfirming(false)}>
                Keep them
              </BigButton>
            </div>
          </>
        ) : (
          <>
            <p className={styles.message}>{copy.message}</p>
            {copy.progress && (
              <>
                <div
                  role="progressbar"
                  aria-label="Saved for offline"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  className={styles.track}
                >
                  <div className={styles.fill} style={{ width: `${percent}%` }} />
                </div>
                <p className={styles.count}>
                  {status.saved.toLocaleString()} of {status.total.toLocaleString()} files ·{' '}
                  {percent}%
                </p>
              </>
            )}
            {inIosSafariTab() && status.phase !== 'saved' && (
              <p className={styles.hint}>
                On iPhone or iPad, add the games to your Home Screen first (Share, then Add to Home
                Screen), and download from there.
              </p>
            )}
            {copy.action && (
              <BigButton icon={copy.action.icon} onClick={actions[copy.action.does]}>
                {copy.action.label}
              </BigButton>
            )}
            {status.saved > 0 && REMOVABLE.has(status.phase) && (
              <button type="button" className={styles.remove} onClick={() => setConfirming(true)}>
                Remove download
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
