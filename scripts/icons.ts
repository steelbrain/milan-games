/**
 * Renders the PNG icons that installing the app needs from public/icon.svg, into public/icons/:
 *
 *   npm run icons
 *
 * Run it after changing icon.svg. It uses the installed Google Chrome through Playwright.
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public/icons');
/** The icon's own background color, for icons that must not be transparent. */
const BACKGROUND = '#ffd166';

interface IconSpec {
  readonly file: string;
  readonly size: number;
  /** How much of the canvas the artwork fills. */
  readonly scale: number;
  /** A solid background, for platforms that crop the icon themselves. */
  readonly solid: boolean;
}

const ICONS: readonly IconSpec[] = [
  { file: 'icon-192.png', size: 192, scale: 1, solid: false },
  { file: 'icon-512.png', size: 512, scale: 1, solid: false },
  // Android crops "maskable" icons to a circle or squircle, keeping only the middle 80%.
  { file: 'maskable-512.png', size: 512, scale: 0.8, solid: true },
  // iOS rounds the corners itself and turns transparent pixels black.
  { file: 'apple-touch-icon.png', size: 180, scale: 1, solid: true },
];

const svg = (await readFile(path.join(root, 'public/icon.svg'))).toString('base64');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { file, size, scale, solid } of ICONS) {
    await page.setContent(`
      <body style="margin: 0">
        <div id="icon" style="display: grid; place-items: center; width: ${size}px;
          height: ${size}px; background: ${solid ? BACKGROUND : 'transparent'}">
          <img src="data:image/svg+xml;base64,${svg}"
            style="width: ${scale * 100}%; height: ${scale * 100}%">
        </div>
      </body>`);
    await page
      .locator('#icon')
      .screenshot({ path: path.join(outDir, file), omitBackground: !solid });
    console.log(`public/icons/${file}`);
  }
} finally {
  await browser.close();
}
