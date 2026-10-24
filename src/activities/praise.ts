import { line, type Line } from '../content/line';
import { pickOne, type Random } from '../core/random';

/** Lots of ways to say "well done", so the cheering doesn't get old. */
export const PRAISE: readonly Line[] = [
  'Yes!',
  'Yay!',
  'You got it!',
  'You found it!',
  "That's right!",
  'Great job!',
  'Hooray!',
  'Well done!',
  'Super!',
  'Awesome!',
  'Woohoo!',
  'Fantastic!',
  'Way to go!',
  'Amazing!',
].map((text) => line(text));

export function praise(random: Random): Line {
  return pickOne(random, PRAISE);
}

export const CARD_GAME_HERO = '🦉';
export const CARD_GAME_FINALE = line('Hooray! You did it! Give me a high five!');
