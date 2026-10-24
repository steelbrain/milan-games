/** Tiny persistence layer for preferences. Values are JSON; failures read as "missing". */
export interface Store {
  readonly read: (key: string) => unknown;
  readonly write: (key: string, value: unknown) => void;
}

export function createWebStore(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  namespace = 'milan-games',
): Store {
  const fullKey = (key: string) => `${namespace}:${key}`;
  return {
    read(key) {
      try {
        const raw = storage?.getItem(fullKey(key));
        return raw == null ? undefined : (JSON.parse(raw) as unknown);
      } catch {
        return undefined;
      }
    },
    write(key, value) {
      try {
        storage?.setItem(fullKey(key), JSON.stringify(value));
      } catch {
        // Private browsing or a full quota: preferences just won't stick.
      }
    },
  };
}

/** localStorage, or undefined where touching it throws (sandboxed iframes, some privacy modes). */
export function browserLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function createMemoryStore(initial: Record<string, unknown> = {}): Store {
  const values = new Map(Object.entries(initial));
  return {
    read: (key) => values.get(key),
    write: (key, value) => {
      values.set(key, value);
    },
  };
}
