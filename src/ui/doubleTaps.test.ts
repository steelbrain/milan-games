import { afterEach, describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, guardDoubleTaps } from './doubleTaps';

/**
 * A tap as the browser reports it: a pointerdown at `time` ms and (x, y), then a click at
 * `clickTime` (by default at once). Returns whether the click got through.
 */
function tap(
  target: Element,
  {
    time,
    clickTime = time,
    x = 100,
    y = 100,
    pointerType = 'touch',
    detail = 1,
  }: Partial<TapOptions> & {
    time: number;
  },
): boolean {
  const down = new MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(down, 'pointerType', { value: pointerType });
  Object.defineProperty(down, 'timeStamp', { value: time });
  target.dispatchEvent(down);
  const click = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    detail,
  });
  Object.defineProperty(click, 'timeStamp', { value: clickTime });
  return target.dispatchEvent(click);
}

interface TapOptions {
  time: number;
  clickTime: number;
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

  describe('when the first tap brings up something that reacts as the finger lands', () => {
    /** "Play again" is replaced by a new counting board, whose items count on pointerdown. */
    function board() {
      stop = guardDoubleTaps(document);
      const playAgain = document.createElement('button');
      const items = [document.createElement('button'), document.createElement('button')];
      const counted: number[] = [];
      items.forEach((item, i) => item.addEventListener('pointerdown', () => counted.push(i)));
      playAgain.addEventListener('click', () => playAgain.replaceWith(...items));
      document.body.append(playAgain);
      return { playAgain, items, counted };
    }

    it('drops the second tap as it lands, and its click', () => {
      const { playAgain, items, counted } = board();
      tap(playAgain, { time: 1000 });
      expect(tap(items[0] as Element, { time: 1200, x: 104 })).toBe(false);
      expect(counted).toEqual([]);
    });

    it('drops a whole burst of taps, and the click of one that lifts late', () => {
      const { playAgain, items, counted } = board();
      tap(playAgain, { time: 1000 });
      tap(items[0] as Element, { time: 1300 });
      expect(tap(items[0] as Element, { time: 1600, clickTime: 2100 })).toBe(false);
      expect(counted).toEqual([]);
    });

    it('lets quick taps on neighbouring items count, however close', () => {
      const { playAgain, items, counted } = board();
      tap(playAgain, { time: 1000 });
      tap(items[0] as Element, { time: 2000 });
      tap(items[1] as Element, { time: 2100, x: 110 });
      expect(counted).toEqual([0, 1]);
    });
  });

  it('can be removed', () => {
    const { next, countWithMe, pressed } = setup();
    stop();
    tap(next, { time: 1000 });
    tap(countWithMe, { time: 1100 });
    expect(pressed).toEqual(['next', 'count with me']);
  });
});
