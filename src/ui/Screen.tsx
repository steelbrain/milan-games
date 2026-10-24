import type { ReactNode } from 'react';
import styles from './Screen.module.css';
import { tintStyle } from './theme';

/** A full-viewport page tinted with its topic's color. */
export function Screen({ tint, children }: { tint?: string; children: ReactNode }) {
  return (
    <div className={styles.screen} style={tint ? tintStyle(tint) : undefined}>
      {children}
    </div>
  );
}
