import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { choiceButtons, clickNext, findTarget, promptText } from '../../test/play';
import { renderApp } from '../../test/render';
import { ALL_STARS_FINALES, CARD_GAME_FINALES, CARD_GAME_HEROES, PRAISE } from '../praise';

const LETTER = /Find the letter (\w)!/;

async function solveRound(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: findTarget(LETTER) }));
  await clickNext(user);
}

/** Picks a wrong letter, which misses the round's star. Returns the letter picked. */
async function missRound(user: UserEvent): Promise<string> {
  const target = findTarget(LETTER);
  const wrong = choiceButtons().find((button) => button.getAttribute('aria-label') !== target);
  if (!wrong) throw new Error('No wrong choice');
  await user.click(wrong);
  return wrong.getAttribute('aria-label') ?? '';
}

const finaleTexts = (finales: readonly { text: string }[]) => finales.map((line) => line.text);

describe('FindGame', () => {
  it('asks for a letter out loud and shows three choices', () => {
    const { services } = renderApp('/play/letters/upper/find');
    expect(promptText()).toMatch(LETTER);
    expect(services.speaker.texts).toEqual([promptText()]);
    expect(choiceButtons()).toHaveLength(3);
  });

  it('misses the star after a wrong pick, and shows the right one', async () => {
    const { user, services } = renderApp('/play/letters/upper/find');
    const target = findTarget(LETTER);
    const wrong = await missRound(user);

    expect(services.sounds.cues).toEqual(['tryAgain']);
    const [named, description] = services.speaker.texts.slice(-2);
    expect(named).toBe(`That's ${wrong}.`);
    expect(description).toMatch(new RegExp(`^${target} is for \\w+!$`));
    expect(screen.getByRole('button', { name: target })).toHaveAttribute('data-status', 'answer');
    expect(screen.getByRole('button', { name: wrong })).toHaveAttribute('data-status', 'wrong');
    const [other] = choiceButtons().filter(
      (button) => ![target, wrong].includes(button.getAttribute('aria-label') ?? ''),
    );
    expect(other).toHaveAttribute('data-status', 'faded');
    expect(other).toBeDisabled();
    expect(screen.getByRole('figure')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 5 stars' })).toBeInTheDocument();

    // The right one wins nothing now.
    await user.click(screen.getByRole('button', { name: target }));
    expect(services.sounds.cues).not.toContain('correct');

    await clickNext(user);
    expect(promptText()).toMatch(LETTER);
    expect(screen.getByRole('img', { name: '0 of 5 stars' })).toBeInTheDocument();
  });

  it('celebrates the right pick, shows the picture word, and earns a star', async () => {
    const { user, services } = renderApp('/play/letters/upper/find');
    const target = findTarget(LETTER);
    await user.click(screen.getByRole('button', { name: target }));

    expect(services.sounds.cues).toEqual(['correct']);
    const [cheer, description] = services.speaker.texts.slice(-2);
    expect(PRAISE.map((line) => line.text)).toContain(cheer);
    expect(description).toMatch(new RegExp(`^${target} is for \\w+!$`));
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
    expect(finaleTexts([...CARD_GAME_FINALES, ...ALL_STARS_FINALES])).toContain(
      services.speaker.lastText,
    );
  });

  it('ends a game with a missed round with fewer stars, and never claims all five', async () => {
    const { user, services } = renderApp('/play/letters/upper/find');
    for (let game = 0; game < 6; game++) {
      await missRound(user);
      await clickNext(user);
      for (let round = 2; round <= 5; round++) await solveRound(user);
      expect(screen.getByRole('heading', { name: 'You did it!' })).toBeInTheDocument();
      for (const bar of screen.getAllByRole('img', { name: /stars$/ })) {
        expect(bar).toHaveAccessibleName('4 of 5 stars');
      }
      expect(finaleTexts(CARD_GAME_FINALES)).toContain(services.speaker.lastText);
      await user.click(screen.getByRole('button', { name: 'Play again' }));
    }
  });

  it('celebrates every finished game with its own mascot and words', async () => {
    const { user, services } = renderApp('/play/letters/upper/find');
    const said = new Set<string>();
    for (let game = 0; game < 4; game++) {
      for (let round = 1; round <= 5; round++) await solveRound(user);
      const party = screen.getByRole('region', { name: 'You did it!' });
      expect(CARD_GAME_HEROES.some((hero) => party.textContent.includes(hero))).toBe(true);
      const finale = services.speaker.lastText ?? '';
      expect(party).toHaveTextContent(finale);
      said.add(finale);
      await user.click(screen.getByRole('button', { name: 'Play again' }));
    }
    expect(said.size).toBeGreaterThan(1);
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
