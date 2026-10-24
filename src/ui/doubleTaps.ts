/** The second tap of a double-tap lands within this long of the first… */
export const DOUBLE_TAP_MS = 400;
/** …and within this distance of it. Separate things to tap sit further apart than this. */
export const DOUBLE_TAP_PX = 30;

interface Tap {
  readonly time: number;
  readonly x: number;
  readonly y: number;
}

const follows = (previous: Tap | undefined, tap: Tap): boolean =>
  previous !== undefined &&
  tap.time - previous.time < DOUBLE_TAP_MS &&
  Math.hypot(tap.x - previous.x, tap.y - previous.y) < DOUBLE_TAP_PX;

const tapOf = (event: MouseEvent): Tap => ({
  time: event.timeStamp,
  x: event.clientX,
  y: event.clientY,
});

function drop(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

/**
 * Drops the second half of a double-tap. Small children double-tap a lot, and with double-tap
 * zoom turned off each tap is its own click, so the second one would press whatever the first
 * brought up under the finger: the next round's "Count with me" right where "Next" was, or a
 * card's "Next" where "Show me" was. Only touches count; mouse and keyboard are left alone.
 *
 * Counting items react as the finger lands, before any click, so a double-tap on "Play again"
 * could count an item on the new board. When the first tap's target is gone, the screen changed
 * under the finger, so the second touch is dropped as it lands too. Quick taps on neighbouring
 * items still count: the item tapped first stays put.
 */
export function guardDoubleTaps(target: EventTarget): () => void {
  let touching = false;
  let last: (Tap & { readonly target: EventTarget | null }) | undefined;
  // Set when a touch was dropped as it landed, so its click goes too, however late it comes.
  let dropped = false;

  const onPointerDown = (event: Event) => {
    const down = event as PointerEvent;
    touching = down.pointerType === 'touch';
    const gone = last?.target instanceof Node && !last.target.isConnected;
    dropped = touching && gone && follows(last, tapOf(down));
    if (dropped) drop(down);
  };
  const onClick = (event: Event) => {
    const click = event as MouseEvent;
    // Keyboard presses, and a label passing its click on to its input, have no tap behind them.
    if (!touching || click.detail === 0) return;
    const tap = tapOf(click);
    const previous = last;
    const second = dropped || follows(previous, tap);
    // A dropped tap hands on what the first one pressed, so a burst of taps all counts as one.
    last = { ...tap, target: second && previous ? previous.target : click.target };
    if (second) drop(click);
    dropped = false;
  };

  target.addEventListener('pointerdown', onPointerDown, true);
  target.addEventListener('click', onClick, true);
  return () => {
    target.removeEventListener('pointerdown', onPointerDown, true);
    target.removeEventListener('click', onClick, true);
  };
}
