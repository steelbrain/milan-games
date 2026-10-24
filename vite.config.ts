import { readFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { serviceWorker } from './scripts/build/serviceWorker.ts';

/** The recorded speech has its own "Play offline" download, so the app's offline copy skips it. */
const isSpeechClip = (file: string) => file.startsWith('speech/') && file.endsWith('.m4a');

/**
 * The recordings' total size, shown as the size of the "Play offline" download. `npm run speech`
 * writes it into the manifest, so Vite and Vitest don't add up thousands of files on every start.
 */
function speechBytes(): number {
  try {
    const manifestPath = path.join(import.meta.dirname, 'public/speech/manifest.json');
    const { bytes } = JSON.parse(readFileSync(manifestPath, 'utf8')) as { bytes?: unknown };
    return typeof bytes === 'number' ? bytes : 0;
  } catch {
    return 0;
  }
}

export default defineConfig({
  // Relative asset paths + hash routing let the build run from any static host or folder.
  base: './',
  define: {
    __SPEECH_BYTES__: String(speechBytes()),
  },
  plugins: [react(), serviceWorker({ entry: 'src/offline/sw.ts', skip: isSpeechClip })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'scripts/speech/{audio,elevenlabs,env,plan}.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/offline/sw.ts',
        'src/**/*.d.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
