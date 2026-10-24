# Milan's Games

Little learning games for a three-year-old, made to play together on a tablet or phone.

| Game         | What it practices                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Counting** | Story adventures ("Bunny's Picnic", "Space Trip"…). Tap each thing to count it out loud, then pick how many. Count to 5, 10 or 20. "Count with me" counts together. |
| **Letters**  | "Find the letter B!" and "What letter is this?" flash cards, in ABC or abc.                                                                                         |
| **Numbers**  | The same two games with numerals 1–5, 1–10 or 1–20, shown as dots in ten frames.                                                                                    |
| **Colors**   | Find or name the rainbow colors, or all ten.                                                                                                                        |
| **Shapes**   | Find or name circles, squares, triangles, stars, hearts and more.                                                                                                   |

Everything is spoken with pre-recorded, natural-sounding speech, so the child doesn't need to
read. Wrong answers only get a gentle "try again"; nobody ever fails. Every round earns a star,
and five stars end in a party.

## Playing

```sh
npm install
npm run dev -- --host     # then open the "Network" URL on the iPad
```

On an iPad, use **Share → Add to Home Screen** for a full-screen app. The mute button is in the
top corner. `npm run build` produces a static site in `dist/` that works from any web host or
folder, because routing uses the URL hash.

## Commands

| Command                 | What it does                                                     |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run dev`           | Development server with hot reload.                              |
| `npm run build`         | Type-check and build the static site into `dist/`.               |
| `npm test`              | Unit and component tests (Vitest + Testing Library).             |
| `npm run test:coverage` | The same, with a coverage report and thresholds.                 |
| `npm run e2e`           | End-to-end tests of the production build in Chrome (Playwright). |
| `npm run lint`          | ESLint, including the React Hooks and React Compiler rules.      |
| `npm run check`         | Everything above, the way CI should run it.                      |
| `npm run speech`        | Record speech after changing what the games say (ElevenLabs).    |

## How it's built

```
src/
  core/        Game-agnostic logic: seeded randomness, sessions of rounds, multiple choice.
  content/     What the games teach: letter, number, color and shape decks; counting stories.
  topics/      The menu: which topics exist, their levels ("Count to 10") and activities.
  activities/  The three kinds of game: find/ ("Find the B"), say/ (flash cards), counting/.
  speech/      The catalog of every spoken line, clip naming and the recordings manifest.
  services/    The outside world: recorded speech, sound effects, storage, audio unlocking.
  ui/          Shared presentational components (buttons, tiles, stars, confetti, frames).
  screens/     Home, topic menu and play screens, wired up in app/AppRoutes.tsx.
  app/         Providers, routes and the real browser services.
scripts/speech Speech recording: catalog → ElevenLabs voices → AAC clips in public/speech/.
e2e/           Playwright tests that play whole games in a real browser.
```

A few ideas hold it together:

- **Logic is pure and separate from React.** Round generation, answer checking and counting
  rules are plain functions (`findLogic.ts`, `countingLogic.ts`, `core/`), tested on their own.
  Components only wire them to the screen and to sound.
- **Side effects are injected.** Components get speech, sound effects, randomness and storage
  from `ServicesContext`, never from browser globals. Tests pass recording fakes and a seeded
  random generator, so every game is reproducible.
- **Content is data.** A new counting story is one entry in `content/stories.ts`. A new level is
  one entry in `topics/topics.ts`. A new deck follows the `Deck` interface in `content/cards.ts`.
- **Every round remounts.** `GameFrame` keys each round, so round state never leaks between
  rounds, and `useGameSession` handles the stars, the end of the game and playing again.

## Speech

The browser's built-in voices sound robotic, so every line is recorded ahead of time with
ElevenLabs, in four voices (Katie, Lulu, Clara and Zara), and played back with Web Audio:

1. `src/speech/catalog.ts` lists every line the games can say, built from the same helper
   functions the games use. Long sentences are split into reusable clips, such as "Great job!"
   followed by "B! B is for Ball.", so ~720 lines cover every combination.
2. `npm run speech` records each line in each voice (`scripts/speech/`), trims the silence,
   evens out the loudness across clips and voices, and encodes small AAC files into
   `public/speech/<voice>/`. It only records what is missing, so it is safe to stop and re-run,
   and it stops cleanly if the account runs out of credits.
3. **The voice changes per visit.** The app picks one voice at random on each page load and keeps
   it, so the game always sounds like the same person until the next refresh.
4. **Repeated lines don't sound canned.** Each line has at least 5 _takes_ in every voice, each a
   genuinely different delivery (a different seed). Lines heard constantly get more: counting
   numbers have 8, and cheers and "try again" have 6. The player picks a random take and never
   repeats the previous one. Sound effects work the same way: each jingle has several variants.
5. Anything without a recording falls back to the browser voice, but the tests make sure that
   never happens. Every unit test fails if a game says a line missing from the catalog. A test
   checks that the committed recordings cover every line, take and voice. The end-to-end tests
   fail if the fallback voice is ever used in a real browser, or if one visit mixes voices.

**After changing anything the games say, run `npm run speech` and commit `public/speech/`.**
It needs `ELEVENLABS_API_KEY` in `.local.env` (git-ignored) and costs roughly 0.44 credits per
character. `npm run speech -- --dry-run` shows what would be recorded and the estimated cost
first. Only the words to say are sent to ElevenLabs. Voices live in `scripts/speech/voices.ts`,
and the model and voice settings live at the top of `scripts/speech/generate.ts`. To re-record a
clip, delete its file and run the command again.

## Tests

- **Unit tests** cover the pure logic, content invariants (for example, every letter's word
  starts with that letter, and every counting board fits its biggest number), the speech catalog,
  and the audio services against fake Web Audio and speech engines.
- **Component tests** play the games through the real router and providers, the way a child
  would: tap, hear, get it wrong, get it right, finish, play again.
- **End-to-end tests** build the production site and play whole games in Chrome at tablet and
  phone sizes. They also check that layouts fit without scrolling and that settings survive a
  reload.
