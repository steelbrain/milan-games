import { afterEach, describe, expect, it } from 'vitest';
import { blockZoom } from './zoom';

/** Dispatches `event` on the body and returns whether the page stopped the browser's default. */
function blocked(event: Event): boolean {
  document.body.dispatchEvent(event);
  return event.defaultPrevented;
}

const init = { bubbles: true, cancelable: true } as const;

describe('blockZoom', () => {
  let stop = () => {};
  afterEach(() => stop());

  it('stops a pinch in Safari', () => {
    stop = blockZoom(document);
    expect(blocked(new Event('gesturestart', init))).toBe(true);
    expect(blocked(new Event('gesturechange', init))).toBe(true);
  });

  it('stops a trackpad pinch and Ctrl + scroll wheel, but not scrolling', () => {
    stop = blockZoom(document);
    expect(blocked(new WheelEvent('wheel', { ...init, ctrlKey: true, deltaY: -10 }))).toBe(true);
    expect(blocked(new WheelEvent('wheel', { ...init, deltaY: -10 }))).toBe(false);
  });

  it('stops the zoom keys, but lets ⌘0 reset the zoom', () => {
    stop = blockZoom(document);
    const key = (key: string, mods: KeyboardEventInit) =>
      blocked(new KeyboardEvent('keydown', { ...init, key, ...mods }));
    expect(key('=', { metaKey: true })).toBe(true);
    expect(key('+', { ctrlKey: true })).toBe(true);
    expect(key('-', { metaKey: true })).toBe(true);
    expect(key('_', { ctrlKey: true })).toBe(true);
    expect(key('0', { metaKey: true })).toBe(false);
    expect(key('=', {})).toBe(false);
  });

  it('can be removed', () => {
    stop = blockZoom(document);
    stop();
    expect(blocked(new Event('gesturestart', init))).toBe(false);
    expect(blocked(new WheelEvent('wheel', { ...init, ctrlKey: true }))).toBe(false);
    expect(blocked(new KeyboardEvent('keydown', { ...init, key: '=', metaKey: true }))).toBe(false);
  });
});
