import type { CSSProperties } from 'react';

/** Sets the topic's theme color for everything inside the element. */
export function tintStyle(tint: string): CSSProperties {
  return { '--tint': tint } as CSSProperties;
}
