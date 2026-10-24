import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { serviceWorker, totalBytes } from './scripts/build/serviceWorker.ts';

/** The recorded speech has its own "Play offline" download, so the app's offline copy skips it. */
const isSpeechClip = (file: string) => file.startsWith('speech/') && file.endsWith('.m4a');

export default defineConfig({
  // Relative asset paths + hash routing let the build run from any static host or folder.
  base: './',
  define: {
    __SPEECH_BYTES__: String(totalBytes(path.join(import.meta.dirname, 'public'), isSpeechClip)),
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
