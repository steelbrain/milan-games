import { act, fireEvent, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clickNext, promptText } from '../../test/play';
import { PRAISE } from '../praise';
import { renderApp } from '../../test/render';
import { createTestServices } from '../../test/fakes';
import { STORIES, type StoryScene } from '../../content/stories';
import { HELP_PAUSE_MS, HELP_STEP_MS, SLOW_DOWN_MS } from './CountingGame';
import { ALL_COUNTED, countingQuestion, SLOW_DOWN, TOO_FAST } from './countingLogic';

const ALL_COUNTED_TEXTS = ALL_COUNTED.map((line) => line.text);

function storyScenes(storyId: string): readonly StoryScene[] {
  return STORIES.find((story) => story.id === storyId)?.scenes ?? [];
}

/** The page of the story on screen; games tell a random few pages, so tests look it up. */
function sceneOnScreen(storyId: string): StoryScene {
  const scene = storyScenes(storyId).find((s) => countingQuestion(s).text === promptText());
  if (!scene) throw new Error(`No page of "${storyId}" asks "${promptText()}"`);
  return scene;
}

/** The things to count on the board, which must be `many` of the page's item. */
function items(many: string): HTMLElement[] {
  return within(screen.getByRole('group', { name: `${many} to count` })).getAllByRole('button');
}

function tally(): string {
  return screen.getByRole('status', { name: 'Counted so far' }).textContent ?? '';
}

async function countAll(user: UserEvent, many: string): Promise<number> {
  const all = items(many);
  for (const item of all) await user.click(item);
  return all.length;
}

