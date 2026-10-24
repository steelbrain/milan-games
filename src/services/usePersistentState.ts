import { useCallback, useState } from 'react';
import { useServices } from './services';

/** State that survives reloads. Stored values that fail `isValid` fall back to `fallback`. */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): readonly [T, (value: T) => void] {
  const { store } = useServices();
  const [value, setValue] = useState<T>(() => {
    const stored = store.read(key);
    return isValid(stored) ? stored : fallback;
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      store.write(key, next);
    },
    [key, store],
  );
  return [value, update] as const;
}
