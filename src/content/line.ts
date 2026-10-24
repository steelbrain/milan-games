/**
 * Something the game says out loud, with the caption shown on screen. `speech` overrides what
 * the speech engine reads when the written form would be mispronounced (a lone "A" is often
 * read as "uh").
 */
export interface Line {
  readonly text: string;
  readonly speech?: string;
}

/**
 * Lines said one after another, like "Great job!" then "B is for Ball!". Each line is one
 * pre-recorded clip, so splitting sentences into reusable lines keeps the number of clips small.
 */
export type Utterance = readonly Line[];

/** The on-screen caption for an utterance. */
export function caption(lines: Utterance): string {
  return lines.map((part) => part.text).join(' ');
}

export function line(text: string, speech?: string): Line {
  return speech === undefined || speech === text ? { text } : { text, speech };
}

export function spokenText(value: Line): string {
  return value.speech ?? value.text;
}

type Part = string | number | Line;

/**
 * Builds a Line from a template, keeping the caption and the spoken form in step:
 * phrase`Find the letter ${card.name}!` reads "Find the letter ay!" but shows "Find the letter A!".
 */
export function phrase(strings: TemplateStringsArray, ...parts: Part[]): Line {
  let text = strings[0] ?? '';
  let speech = text;
  parts.forEach((part, i) => {
    const tail = strings[i + 1] ?? '';
    if (typeof part === 'object') {
      text += part.text + tail;
      speech += spokenText(part) + tail;
    } else {
      text += String(part) + tail;
      speech += String(part) + tail;
    }
  });
  return line(text, speech);
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "an apple", "a banana". Good enough for the simple nouns used in the games. */
export function withArticle(noun: string): string {
  return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
