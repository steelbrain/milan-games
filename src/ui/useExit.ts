import { useLocation, useNavigate } from 'react-router';

/** Link state for going one level deeper (home → topic → game), so Back can simply go back. */
export const DEEPER = { deeper: true } as const;

/**
 * Leaves this screen for its `parent`. When the parent opened it, that means going back
 * through history, so the browser's or Android's own Back button never returns to the screen
 * just left (and restarts its game). Arriving any other way, say from a bookmark straight into a
 * game, it replaces this screen instead of piling up history.
 */
export function useExit(parent: string): () => void {
  const navigate = useNavigate();
  const state = useLocation().state as Partial<typeof DEEPER> | null;
  const cameFromParent = state?.deeper === true;
  return () => void (cameFromParent ? navigate(-1) : navigate(parent, { replace: true }));
}
