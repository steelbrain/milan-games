import { useState } from 'react';
import type { Deck } from '../../content/cards';
import { choiceStatus, choose, initialChoiceState } from '../../core/choice';
import { useGameSession } from '../../core/useGameSession';
import { useAnnouncement, useAudio } from '../../services/audio';
import { useServices } from '../../services/services';
import { CHOICES_PER_ROUND, ROUNDS_PER_CARD_GAME } from '../../topics/topics';
import { BigButton } from '../../ui/BigButton';
import { CardExample } from '../../ui/CardExample';
import { CardFace } from '../../ui/CardFace';
import { ChoiceTile } from '../../ui/ChoiceTile';
import { GameFrame } from '../../ui/GameFrame';
import { PromptBubble } from '../../ui/PromptBubble';
import { CARD_GAME_FINALE, CARD_GAME_HERO, praise } from '../praise';
import styles from './FindGame.module.css';
import { createFindRounds, type FindRound, namedCard } from './findLogic';

interface FindGameProps {
  readonly deck: Deck;
  readonly exitTo: string;
}

/** "Find the letter B!": the child picks the named card out of a few. */
export function FindGame({ deck, exitTo }: FindGameProps) {
  const { random } = useServices();
  const session = useGameSession(() =>
    createFindRounds(deck.cards, random, {
      rounds: ROUNDS_PER_CARD_GAME,
      choices: CHOICES_PER_ROUND,
    }),
  );
  return (
    <GameFrame session={session} exitTo={exitTo} hero={CARD_GAME_HERO} finale={CARD_GAME_FINALE}>
      {(round) => (
        <FindRoundView
          round={round}
          deck={deck}
          isLastRound={session.isLastRound}
          onSolved={session.solve}
          onNext={session.next}
        />
      )}
    </GameFrame>
  );
}

interface FindRoundViewProps {
  readonly round: FindRound;
  readonly deck: Deck;
  readonly isLastRound: boolean;
  readonly onSolved: () => void;
  readonly onNext: () => void;
}

function FindRoundView({ round, deck, isLastRound, onSolved, onNext }: FindRoundViewProps) {
  const { random } = useServices();
  const { say, play } = useAudio();
  const [state, setState] = useState(initialChoiceState<string>);
  const { target } = round;
  const prompt = deck.findPrompt(target);
  useAnnouncement(prompt);

  const pick = (cardId: string) => {
    const result = choose(state, target.id, cardId);
    if (result.outcome === 'ignored') return;
    setState(result.state);
    if (result.outcome === 'correct') {
      play('correct');
      say(praise(random), ...deck.describe(target));
      onSolved();
    } else {
      const chosen = round.choices.find((card) => card.id === cardId);
      play('tryAgain');
      if (chosen) say(namedCard(chosen), prompt);
    }
  };

  return (
    <div className={styles.round}>
      <PromptBubble caption={prompt.text} onReplay={() => say(prompt)} />
      <div className={styles.choices} role="group" aria-label="Choices">
        {round.choices.map((card) => (
          <ChoiceTile
            key={card.id}
            label={card.name.text}
            status={choiceStatus(state, target.id, card.id)}
            onChoose={() => pick(card.id)}
          >
            <CardFace card={card} />
          </ChoiceTile>
        ))}
      </div>
      <div className={styles.after}>
        {state.solved && (
          <>
            <CardExample example={target.example} />
            <BigButton icon={isLastRound ? '🎉' : '➡️'} onClick={onNext} pulse autoFocus>
              {isLastRound ? 'Finish' : 'Next'}
            </BigButton>
          </>
        )}
      </div>
    </div>
  );
}
