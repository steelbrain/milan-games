import { describe, expect, it } from 'vitest';
import { activityChoices, findLevel, findTopic, paths, resolveGame, TOPICS } from './topics';

describe('topics', () => {
  it('have unique ids, each with at least one level', () => {
    const ids = TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of TOPICS) {
      expect(topic.levels.length).toBeGreaterThan(0);
      const levelIds = topic.levels.map((level) => level.id);
      expect(new Set(levelIds).size).toBe(levelIds.length);
    }
  });

  it('include counting to 5, 10 and 20', () => {
    const counting = findTopic('counting');
    expect(counting?.kind).toBe('counting');
    if (counting?.kind === 'counting') {
      expect(counting.levels.map((level) => level.max)).toEqual([5, 10, 20]);
      expect(counting.levels.map((level) => level.label)).toEqual([
        'Count to 5',
        'Count to 10',
        'Count to 20',
      ]);
    }
  });

  it('size every counting board to fit its biggest number', () => {
    for (const topic of TOPICS) {
      if (topic.kind !== 'counting') continue;
      for (const level of topic.levels) {
        expect(level.min).toBeGreaterThanOrEqual(1);
        expect(level.min).toBeLessThanOrEqual(level.max);
        expect(level.gridSize ** 2).toBeGreaterThanOrEqual(level.max);
      }
    }
  });

  it('offer "find" and "say" for card topics, and a game per story for counting', () => {
    const letters = findTopic('letters');
    expect(letters && activityChoices(letters)).toEqual([
      { id: 'find', label: 'Find the letter', emoji: '🔍' },
      { id: 'say', label: 'What letter is this?', emoji: '💬' },
    ]);
    const counting = findTopic('counting');
    expect(counting && activityChoices(counting).map((choice) => choice.id)).toEqual([
      'picnic',
      'walk',
      'space',
      'sea',
    ]);
  });
});

describe('resolveGame', () => {
  it('resolves card games', () => {
    const game = resolveGame('letters', 'lower', 'find');
    expect(game?.kind).toBe('find');
    expect(game?.level.id).toBe('lower');
    expect(resolveGame('numbers', '20', 'say')?.kind).toBe('say');
  });

  it('resolves counting stories', () => {
    const game = resolveGame('counting', '20', 'space');
    expect(game?.kind).toBe('count');
    if (game?.kind === 'count') {
      expect(game.story.title).toBe('Space Trip');
      expect(game.level.max).toBe(20);
    }
  });

  it.each([
    ['nope', '5', 'find'],
    ['letters', 'nope', 'find'],
    ['letters', 'upper', 'nope'],
    ['counting', '5', 'find'],
    ['counting', 'nope', 'picnic'],
    [undefined, undefined, undefined],
  ])('rejects %s / %s / %s', (topic, level, activity) => {
    expect(resolveGame(topic, level, activity)).toBeUndefined();
  });
});

describe('helpers', () => {
  it('find levels by id', () => {
    const levels = [{ id: 'a', label: 'A' }];
    expect(findLevel(levels, 'a')).toBe(levels[0]);
    expect(findLevel(levels, 'b')).toBeUndefined();
  });

  it('build paths', () => {
    expect(paths.topic('letters')).toBe('/topic/letters');
    expect(paths.play('counting', '10', 'sea')).toBe('/play/counting/10/sea');
  });
});
