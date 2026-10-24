import { useSyncExternalStore } from 'react';
import { useServices } from '../services/services';
import type { OfflineStatus } from './offlineSaver';

export function useOfflineStatus(): OfflineStatus {
  const { offline } = useServices();
  return useSyncExternalStore(offline.subscribe, offline.status);
}

export function percentSaved({ saved, total }: OfflineStatus): number {
  return total > 0 ? Math.floor((saved * 100) / total) : 0;
}
