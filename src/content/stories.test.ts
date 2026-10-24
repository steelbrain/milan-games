import { describe, expect, it } from 'vitest';
import { PAGES_PER_GAME } from '../activities/counting/countingLogic';
import { STORIES } from './stories';

describe('counting stories', () => {
  it('have unique ids', () => {
    const ids = STORIES.map((story) => story.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(STORIES)('$title is complete', (story) => {
    // More pages than one game tells, so playing it again tells a different story.
    expect(story.scenes.length).toBeGreaterThan(PAGES_PER_GAME);
    expect(story.hero).not.toBe('');
    expect(story.ending).toMatch(/[.!]$/);
    expect(story.scenery.top).toMatch(/^#[0-9a-f]{6}$/i);
    expect(story.scenery.bottom).toMatch(/^#[0-9a-f]{6}$/i);
    for (const scene of story.scenes) {
      expect(scene.setup).toMatch(/[.!]$/);
      expect(scene.cheer).toMatch(/!$/);
      expect(scene.item.emoji).not.toBe('');
      expect(scene.item.one).not.toBe('');
      expect(scene.item.many).not.toBe('');
    }
  });

  it.each(STORIES)('$title counts something different on every page', (story) => {
    const items = story.scenes.map((scene) => scene.item.one);
    expect(new Set(items).size).toBe(items.length);
  });
});
