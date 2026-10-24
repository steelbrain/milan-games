import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { choiceButtons, clickNext, findTarget, promptText } from '../../test/play';
import { renderApp } from '../../test/render';
import { PRAISE } from '../praise';

const LETTER = /Find the letter (\w)!/;

async function solveRound(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: findTarget(LETTER) }));
  await clickNext(user);
}

describe('FindGame', () => {
  it('asks for a letter out loud and shows three choices', () => {
    const { services } = renderApp('/play/letters/upper/find');
    expect(promptText()).toMatch(LETTER);
    expect(services.speaker.texts).toEqual([promptText()]);
    expect(choiceButtons()).toHaveLength(3);
  });

  it('gently corrects a wrong pick and lets the child try again', async () => {
    const { user, services } = renderApp('/play/letters/upper/find');
    const target = findTarget(LETTER);
    const wrong = choiceButtons().find((button) => button.getAttribute('aria-label') !== target);
    if (!wrong) throw new Error('No wrong choice');
    const wrongLetter = wrong.getAttribute('aria-label') ?? '';

    await user.click(wrong);

    expect(services.sounds.cues).toEqual(['tryAgain']);
    expect(services.speaker.texts.slice(-2)).toEqual([
      `That's ${wrongLetter}.`,
      `Find the letter ${target}!`,
    ]);
    expect(wrong).toBeDisabled();
    expect(wrong).toHaveAttribute('data-status', 'wrong');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 5 stars' })).toBeInTheDocument();
  });

  it('celebrates the right pick, shows the picture word, and earns a star', async () => {
    const { user, services } = renderApp('/play/letters/upper/find');
    const target = findTarget(LETTER);
    await user.click(screen.getByRole('button', { name: target }));

    expect(services.sounds.cues).toEqual(['correct']);
    const [cheer, description] = services.speaker.texts.slice(-2);
    expect(PRAISE.map((line) => line.text)).toContain(cheer);
    expect(description).toMatch(new RegExp(`^${target}! ${target} is for \\w`));
    expect(screen.getByRole('button', { name: target })).toHaveAttribute('data-status', 'correct');
    expect(screen.getByRole('figure')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1 of 5 stars' })).toBeInTheDocument();

    // The other choices are done for this round.
    for (const button of choiceButtons()) {
      if (button.getAttribute('aria-label') !== target) expect(button).toBeDisabled();
    }
    await user.click(screen.getByRole('button', { name: target }));
    expect(services.sounds.cues).toEqual(['correct']);
  });

  it('repeats the prompt on request', async () => {
    const { user, services } = renderApp('/play/letters/upper/find');
    await user.click(screen.getByRole('button', { name: 'Say it again' }));
    expect(services.speaker.texts).toEqual([promptText(), promptText()]);
  });

  it('speaks lower-case letters as upper case, so they share recordings', () => {
    const { services } = renderApp('/play/letters/lower/find');
    const target = findTarget(LETTER);
    expect(target).toMatch(/^[a-z]$/);
    expect(services.speaker.lines[0]).toEqual({
      text: `Find the letter ${target}!`,
      speech: `Find the letter ${target.toUpperCase()}!`,
    });
  });

  it('plays five rounds, then throws a party', async () => {
    const { user, services } = renderApp('/play/letters/lower/find');
    for (let round = 1; round <= 4; round++) await solveRound(user);
    expect(screen.getByRole('img', { name: '4 of 5 stars' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: findTarget(LETTER) }));
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
    await clickNext(user);

    expect(screen.getByRole('heading', { name: 'You did it!' })).toBeInTheDocument();
    expect(services.sounds.cues.at(-1)).toBe('celebrate');
    expect(services.speaker.lastText).toBe('Hooray! You did it! Give me a high five!');
  });

  it('can play again or finish from the party screen', async () => {
    const { user } = renderApp('/play/letters/upper/find');
    for (let round = 1; round <= 5; round++) await solveRound(user);

    await user.click(screen.getByRole('button', { name: 'Play again' }));
    expect(screen.getByRole('img', { name: '0 of 5 stars' })).toBeInTheDocument();
    expect(promptText()).toMatch(LETTER);

    for (let round = 1; round <= 5; round++) await solveRound(user);
    await user.click(screen.getByRole('button', { name: 'All done' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/topic/letters');
  });

  it('works for numbers, colors and shapes too', async () => {
    for (const [route, pattern] of [
      ['/play/numbers/20/find', /Find the number (\d+)!/],
      ['/play/colors/all/find', /Can you find (\w+)\?/],
      ['/play/shapes/all/find', /Find the (\w+)!/],
    ] as const) {
      const { user, unmount } = renderApp(route);
      await user.click(screen.getByRole('button', { name: findTarget(pattern) }));
      expect(screen.getByRole('img', { name: '1 of 5 stars' })).toBeInTheDocument();
      unmount();
    }
  });
});
