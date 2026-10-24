import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { PLAYER_NAME } from '../app/config';
import { useAudio } from '../services/audio';
import { paths, TOPICS } from '../topics/topics';
import { Screen } from '../ui/Screen';
import { tintStyle } from '../ui/theme';
import { TopBar } from '../ui/TopBar';
import styles from './HomeScreen.module.css';

export function HomeScreen() {
  const { play } = useAudio();
  return (
    <Screen>
      <TopBar />
      <h1 className={styles.title}>
        <span className={styles.wave} aria-hidden="true">
          👋
        </span>{' '}
        Hi {PLAYER_NAME}! Let&apos;s play!
      </h1>
      <nav aria-label="Games" className={styles.nav}>
        <ul className={styles.grid}>
          {TOPICS.map((topic, order) => (
            <li key={topic.id}>
              <Link
                to={paths.topic(topic.id)}
                className={styles.tile}
                style={{ ...tintStyle(topic.tint), '--order': order } as CSSProperties}
                onClick={() => play('tap')}
              >
                <span className={styles.emoji} aria-hidden="true">
                  {topic.emoji}
                </span>
                <span className={styles.label}>{topic.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Screen>
  );
}
