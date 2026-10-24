import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { clickNext, promptText } from '../../test/play';
import { renderApp } from '../../test/render';

describe('SayGame', () => {
  it('asks what the card is, without giving the answer away', () => {
    const { services } = renderApp('/play/letters/upper/say');
    expect(promptText()).toBe('What letter is this?');
    expect(services.speaker.texts).toEqual(['What letter is this?']);
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 5 stars' })).toBeInTheDocument();
  });

  it('reveals the answer with a sparkle, a picture and a star', async () => {
    const { user, services } = renderApp('/play/letters/upper/say');
    await user.click(screen.getByRole('button', { name: 'Show me' }));

    expect(services.sounds.cues).toEqual(['reveal']);
    expect(services.speaker.lastText).toMatch(/^(\w)! \1 is for .+\.$/);
    expect(promptText()).toBe(services.speaker.lastText);
    expect(screen.getByRole('figure')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1 of 5 stars' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show me' })).not.toBeInTheDocument();
  });

  it('repeats the answer after the reveal', async () => {
    const { user, services } = renderApp('/play/letters/upper/say');
    await user.click(screen.getByRole('button', { name: 'Show me' }));
    const answer = services.speaker.lastText;
    await user.click(screen.getByRole('button', { name: 'Say it again' }));
    expect(services.speaker.lastText).toBe(answer);
  });

  it('shows numbers as dots in ten frames', async () => {
    const { user, services } = renderApp('/play/numbers/20/say');
    await user.click(screen.getByRole('button', { name: 'Show me' }));
    expect(screen.getByRole('img', { name: /^\d+ dots?$/ })).toBeInTheDocument();
    const [number, dots] = services.speaker.texts.slice(-2);
    expect(number).toMatch(/^\d+!$/);
    expect(dots).toMatch(/^Here (is|are) \d+ dots?\.$/);
    expect(promptText()).toBe(`${number ?? ''} ${dots ?? ''}`);
  });

  it('plays five cards, then celebrates', async () => {
    const { user, services } = renderApp('/play/colors/rainbow/say');
    for (let card = 1; card <= 5; card++) {
      await user.click(screen.getByRole('button', { name: 'Show me' }));
      await clickNext(user);
    }
    expect(screen.getByRole('heading', { name: 'You did it!' })).toBeInTheDocument();
    expect(services.sounds.cues.at(-1)).toBe('celebrate');
  });
});
