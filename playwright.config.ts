import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // The "Next" button pulses forever, and Playwright waits for things to stop moving before
    // tapping them. Reduced motion (which the app honors) settles every animation.
    contextOptions: { reducedMotion: 'reduce' },
  },
  // `channel: 'chrome'` drives the installed Google Chrome, so no browser download is needed.
  projects: [
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
      },
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
      // Offline support is the same on every screen, and its full download is big.
      testIgnore: 'offline.spec.ts',
    },
  ],
  // Test the real production build, served the way it will be deployed.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
