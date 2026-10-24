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

/** Friendly faces for the card games' "You did it!" screen; each finished game gets one. */
export const CARD_GAME_HEROES: readonly string[] = [
  '🦉',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🦁',
  '🐯',
  '🐸',
  '🐵',
  '🐧',
  '🦒',
  '🐘',
];

/** Ways to celebrate a finished card game, so the ending doesn't get old either. */
export const CARD_GAME_FINALES: readonly Line[] = [
  'Hooray! You did it! Give me a high five!',
  "You did it! You're a superstar!",
  'Woohoo! You got all five stars!',
  'Amazing! You finished the whole game!',
  "Yay! You did it! Let's do a happy dance!",
  "Great playing! I'm so proud of you!",
  'Wow, five stars! You are so clever!',
].map((text) => line(text));
