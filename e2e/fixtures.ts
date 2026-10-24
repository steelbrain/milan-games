import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __fallbackSpeech?: string[];
  }
}

const manifest = JSON.parse(
  readFileSync(new URL('../public/speech/manifest.json', import.meta.url), 'utf8'),
) as { clips: Record<string, { words: string }> };

/**
 * Replaces the browser's own speech engine with a recorder. The games should only ever fall back
 * to it when a recording is missing, so every test checks it was never used.
 */
async function recordFallbackSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    window.__fallbackSpeech = spoken;
    const recorder = {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: () => [],
      cancel: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      speak: (utterance: SpeechSynthesisUtterance) => {
        if (utterance.text) spoken.push(utterance.text);
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    };
    Object.defineProperty(window, 'speechSynthesis', { value: recorder, configurable: true });
  });
}

interface Heard {
  readonly words: string;
  readonly voice: string;
  /** Which page load it was heard in; reloads pick a new voice. */
  readonly visit: number;
}

export const test = base.extend<{
  heard: () => Heard[];
  spoken: () => string[];
}>({
  /** Every recording the page loaded, in order. */
  heard: [
    async ({ page }, use) => {
      await recordFallbackSpeech(page);
      const heard: Heard[] = [];
      let visit = 0;
      page.on('domcontentloaded', () => visit++);
      page.on('request', (request) => {
        const match = /\/speech\/([a-z]+)\/([0-9a-f]{14})(?:-\d+)?\.m4a$/.exec(request.url());
        const [, voice = '', id = ''] = match ?? [];
        if (match)
          heard.push({ words: manifest.clips[id]?.words ?? `unknown clip ${id}`, voice, visit });
      });
      await use(() => [...heard]);

      // Undefined if the page never loaded the app, which means it said nothing.
      const fallback = await page.evaluate(() => window.__fallbackSpeech ?? []).catch(() => []);
      expect(fallback, 'lines spoken by the robotic fallback voice').toEqual([]);
      for (const n of new Set(heard.map((clip) => clip.visit))) {
        const voices = new Set(heard.filter((clip) => clip.visit === n).map((clip) => clip.voice));
        expect(voices.size, 'voices heard in one visit').toBe(1);
      }
    },
    { auto: true },
  ],
  /** The words of every recording the page has loaded, in order. */
  spoken: async ({ heard }, use) => {
    await use(() => heard().map((clip) => clip.words));
  },
});

export { expect };
