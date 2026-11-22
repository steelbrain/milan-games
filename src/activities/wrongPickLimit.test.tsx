import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { choiceButtons, findTarget } from '../test/play';
import { renderApp } from '../test/render';
import type * as Choice from '../core/choice';

// The games miss a round on its first wrong pick. They also handle a higher limit, where each
// wrong pick before the last one gets a gentle "try again"; these tests play with two.
vi.mock('../core/choice', async (importOriginal) => ({
  ...(await importOriginal<typeof Choice>()),
  WRONG_PICKS_TO_MISS: 2,
}));

describe('with two wrong picks to miss a round', () => {
  it('the find games correct the first one and let the child try again', async () => {
    const { user, services } = renderApp('/play/letters/upper/find');
    const target = findTarget(/Find the letter (\w)!/);
    const wrong = choiceButtons().find((button) => button.getAttribute('aria-label') !== target);
    if (!wrong) throw new Error('No wrong choice');

    await user.click(wrong);

    expect(services.sounds.cues).toEqual(['tryAgain']);
    expect(services.speaker.texts.slice(-2)).toEqual([
      `That's ${wrong.getAttribute('aria-label') ?? ''}.`,
      `Find the letter ${target}!`,
    ]);
    expect(wrong).toHaveAttribute('data-status', 'wrong');
    expect(screen.getByRole('button', { name: target })).toHaveAttribute('data-status', 'idle');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('counting corrects the first one and lets the child try again', async () => {
    const { user, services } = renderApp('/play/counting/10/picnic');
    const board = screen.getByRole('group', { name: /to count$/ });
    const count = within(board).getAllByRole('button').length;
    const wrong = choiceButtons('How many?').find(
      (button) => button.getAttribute('aria-label') !== String(count),
    );
    if (!wrong) throw new Error('No wrong choice');

    await user.click(wrong);

    expect(services.sounds.cues).toEqual(['tryAgain']);
    expect(services.speaker.texts.slice(-2)).toEqual([
      `Not ${wrong.getAttribute('aria-label') ?? ''}.`,
      "Let's try again!",
    ]);
    expect(wrong).toHaveAttribute('data-status', 'wrong');
    expect(screen.getByRole('button', { name: 'Count with me' })).toBeEnabled();
    expect(screen.getByRole('img', { name: '0 of 5 stars' })).toBeInTheDocument();
  });
});
