import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PLAYER_NAME } from '../app/config';
import { renderApp } from '../test/render';

describe('HomeScreen', () => {
  it('greets the player and lists every game', () => {
    renderApp('/');
    expect(
      screen.getByRole('heading', { name: `Hi ${PLAYER_NAME}! Let's play!` }),
    ).toBeInTheDocument();
    const games = screen.getByRole('navigation', { name: 'Games' });
    expect(games).toBeInTheDocument();
    for (const title of ['Counting', 'Letters', 'Numbers', 'Colors', 'Shapes']) {
      expect(screen.getByRole('link', { name: title })).toBeInTheDocument();
    }
  });

  it('opens a game with a tap sound', async () => {
    const { user, services } = renderApp('/');
    await user.click(screen.getByRole('link', { name: 'Letters' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/topic/letters');
    expect(services.sounds.cues).toContain('tap');
  });

  it('has a mute switch that silences the whole app', async () => {
    const { user, services } = renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Turn sound off' }));
    const toggle = screen.getByRole('button', { name: 'Turn sound on' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('link', { name: 'Colors' }));
    expect(services.speaker.texts).toEqual([]);
    expect(services.sounds.cues).toEqual([]);
  });
});
