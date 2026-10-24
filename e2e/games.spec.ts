import type { Page } from '@playwright/test';
import { CARD_GAME_FINALES } from '../src/activities/praise';
import { expect, test } from './fixtures';
import { countEach } from './play';

async function promptText(page: Page): Promise<string> {
  return (await page.getByRole('paragraph').first().textContent()) ?? '';
}

async function clickNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Next|Finish)$/ }).click();
}

test('plays a whole counting story, counting to 20', async ({ page, spoken }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('link', { name: 'Counting' }).click();
  await expect.poll(spoken).toContain("Let's count! Pick a story.");

  await page.getByText('Count to 20').click();
  await page.getByRole('link', { name: 'Space Trip' }).click();

  for (let page_ = 1; page_ <= 5; page_++) {
    await expect(page.getByText(/How many [\w ]+\?$/)).toBeVisible();
    const items = page.getByRole('group', { name: /to count$/ }).getByRole('button');
    const count = await countEach(page, items);
    expect(count).toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(20);
    await expect(page.getByRole('status', { name: 'Counted so far' })).toHaveText(String(count));

    await page
      .getByRole('group', { name: 'How many?' })
      .getByRole('button', { name: String(count), exact: true })
      .click();
    await expect(page.getByRole('img', { name: `${page_} of 5 stars` })).toBeVisible();
    await clickNext(page);
  }

  await expect(page.getByRole('heading', { name: 'You did it!' })).toBeVisible();
  await expect
    .poll(spoken)
    .toContain('The rocket lands safely back home. What a trip! Great counting!');
});

test('"Count with me" counts the whole board aloud', async ({ page, spoken }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Counting' }).click();
  await page.getByText('Count to 5').click();
  await page.getByRole('link', { name: "Bunny's Picnic" }).click();
  const items = page.getByRole('group', { name: /to count$/ }).getByRole('button');
  await expect(items.first()).toBeVisible();
  const count = await items.count();

  await page.getByRole('button', { name: 'Count with me' }).click();
  // Each number waits for the last clip to finish playing, so this needs real audio to end.
  await expect(page.getByRole('status', { name: 'Counted so far' })).toHaveText(String(count), {
    timeout: 20_000,
  });
  const counted = Array.from({ length: count }, (_, i) => `${i + 1}!`);
  await expect.poll(spoken).toEqual(expect.arrayContaining(counted));
});

test('finds five letters, then plays again', async ({ page, spoken }) => {
  await page.goto('/#/play/letters/upper/find');
  for (let round = 1; round <= 5; round++) {
    const target = /Find the letter (\w)!/.exec(await promptText(page))?.[1] ?? '';
    expect(target).toMatch(/^[A-Z]$/);
    await page.getByRole('button', { name: target, exact: true }).click();
    await expect(page.getByRole('figure')).toBeVisible();
    await clickNext(page);
  }
  await expect(page.getByRole('heading', { name: 'You did it!' })).toBeVisible();
  const finales = CARD_GAME_FINALES.map((line) => line.text);
  await expect.poll(() => spoken().some((text) => finales.includes(text))).toBe(true);

  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('img', { name: '0 of 5 stars' })).toBeVisible();
});

test('flash cards reveal numbers with dots', async ({ page, spoken }) => {
  await page.goto('/#/play/numbers/10/say');
  await expect.poll(spoken).toContain('What number is this?');
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.getByRole('img', { name: /^\d+ dots?$/ })).toBeVisible();
  await expect.poll(spoken).toContainEqual(expect.stringMatching(/^Here (is|are) \d+ dots?\.$/));
});

test('remembers the chosen level and the mute switch across reloads', async ({ page, spoken }) => {
  await page.goto('/#/topic/letters');
  await page.getByText('abc', { exact: true }).click();
  await page.getByRole('button', { name: 'Turn sound off' }).click();

  await page.reload();
  await expect(page.getByRole('radio', { name: 'abc', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Turn sound on' })).toBeVisible();

  const before = spoken().length;
  await page.getByRole('link', { name: 'Find the letter' }).click();
  await expect(page.getByText(/^Find the letter [a-z]!$/)).toBeVisible();
  expect(spoken().length).toBe(before);
});

test('picks a voice at random on each visit', async ({ page, heard }) => {
  await page.goto('/#/topic/counting');
  for (let visit = 0; visit < 8; visit++) {
    await expect
      .poll(() => heard().filter((clip) => clip.visit === visit + 1).length)
      .toBeGreaterThan(0);
    await page.reload();
  }
  expect(new Set(heard().map((clip) => clip.voice)).size).toBeGreaterThan(1);
});

const SCREENS = [
  '/',
  '/#/topic/counting',
  '/#/topic/letters',
  '/#/play/counting/20/walk',
  '/#/play/letters/upper/find',
  '/#/play/numbers/20/say',
  '/#/play/shapes/all/find',
];

for (const path of SCREENS) {
  test(`${path} fits the screen without sideways scrolling`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('the counting board and answers fit on one screen, even at 20', async ({ page }) => {
  await page.goto('/#/play/counting/20/picnic');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');
  for (const name of [/to count$/, 'How many?']) {
    const box = await page.getByRole('group', { name }).boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  await expect(page.getByRole('button', { name: 'Count with me' })).toBeInViewport();
});
