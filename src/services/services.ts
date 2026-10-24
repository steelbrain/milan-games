import { createContext, useContext } from 'react';
import type { Random } from '../core/random';
import type { OfflineSaver } from '../offline/offlineSaver';
import type { Speaker } from './speech';
import type { SoundPlayer } from './sounds';
import type { Store } from './storage';

/**
 * Everything the games need from the outside world. Components get these from context instead
 * of reaching for browser globals, so tests (and other platforms) can swap them out.
 */
export interface Services {
  readonly speaker: Speaker;
  readonly sounds: SoundPlayer;
  readonly random: Random;
  readonly store: Store;
  readonly offline: OfflineSaver;
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <AppProviders>');
  return services;
}
