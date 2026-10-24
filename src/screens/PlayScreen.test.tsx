import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STORIES } from '../content/stories';
import { renderApp } from '../test/render';

/** The things the sea story counts; a game can open on any of its pages. */
const seaNouns = STORIES.find((story) => story.id === 'sea')?.scenes.map((s) => s.item.many) ?? [];

describe('PlayScreen', () => {
  it.each([
    ['/play/letters/upper/find', /^Find the letter/],
    ['/play/numbers/10/say', /^What number is this\?/],
    ['/play/colors/rainbow/find', /^Can you find/],
    ['/play/shapes/all/say', /^What shape is this\?/],
    ['/play/counting/10/sea', new RegExp(`How many (${seaNouns.join('|')})\\?$`)],
  ])('%s starts the right game', (route, prompt) => {
    renderApp(route);
    expect(screen.getByText(prompt)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 5 stars' })).toBeInTheDocument();
  });

  it.each([
    '/play/letters/upper/dance',
    '/play/letters/huge/find',
    '/play/counting/5/moon',
    '/nowhere',
  ])('%s goes home', (route) => {
    renderApp(route);
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('goes back to the game menu', async () => {
    const { user } = renderApp('/play/letters/upper/find');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/topic/letters');
  });
});
