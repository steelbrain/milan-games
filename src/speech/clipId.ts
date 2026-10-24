import { type Line, spokenText } from '../content/line';

/** cyrb53: a small, fast 53-bit string hash; plenty to name a few thousand clips. */
function cyrb53(value: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** The exact words a clip contains, with whitespace normalized. */
export function clipWords(line: Line): string {
  return spokenText(line).trim().replace(/\s+/g, ' ');
}

/**
 * The file name (without extension) of a line's recording. It depends only on the spoken words,
 * so lines that sound the same share a clip and editing a line's words makes a new one.
 */
export function clipId(line: Line): string {
  return cyrb53(clipWords(line)).toString(16).padStart(14, '0');
}

/** The audio file for one take of a clip. Take 0 is the plain recording. */
export function clipFileName(id: string, take = 0): string {
  return take === 0 ? `${id}.m4a` : `${id}-${take}.m4a`;
}
