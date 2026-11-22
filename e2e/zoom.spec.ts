import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** How far the page is zoomed in: 1 is not zoomed at all. */
const zoom = (page: Page) => page.evaluate(() => window.visualViewport?.scale ?? 1);

test('a two-finger pinch does not zoom in', async ({ page }) => {
  await page.goto('/#/play/letters/upper/find');
  await expect(page.getByRole('group', { name: 'Choices' })).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const { width, height } = page.viewportSize() ?? { width: 400, height: 800 };
  await cdp.send('Input.synthesizePinchGesture', {
    x: width / 2,
    y: height / 2,
    scaleFactor: 3,
    gestureSourceType: 'touch',
  });
  expect(await zoom(page)).toBe(1);
});

test('cancels the zooms the browser leaves to the page', async ({ page }) => {
  await page.goto('/#/play/letters/upper/find');
  await expect(page.getByRole('group', { name: 'Choices' })).toBeVisible();
  // Safari's pinch, a trackpad pinch, and ⌘+, as the page receives them.
  const cancelled = await page.evaluate(() => {
    const events = [
      new Event('gesturestart', { bubbles: true, cancelable: true }),
      new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -10 }),
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: '=', metaKey: true }),
    ];
    return events.map((event) => !document.body.dispatchEvent(event));
  });
  expect(cancelled).toEqual([true, true, true]);
});
