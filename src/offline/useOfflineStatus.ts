import { useSyncExternalStore } from 'react';
import { useServices } from '../services/services';
import type { OfflineStatus } from './offlineSaver';

export function useOfflineStatus(): OfflineStatus {
  const { offline } = useServices();
  return useSyncExternalStore(offline.subscribe, offline.status);
}
