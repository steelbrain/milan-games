/** Keys that zoom in or out with Ctrl (or ⌘ on a Mac). ⌘0 still resets the zoom. */
const ZOOM_KEYS = new Set(['+', '=', '-', '_']);

/**
 * Keeps the page from zooming, which a small child does by accident and can't undo. The viewport
 * meta tag and `touch-action` stop a pinch in most browsers, but Safari on iPhone and iPad
 * ignores the meta tag, so its pinch `gesture*` events are cancelled too. A trackpad pinch
 * reaches the page as a wheel with Ctrl held, like Ctrl + scroll wheel, and both are cancelled,
 * as are Ctrl/⌘ with + or −.
 */
export function blockZoom(target: EventTarget): () => void {
  const onGesture = (event: Event) => event.preventDefault();
  const onWheel = (event: Event) => {
    if ((event as WheelEvent).ctrlKey) event.preventDefault();
  };
  const onKey = (event: Event) => {
    const key = event as KeyboardEvent;
    if ((key.ctrlKey || key.metaKey) && ZOOM_KEYS.has(key.key)) event.preventDefault();
  };
  // Wheel listeners on the document are passive unless told otherwise, and a passive listener
  // can't cancel. The pages hardly scroll, so waiting on this listener costs nothing noticeable.
  const active = { passive: false } as const;

  target.addEventListener('gesturestart', onGesture);
  target.addEventListener('gesturechange', onGesture);
  target.addEventListener('wheel', onWheel, active);
  target.addEventListener('keydown', onKey);
  return () => {
    target.removeEventListener('gesturestart', onGesture);
    target.removeEventListener('gesturechange', onGesture);
    target.removeEventListener('wheel', onWheel);
    target.removeEventListener('keydown', onKey);
  };
}
