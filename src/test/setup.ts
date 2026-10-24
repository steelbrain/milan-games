import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { takeUncatalogedLines } from './fakes';

afterEach(() => {
  cleanup();
  // Every line a game says must be in the speech catalog, or it would have no recording.
  expect(takeUncatalogedLines(), 'lines missing from src/speech/catalog.ts').toEqual([]);
});
