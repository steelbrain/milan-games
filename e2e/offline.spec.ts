import { expect, test } from './fixtures';
import { countEach } from './play';

test('can be installed as an app', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The same check Chrome runs before it offers "Install app".
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  // Playwright's browser profiles are incognito, where Chrome never offers to install anything.
  const errors = installabilityErrors.map((error) => error.errorId);
  expect(errors.filter((id) => id !== 'in-incognito')).toEqual([]);

  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await page.request.get(appleIcon ?? '')).ok()).toBe(true);
});

test('downloads everything, then plays without internet', async ({ page, context, spoken }) => {
  test.setTimeout(300_000);

  // Download in another tab, so its thousands of requests stay out of what `page` heard.
  const downloader = await context.newPage();
  await downloader.goto('/');
  await downloader.getByRole('button', { name: 'Play offline' }).click();
  const sheet = downloader.getByRole('dialog', { name: 'Play offline' });
  await sheet.getByRole('button', { name: 'Download' }).click();
  await expect(sheet.getByRole('progressbar')).toBeVisible();
  await expect(sheet.getByText('All saved and up to date!')).toBeVisible({ timeout: 280_000 });
  await downloader.close();

  await context.setOffline(true);
  await page.clock.install();
  await page.goto('/');
  // Really offline, service worker included: anything not saved fails to load.
  const unsaved = await page.evaluate(() =>
    fetch('./speech/katie/not-saved.m4a').then(
      () => 'loaded',
      () => 'failed',
    ),
  );
  expect(unsaved).toBe('failed');

  await page.getByRole('link', { name: 'Counting' }).click();
  await expect.poll(spoken).toContain("Let's count! Pick a story.");
  await page.getByRole('link', { name: "Bunny's Picnic" }).click();
  const items = page.getByRole('group', { name: /to count$/ }).getByRole('button');
  const count = await countEach(page, items);
  const counted = Array.from({ length: count }, (_, i) => `${i + 1}!`);
  await expect.poll(spoken).toEqual(expect.arrayContaining(counted));
  // The fixture also checks that the robotic fallback voice was never needed.

  // Back online, the download can be removed again.
  await context.setOffline(false);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play offline' }).click();
  const saved = page.getByRole('dialog', { name: 'Play offline' });
  await saved.getByRole('button', { name: 'Remove download' }).click();
  await saved.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(saved.getByRole('button', { name: 'Download' })).toBeVisible();
  const left = await page.evaluate(async () =>
    (await caches.keys()).filter((name) => name.startsWith('speech')),
  );
  expect(left).toEqual([]);
});
