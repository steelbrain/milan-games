import { useAudio } from '../services/audio';
import styles from './TopBar.module.css';

export function MuteToggle() {
  const { muted, setMuted } = useAudio();
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={muted}
      onClick={() => setMuted(!muted)}
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}
