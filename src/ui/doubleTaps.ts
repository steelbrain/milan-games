/** The second tap of a double-tap lands within this long of the first… */
export const DOUBLE_TAP_MS = 400;
/** …and within this distance of it. Separate things to tap sit further apart than this. */
export const DOUBLE_TAP_PX = 30;

/**
 * Drops the second half of a double-tap. Small children double-tap a lot, and with double-tap
 * zoom turned off each tap is its own click, so the second one would press whatever the first
 * brought up under the finger: the next round's "Count with me" right where "Next" was, or a
 * card's "Next" where "Show me" was. Only touches count; mouse and keyboard are left alone.
 */
export function guardDoubleTaps(target: EventTarget): () => void {
  let touching = false;
  let last: { readonly time: number; readonly x: number; readonly y: number } | undefined;

  const onPointerDown = (event: Event) => {
    touching = (event as PointerEvent).pointerType === 'touch';
  };
  const onClick = (event: Event) => {
    const click = event as MouseEvent;
    // Keyboard presses, and a label passing its click on to its input, have no tap behind them.
    if (!touching || click.detail === 0) return;
    const tap = { time: click.timeStamp, x: click.clientX, y: click.clientY };
    const previous = last;
    last = tap;
    if (
      previous &&
      tap.time - previous.time < DOUBLE_TAP_MS &&
      Math.hypot(tap.x - previous.x, tap.y - previous.y) < DOUBLE_TAP_PX
    ) {
      click.preventDefault();
      click.stopImmediatePropagation();
    }
  };

  target.addEventListener('pointerdown', onPointerDown, true);
  target.addEventListener('click', onClick, true);
  return () => {
    target.removeEventListener('pointerdown', onPointerDown, true);
    target.removeEventListener('click', onClick, true);
  };
}
