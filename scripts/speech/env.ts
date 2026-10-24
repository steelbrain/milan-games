import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Parses KEY=value lines, ignoring comments and blank lines, and stripping matching quotes. */
export function parseEnv(source: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const raw of source.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!match?.[1] || raw.trimStart().startsWith('#')) continue;
    let value = match[2] ?? '';
    const quoted = /^(['"])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2] ?? '';
    else value = value.replace(/\s+#.*$/, '');
    values[match[1]] = value;
  }
  return values;
}

/** The first non-empty value from the environment or the project's local env files. */
export function readSecret(
  name: string,
  root: string,
  files = ['.local.env', '.env.local'],
): string | undefined {
  const fromEnvironment = process.env[name];
  if (fromEnvironment) return fromEnvironment;
  for (const file of files) {
    try {
      const value = parseEnv(readFileSync(path.join(root, file), 'utf8'))[name];
      if (value) return value;
    } catch {
      // No such file; try the next one.
    }
  }
  return undefined;
}
