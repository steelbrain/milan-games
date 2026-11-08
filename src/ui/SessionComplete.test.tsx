import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ALL_STARS_FINALES, CARD_GAME_FINALES } from '../activities/praise';
import { AppProviders } from '../app/AppProviders';
import type { RoundResult } from '../core/session';
import { createTestServices } from '../test/fakes';
import { SessionComplete } from './SessionComplete';

const [usual] = CARD_GAME_FINALES;
const [allStars] = ALL_STARS_FINALES;

function finish(results: RoundResult[], finales = CARD_GAME_FINALES.slice(0, 1)) {
  const services = createTestServices();
  render(
    <AppProviders services={services}>
      <SessionComplete
        heroes={['🦉']}
        finales={finales}
        allStarsFinales={ALL_STARS_FINALES.slice(0, 1)}
        results={results}
        total={results.length}
        onPlayAgain={() => undefined}
        onDone={() => undefined}
      />
    </AppProviders>,
  );
  return services.speaker.lastText;
}

describe('SessionComplete', () => {
  it('only says the all-stars endings after a game with every star', () => {
    expect(finish(['star', 'missed'])).toBe(usual?.text);
    expect(finish(['star', 'star'], [])).toBe(allStars?.text);
  });

  it('shows the stars the game actually earned', () => {
    finish(['star', 'missed', 'star']);
    expect(screen.getByRole('img', { name: '2 of 3 stars' })).toBeInTheDocument();
  });
});
