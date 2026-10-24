import { describe, expect, it } from 'vitest';
import { browserLocalStorage, createMemoryStore, createWebStore } from './storage';

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('createWebStore', () => {
  it('round-trips JSON under a namespace', () => {
    const storage = fakeStorage();
    const store = createWebStore(storage, 'test');
    store.write('level', { id: '10' });
    expect(storage.values.get('test:level')).toBe('{"id":"10"}');
    expect(store.read('level')).toEqual({ id: '10' });
  });

  it('reads missing or corrupt values as undefined', () => {
    const storage = fakeStorage();
    storage.values.set('test:bad', '{nope');
    const store = createWebStore(storage, 'test');
    expect(store.read('missing')).toBeUndefined();
    expect(store.read('bad')).toBeUndefined();
  });

  it('shrugs off storage that throws or is missing', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(createWebStore(throwing).read('x')).toBeUndefined();
    expect(() => createWebStore(throwing).write('x', 1)).not.toThrow();
    expect(createWebStore(undefined).read('x')).toBeUndefined();
  });

  it('finds localStorage in the browser', () => {
    expect(browserLocalStorage()).toBe(globalThis.localStorage);
  });
});

describe('createMemoryStore', () => {
  it('keeps values in memory', () => {
    const store = createMemoryStore({ muted: true });
    expect(store.read('muted')).toBe(true);
    store.write('muted', false);
    expect(store.read('muted')).toBe(false);
  });
});
