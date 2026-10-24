import { act, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clickNext, promptText } from '../../test/play';
import { PRAISE } from '../praise';
import { renderApp } from '../../test/render';
import { HELP_STEP_MS } from './CountingGame';

function items(groupName: string): HTMLElement[] {
  return within(screen.getByRole('group', { name: groupName })).getAllByRole('button');
}

function tally(): string {
  return screen.getByRole('status', { name: 'Counted so far' }).textContent ?? '';
}

async function countAll(user: UserEvent, groupName: string): Promise<number> {
  const all = items(groupName);
  for (const item of all) await user.click(item);
  return all.length;
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
    expect(promptText()).toBe('Bunny is packing a picnic basket. How many carrots?');
    expect(services.speaker.texts).toEqual([promptText()]);
    const carrots = items('carrots to count');
    expect(carrots.length).toBeGreaterThanOrEqual(1);
    expect(carrots.length).toBeLessThanOrEqual(5);
    expect(tally()).toBe('0');
  });

  it('counts out loud, one note higher per item', async () => {
    const { user, services } = renderApp('/play/counting/10/picnic');
    const [first, second] = items('carrots to count');
    if (!first || !second) throw new Error('Expected at least two carrots');

    await user.click(first);
    await user.click(second);

    expect(tally()).toBe('2');
    expect(services.speaker.texts.slice(1)).toEqual(['1!', '2!']);
    expect(services.sounds.played).toEqual([
      { cue: 'count', options: { step: 1 } },
      { cue: 'count', options: { step: 2 } },
    ]);
    expect(first).toHaveAccessibleName('carrot 1');
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAccessibleName('carrot 2');
  });

  it('does not count the same item twice', async () => {
    const { user, services } = renderApp('/play/counting/10/picnic');
    const [first] = items('carrots to count');
    if (!first) throw new Error('Expected a carrot');
    await user.click(first);
    await user.click(first);
    expect(tally()).toBe('1');
    expect(services.sounds.cues).toEqual(['count']);
  });

  it('says when every item has been counted', async () => {
    const { user, services } = renderApp('/play/counting/10/picnic');
    const count = await countAll(user, 'carrots to count');
    expect(tally()).toBe(String(count));
    expect(services.speaker.texts.slice(-2)).toEqual([`${count}!`, "That's all of them!"]);
  });

  it('gently corrects a wrong number', async () => {
    const { user, services } = renderApp('/play/counting/10/picnic');
    const count = items('carrots to count').length;
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
    const count = await countAll(user, 'carrots to count');
    await user.click(answerButton(count));

    expect(services.sounds.cues.at(-1)).toBe('correct');
    const [cheer, counted, reaction] = services.speaker.texts.slice(-3);
    expect(PRAISE.map((line) => line.text)).toContain(cheer);
    expect(counted).toBe(`${count} ${count === 1 ? 'carrot' : 'carrots'}!`);
    expect(reaction).toBe('Crunch crunch!');
    expect(screen.getByRole('img', { name: '1 of 5 stars' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Count with me' })).not.toBeInTheDocument();

    await clickNext(user);
    expect(promptText()).toBe('Bunny picks apples from the tree. How many apples?');
    expect(tally()).toBe('0');
  });

  it('counts together, one item at a time, when asked for help', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user, services } = renderApp('/play/counting/20/space', {
      userOptions: { advanceTimers: vi.advanceTimersByTime },
    });
    const count = items('stars to count').length;
    const [first] = items('stars to count');
    if (!first) throw new Error('Expected a star');
    await user.click(first);

    await user.click(screen.getByRole('button', { name: 'Count with me' }));
    expect(tally()).toBe('0');
    expect(services.speaker.lastText).toBe("Let's count the stars together!");
    expect(screen.getByRole('button', { name: 'Count with me' })).toBeDisabled();

    // Taps are ignored while the game is counting.
    await user.click(first);
    expect(tally()).toBe('0');

    act(() => {
      vi.advanceTimersByTime(HELP_STEP_MS);
    });
    expect(tally()).toBe('1');
    expect(first).toHaveAccessibleName('star 1');

    // One more step per remaining item, plus one to notice it is done.
    for (let step = 2; step <= count + 1; step++) {
      act(() => {
        vi.advanceTimersByTime(HELP_STEP_MS);
      });
    }
    expect(tally()).toBe(String(count));
    expect(services.speaker.texts.slice(-2)).toEqual([`${count}!`, "That's all of them!"]);
    expect(screen.getByRole('button', { name: 'Count with me' })).toBeEnabled();
  });

  it('stops helping as soon as the child answers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user } = renderApp('/play/counting/20/space', {
      userOptions: { advanceTimers: vi.advanceTimersByTime },
    });
    const count = items('stars to count').length;
    await user.click(screen.getByRole('button', { name: 'Count with me' }));
    act(() => {
      vi.advanceTimersByTime(HELP_STEP_MS);
    });
    await user.click(answerButton(count));
    for (let step = 0; step < 5; step++) {
      act(() => {
        vi.advanceTimersByTime(HELP_STEP_MS);
      });
    }
    expect(tally()).toBe('1');
  });

  it('tells the whole story and ends it', async () => {
    const { user, services } = renderApp('/play/counting/5/sea');
    const pages = ['fish', 'shells', 'crabs', 'turtles', 'whales'];
    for (const [page, noun] of pages.entries()) {
      expect(promptText()).toMatch(new RegExp(`How many ${noun}\\?$`));
      const count = await countAll(user, `${noun} to count`);
      await user.click(answerButton(count));
      expect(screen.getByRole('img', { name: `${page + 1} of 5 stars` })).toBeInTheDocument();
      await clickNext(user);
    }
    expect(screen.getByRole('heading', { name: 'You did it!' })).toBeInTheDocument();
    expect(services.speaker.lastText).toBe('Octopus had a splashy day. Thank you for counting!');
  });

  it('uses a bigger board for bigger numbers', () => {
    renderApp('/play/counting/20/walk');
    const count = items('trees to count').length;
    expect(count).toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(20);
  });
});
