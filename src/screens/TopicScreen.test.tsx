import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../services/storage';
import { createTestServices } from '../test/fakes';
import { renderApp } from '../test/render';

describe('TopicScreen', () => {
  it('greets and offers counting levels and stories', () => {
    const { services } = renderApp('/topic/counting');
    expect(screen.getByRole('heading', { name: 'Counting' })).toBeInTheDocument();
    expect(services.speaker.texts).toEqual(["Let's count! Pick a story."]);

    expect(screen.getByRole('radio', { name: 'Count to 5' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Count to 10' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Count to 20' })).not.toBeChecked();
    for (const story of ["Bunny's Picnic", "Puppy's Walk", 'Space Trip', 'Under the Sea']) {
      expect(screen.getByRole('link', { name: story })).toBeInTheDocument();
    }
  });

  it('starts the chosen story at the chosen level, and remembers the level', async () => {
    const { user, services } = renderApp('/topic/counting');
    await user.click(screen.getByRole('radio', { name: 'Count to 20' }));
    expect(screen.getByRole('radio', { name: 'Count to 20' })).toBeChecked();
    expect(services.store.read('level:counting')).toBe('20');
    expect(services.sounds.cues).toEqual(['tap']);

    await user.click(screen.getByRole('link', { name: 'Space Trip' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/play/counting/20/space');
  });

  it('restores the last level', () => {
    const services = createTestServices({ store: createMemoryStore({ 'level:letters': 'lower' }) });
    renderApp('/topic/letters', { services });
    expect(screen.getByRole('radio', { name: 'abc' })).toBeChecked();
    expect(screen.getByRole('link', { name: 'Find the letter' })).toHaveAttribute(
      'href',
      '/play/letters/lower/find',
    );
  });

  it('ignores a stored level that no longer exists', () => {
    const services = createTestServices({ store: createMemoryStore({ 'level:numbers': '99' }) });
    renderApp('/topic/numbers', { services });
    expect(screen.getByRole('radio', { name: '1 to 5' })).toBeChecked();
  });

  it('offers both card games', () => {
    renderApp('/topic/shapes');
    expect(screen.getByRole('link', { name: 'Find the shape' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'What shape is this?' })).toBeInTheDocument();
  });

  it('goes back home', async () => {
    const { user } = renderApp('/topic/colors');
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('sends unknown topics home', () => {
    renderApp('/topic/dinosaurs');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });
});
