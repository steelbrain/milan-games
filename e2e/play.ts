import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Taps every item at a child's calm pace. Taps any quicker are "too fast" and rest the board,
 * so the page's clock (installed with `page.clock.install()`) moves on between taps.
 */
export async function countEach(page: Page, items: Locator): Promise<number> {
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    await items.nth(i).click();
    await page.clock.fastForward(1000);
  }
  return count;
}
