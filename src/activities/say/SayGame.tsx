import { useState } from 'react';
import type { Card, Deck } from '../../content/cards';
import { caption } from '../../content/line';
import { drawSequence } from '../../core/random';
import { useGameSession } from '../../core/useGameSession';
import { useAnnouncement, useAudio } from '../../services/audio';
import { useServices } from '../../services/services';
import { ROUNDS_PER_CARD_GAME } from '../../topics/topics';
import { BigButton } from '../../ui/BigButton';
import { CardExample } from '../../ui/CardExample';
import { CardFace } from '../../ui/CardFace';
import { GameFrame } from '../../ui/GameFrame';
import { PromptBubble } from '../../ui/PromptBubble';
import { CARD_GAME_FINALES, CARD_GAME_HEROES } from '../praise';
import styles from './SayGame.module.css';

interface SayGameProps {
  readonly deck: Deck;
  readonly exitTo: string;
}

/**
 * "What letter is this?": a flash card game to play together. The child says the answer out
 * loud, then taps "Show me" to hear it and see a picture.
 */
export function SayGame({ deck, exitTo }: SayGameProps) {
  const { random } = useServices();
  const session = useGameSession(() => drawSequence(random, deck.cards, ROUNDS_PER_CARD_GAME));
  return (
    <GameFrame
      session={session}
      exitTo={exitTo}
      heroes={CARD_GAME_HEROES}
      finales={CARD_GAME_FINALES}
    >
      {(card) => (
        <SayRoundView
          card={card}
          deck={deck}
          isLastRound={session.isLastRound}
          onSolved={session.solve}
          onNext={session.next}
        />
      )}
    </GameFrame>
  );
}

interface SayRoundViewProps {
  readonly card: Card;
  readonly deck: Deck;
  readonly isLastRound: boolean;
  readonly onSolved: () => void;
  readonly onNext: () => void;
}

function SayRoundView({ card, deck, isLastRound, onSolved, onNext }: SayRoundViewProps) {
  const { say, play } = useAudio();
  const [revealed, setRevealed] = useState(false);
  const answer = deck.describe(card);
  const bubble = revealed ? answer : [deck.askPrompt];
  useAnnouncement(deck.askPrompt);

  const reveal = () => {
    if (revealed) return;
    setRevealed(true);
    play('reveal');
    say(...answer);
    onSolved();
  };

  return (
    <div className={styles.round}>
      <PromptBubble caption={caption(bubble)} onReplay={() => say(...bubble)} />
      <div className={styles.card} data-revealed={revealed}>
        <CardFace card={card} />
      </div>
      <div className={styles.after}>
        {revealed ? (
          <>
            <CardExample example={card.example} />
            <BigButton icon={isLastRound ? '🎉' : '➡️'} onClick={onNext} pulse autoFocus>
              {isLastRound ? 'Finish' : 'Next'}
            </BigButton>
          </>
        ) : (
          <BigButton icon="👀" onClick={reveal}>
            Show me
          </BigButton>
        )}
      </div>
    </div>
  );
}