/** Lets fake time pass, including the promise hops between "Count with me" steps. */
async function wait(ms: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

function answerButton(count: number): HTMLElement {
  return within(screen.getByRole('group', { name: 'How many?' })).getByRole('button', {
    name: String(count),
  });
}

describe('CountingGame', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets the scene and asks how many', () => {
    const { services } = renderApp('/play/counting/5/picnic');
    const { setup, item } = sceneOnScreen('picnic');
    expect(promptText()).toBe(`${setup} How many ${item.many}?`);
    expect(services.speaker.texts).toEqual([promptText()]);
    const things = items(item.many);
    expect(things.length).toBeGreaterThanOrEqual(1);
    expect(things.length).toBeLessThanOrEqual(5);
    expect(tally()).toBe('0');
  });

  it('counts out loud, one note higher per item', async () => {
    const { user, services } = renderApp('/play/counting/10/picnic');
    const { item } = sceneOnScreen('picnic');
    const [first, second] = items(item.many);
    if (!first || !second) throw new Error('Expected at least two things to count');

    await user.click(first);
    await user.click(second);

    expect(tally()).toBe('2');
    expect(services.speaker.texts.slice(1)).toEqual(['1!', '2!']);
    expect(services.sounds.played).toEqual([
      { cue: 'count', options: { step: 1 } },
      { cue: 'count', options: { step: 2 } },
    ]);
    expect(first).toHaveAccessibleName(`${item.one} 1`);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAccessibleName(`${item.one} 2`);
  });

  it('does not count the same item twice', async () => {
    const { user, services } = renderApp('/play/counting/10/picnic');
    const [first] = items(sceneOnScreen('picnic').item.many);
    if (!first) throw new Error('Expected something to count');
    await user.click(first);
    await user.click(first);
    expect(tally()).toBe('1');
    expect(services.sounds.cues).toEqual(['count']);
  });

  it('says when every item has been counted', async () => {
    const { user, services } = renderApp('/play/counting/10/picnic');
    const count = await countAll(user, sceneOnScreen('picnic').item.many);
    expect(tally()).toBe(String(count));
    const [number, ending] = services.speaker.texts.slice(-2);
    expect(number).toBe(`${count}!`);
    expect(ALL_COUNTED_TEXTS).toContain(ending);
  });

  it('gently corrects a wrong number', async () => {
    const { user, services } = renderApp('/play/counting/10/picnic');
    const count = items(sceneOnScreen('picnic').item.many).length;
    const wrong = within(screen.getByRole('group', { name: 'How many?' }))
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-label') !== String(count));
    if (!wrong) throw new Error('No wrong choice');

    await user.click(wrong);

    expect(services.sounds.cues).toEqual(['tryAgain']);
    expect(services.speaker.texts.slice(-2)).toEqual([
      `Not ${wrong.getAttribute('aria-label') ?? ''}.`,
      "Let's try again!",
    ]);
    expect(wrong).toBeDisabled();
    expect(screen.getByRole('img', { name: '0 of 5 stars' })).toBeInTheDocument();
  });

  it('cheers for the right number and moves on to the next page of the story', async () => {
    const { user, services } = renderApp('/play/counting/5/picnic');
    const scene = sceneOnScreen('picnic');
    const count = await countAll(user, scene.item.many);
    await user.click(answerButton(count));

    expect(services.sounds.cues.at(-1)).toBe('correct');
    const [cheer, counted, reaction] = services.speaker.texts.slice(-3);
    expect(PRAISE.map((line) => line.text)).toContain(cheer);
    expect(counted).toBe(`${count} ${count === 1 ? scene.item.one : scene.item.many}!`);
    expect(reaction).toBe(scene.cheer);
    expect(screen.getByRole('img', { name: '1 of 5 stars' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Count with me' })).not.toBeInTheDocument();

    await clickNext(user);
    const scenes = storyScenes('picnic');
    expect(scenes.indexOf(sceneOnScreen('picnic'))).toBeGreaterThan(scenes.indexOf(scene));
    expect(tally()).toBe('0');
  });

  it('counts together, one item at a time, when asked for help', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user, services } = renderApp('/play/counting/20/space', {
      userOptions: { advanceTimers: vi.advanceTimersByTime },
    });
    const { item } = sceneOnScreen('space');
    const count = items(item.many).length;
    const [first] = items(item.many);
    if (!first) throw new Error('Expected something to count');
    await user.click(first);

    await user.click(screen.getByRole('button', { name: 'Count with me' }));
    expect(tally()).toBe('0');
    expect(services.speaker.lastText).toBe(`Let's count the ${item.many} together!`);
    expect(screen.getByRole('button', { name: 'Count with me' })).toBeDisabled();

    // Taps are ignored while the game is counting.
    await user.click(first);
    expect(tally()).toBe('0');

    await wait(HELP_STEP_MS);
    expect(tally()).toBe('1');
    expect(first).toHaveAccessibleName(`${item.one} 1`);

    // One more step per remaining item, plus one to notice it is done.
    for (let step = 2; step <= count + 1; step++) await wait(HELP_STEP_MS);
    expect(tally()).toBe(String(count));
    const [number, ending] = services.speaker.texts.slice(-2);
    expect(number).toBe(`${count}!`);
    expect(ALL_COUNTED_TEXTS).toContain(ending);
    expect(screen.getByRole('button', { name: 'Count with me' })).toBeEnabled();
  });

  it('stops helping as soon as the child answers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderApp('/play/counting/20/space', {
      userOptions: { advanceTimers: vi.advanceTimersByTime },
    });
    const count = items(sceneOnScreen('space').item.many).length;
    await user.click(screen.getByRole('button', { name: 'Count with me' }));
    await wait(HELP_STEP_MS);
    await user.click(answerButton(count));
    for (let step = 0; step < 5; step++) await wait(HELP_STEP_MS);
    expect(tally()).toBe('1');
  });

  it('lets each line finish before counting on, so nothing gets cut off', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user, services } = renderApp('/play/counting/20/space', {
      userOptions: { advanceTimers: vi.advanceTimersByTime },
    });
    services.speaker.holdSpeech = true;
    await user.click(screen.getByRole('button', { name: 'Count with me' }));
    expect(services.speaker.lastText).toMatch(/^Let's count the .+ together!$/);

    // However long "Let's count the stars together!" takes, counting waits for it…
    await wait(5000);
    expect(tally()).toBe('0');
    act(() => services.speaker.finishSpeaking());
    await wait(HELP_PAUSE_MS);
    expect(tally()).toBe('1');

    // …and for every number after it.
    await wait(5000);
    expect(tally()).toBe('1');
    act(() => services.speaker.finishSpeaking());
    await wait(HELP_PAUSE_MS);
    expect(tally()).toBe('2');
  });

  it('counts the moment a finger lands, even one that slides before lifting', () => {
    renderApp('/play/counting/20/space');
    const [first] = items(sceneOnScreen('space').item.many);
    if (!first) throw new Error('Expected something to count');
    fireEvent.pointerDown(first, { button: 0 });
    expect(tally()).toBe('1');
  });

  it('counts with the keyboard too', async () => {
    const { user } = renderApp('/play/counting/20/space');
    items(sceneOnScreen('space').item.many)[0]?.focus();
    await user.keyboard('{Enter}');
    expect(tally()).toBe('1');
  });

  it('rests the board when a child taps too fast to be counting along', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user, services } = renderApp('/play/counting/20/space', {
      // Every tap at the same moment.
      services: createTestServices({ now: () => 0 }),
      userOptions: { advanceTimers: vi.advanceTimersByTime },
    });
    const { item } = sceneOnScreen('space');
    const things = items(item.many);
    expect(things.length).toBeGreaterThanOrEqual(TOO_FAST.taps);
    for (const thing of things.slice(0, TOO_FAST.taps)) await user.click(thing);

    expect(services.speaker.lastText).toBe(SLOW_DOWN.text);
    expect(promptText()).toBe(SLOW_DOWN.text);
    expect(tally()).toBe('0');
    expect(things[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Count with me' })).toBeDisabled();

    await wait(SLOW_DOWN_MS);
    expect(things[0]).toBeEnabled();
    expect(promptText()).toBe(countingQuestion(sceneOnScreen('space')).text);
    await user.click(things[0] as HTMLElement);
    expect(tally()).toBe('1');
  });

  it('tells the whole story and ends it', async () => {
    const { user, services } = renderApp('/play/counting/5/sea');
    const told: number[] = [];
    for (let page = 1; page <= 5; page++) {
      const scene = sceneOnScreen('sea');
      told.push(storyScenes('sea').indexOf(scene));
      const count = await countAll(user, scene.item.many);
      await user.click(answerButton(count));
      expect(screen.getByRole('img', { name: `${page} of 5 stars` })).toBeInTheDocument();
      await clickNext(user);
    }
    // Five different pages, in story order.
    expect(told).toEqual([...new Set(told)].sort((a, b) => a - b));
    expect(screen.getByRole('heading', { name: 'You did it!' })).toBeInTheDocument();
    expect(services.speaker.lastText).toBe('Octopus had a splashy day. Thank you for counting!');
  });

  it('uses a bigger board for bigger numbers', () => {
    renderApp('/play/counting/20/walk');
    const count = items(sceneOnScreen('walk').item.many).length;
    expect(count).toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(20);
  });
});
