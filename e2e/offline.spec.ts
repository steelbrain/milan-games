import { expect, test } from './fixtures';

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
  await expect(sheet.getByText('All saved!')).toBeVisible({ timeout: 280_000 });
  await downloader.close();

  await context.setOffline(true);
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
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  for (let i = 0; i < count; i++) await items.nth(i).click();
  const counted = Array.from({ length: count }, (_, i) => `${i + 1}!`);
  await expect.poll(spoken).toEqual(expect.arrayContaining(counted));
  // The fixture also checks that the robotic fallback voice was never needed.
});
