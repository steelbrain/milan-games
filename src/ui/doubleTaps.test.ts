import { afterEach, describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, guardDoubleTaps } from './doubleTaps';

/** A tap as the browser reports it: a pointerdown, then a click, at `time` ms and (x, y). */
function tap(
  target: Element,
  {
    time,
    x = 100,
    y = 100,
    pointerType = 'touch',
    detail = 1,
  }: Partial<TapOptions> & {
    time: number;
  },
): boolean {
  const down = new Event('pointerdown', { bubbles: true });
  Object.defineProperty(down, 'pointerType', { value: pointerType });
  target.dispatchEvent(down);
  const click = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    detail,
  });
  Object.defineProperty(click, 'timeStamp', { value: time });
  return target.dispatchEvent(click);
}

interface TapOptions {
  time: number;
  x: number;
  y: number;
  pointerType: string;
  detail: number;
}

describe('guardDoubleTaps', () => {
  let stop = () => {};
  afterEach(() => {
    stop();
    document.body.innerHTML = '';
  });

  /** "Next" is replaced by the next round's "Count with me" as soon as it is tapped. */
  function setup() {
    stop = guardDoubleTaps(document);
    const next = document.createElement('button');
    const countWithMe = document.createElement('button');
    const pressed: string[] = [];
    next.addEventListener('click', () => {
      pressed.push('next');
      next.replaceWith(countWithMe);
    });
    countWithMe.addEventListener('click', () => pressed.push('count with me'));
    document.body.append(next);
    return { next, countWithMe, pressed };
  }

  it('drops the second tap of a double-tap', () => {
    const { next, countWithMe, pressed } = setup();
    tap(next, { time: 1000 });
    expect(tap(countWithMe, { time: 1150, x: 104, y: 98 })).toBe(false);
    expect(pressed).toEqual(['next']);
  });

  it('lets a tap through once the moment has passed', () => {
    const { next, countWithMe, pressed } = setup();
    tap(next, { time: 1000 });
    tap(countWithMe, { time: 1000 + DOUBLE_TAP_MS });
    expect(pressed).toEqual(['next', 'count with me']);
  });

  it('lets quick taps on things further apart through, like counting items', () => {
    const { next, countWithMe, pressed } = setup();
    tap(next, { time: 1000 });
    tap(countWithMe, { time: 1100, x: 160 });
    expect(pressed).toEqual(['next', 'count with me']);
  });

  it('leaves the mouse and keyboard alone', () => {
    const { next, countWithMe, pressed } = setup();
    tap(next, { time: 1000, pointerType: 'mouse' });
    tap(countWithMe, { time: 1100, pointerType: 'mouse' });
    // A key press, or a label handing its click on to its input, reports no tap at all.
    tap(countWithMe, { time: 1150, detail: 0 });
    expect(pressed).toEqual(['next', 'count with me', 'count with me']);
  });

  it('can be removed', () => {
    const { next, countWithMe, pressed } = setup();
    stop();
    tap(next, { time: 1000 });
    tap(countWithMe, { time: 1100 });
    expect(pressed).toEqual(['next', 'count with me']);
  });
});
