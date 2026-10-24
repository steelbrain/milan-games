import { describe, expect, it } from 'vitest';
import { PRAISE } from '../activities/praise';
import { spokenText } from '../content/line';
import { TOPICS } from '../topics/topics';
import { speechCatalog, TAKES } from './catalog';
import { clipId } from './clipId';

const catalog = speechCatalog();
const byWords = new Map(catalog.map((entry) => [spokenText(entry.line), entry]));

describe('speechCatalog', () => {
  it('lists each recording once', () => {
    const ids = catalog.map((entry) => clipId(entry.line));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every line at least five takes, so nothing ever sounds canned', () => {
    for (const { takes } of catalog) expect(takes).toBeGreaterThanOrEqual(5);
  });

  it('gives the most takes to what a child hears most', () => {
    expect(byWords.get('1!')?.takes).toBe(TAKES.constantly);
    expect(byWords.get('20!')?.takes).toBe(TAKES.constantly);
    expect(byWords.get("Let's try again!")?.takes).toBe(TAKES.often);
    expect(byWords.get("That's all of them!")?.takes).toBe(TAKES.often);
    for (const cheer of PRAISE) expect(byWords.get(cheer.text)?.takes).toBe(TAKES.often);
  });

  it('covers every topic', () => {
    for (const topic of TOPICS) expect(byWords.has(spokenText(topic.greeting))).toBe(true);
    for (const words of [
      'Find the letter Q!',
      'What color is this?',
      'Here are 17 dots.',
      'Triangle! Like a slice of pizza.',
      '20 strawberries!',
      '1 fish!',
      "Let's count the whales together!",
      'Octopus had a splashy day. Thank you for counting!',
    ]) {
      expect(byWords.has(words), words).toBe(true);
    }
  });
});
