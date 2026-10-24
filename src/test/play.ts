import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** The prompt currently shown in the speech bubble. */
export function promptText(): string {
  const bubble = screen.getByRole('button', { name: 'Say it again' }).parentElement;
  return bubble?.querySelector('p')?.textContent ?? '';
}

/** Reads the target out of a "Find the letter B!" style prompt. */
export function findTarget(pattern: RegExp): string {
  const match = pattern.exec(promptText());
  if (!match?.[1]) throw new Error(`Prompt "${promptText()}" does not match ${String(pattern)}`);
  return match[1];
}

export function choiceButtons(groupName = 'Choices'): HTMLElement[] {
  return within(screen.getByRole('group', { name: groupName })).getAllByRole('button');
}

export async function clickNext(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: /^(Next|Finish)$/ }));
}
