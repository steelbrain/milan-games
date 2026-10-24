import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnv, readSecret } from './env.ts';

describe('parseEnv', () => {
  it('reads keys and values, with or without quotes', () => {
    expect(
      parseEnv(
        [
          '# a comment',
          'PLAIN=abc123',
          'QUOTED="with spaces"',
          "SINGLE='x'",
          'export EXPORTED = yes ',
          'TRAILING=value # note',
          '',
          'not a line',
        ].join('\n'),
      ),
    ).toEqual({
      PLAIN: 'abc123',
      QUOTED: 'with spaces',
      SINGLE: 'x',
      EXPORTED: 'yes',
      TRAILING: 'value',
    });
  });
});

describe('readSecret', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers the environment, then the local env files in order', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'env-'));
    writeFileSync(path.join(root, '.env.local'), 'KEY=from-env-local\nOTHER=2');
    expect(readSecret('KEY', root)).toBe('from-env-local');

    writeFileSync(path.join(root, '.local.env'), 'KEY=from-local-env');
    expect(readSecret('KEY', root)).toBe('from-local-env');

    vi.stubEnv('KEY', 'from-environment');
    expect(readSecret('KEY', root)).toBe('from-environment');

    expect(readSecret('MISSING', root)).toBeUndefined();
  });
});
