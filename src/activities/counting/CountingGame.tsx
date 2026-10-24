import { type CSSProperties, useEffect, useEffectEvent, useState } from 'react';
import type { Story } from '../../content/stories';
import { choiceStatus, choose } from '../../core/choice';
import { useGameSession } from '../../core/useGameSession';
import { useAnnouncement, useAudio } from '../../services/audio';
import { useServices } from '../../services/services';
import { BigButton } from '../../ui/BigButton';
import { Glyph } from '../../ui/CardFace';
import { ChoiceTile } from '../../ui/ChoiceTile';
import { cx } from '../../ui/cx';
import { GameFrame } from '../../ui/GameFrame';
import { PromptBubble } from '../../ui/PromptBubble';
import { praise } from '../praise';
import styles from './CountingGame.module.css';
import {
  countAloud,
  type CountingRange,
  type CountingRound,
  countingQuestion,
  countingRetry,
  countingSuccess,
  countTogether,
  countItem,
  createCountingRounds,
  initialCountingState,
  itemIds,
  resetCount,
  storyEnding,
} from './countingLogic';

/** How long "Count with me" waits between items. */
export const HELP_STEP_MS = 1100;

interface CountingGameProps {
  readonly story: Story;
  readonly range: CountingRange;
  readonly exitTo: string;
}

/** A counting story: each scene asks "How many?", the child taps to count, then picks a number. */
export function CountingGame({ story, range, exitTo }: CountingGameProps) {
  const { random } = useServices();
  const session = useGameSession(() => createCountingRounds(random, story, range));
  return (
    <GameFrame session={session} exitTo={exitTo} hero={story.hero} finale={storyEnding(story)}>
      {(round) => (
        <CountingRoundView
          round={round}
          story={story}
          isLastRound={session.isLastRound}
          onSolved={session.solve}
          onNext={session.next}
        />
      )}
    </GameFrame>
  );
}

interface CountingRoundViewProps {
  readonly round: CountingRound;
  readonly story: Story;
  readonly isLastRound: boolean;
  readonly onSolved: () => void;
  readonly onNext: () => void;
}

function CountingRoundView({
  round,
  story,
  isLastRound,
  onSolved,
  onNext,
}: CountingRoundViewProps) {
  const { random } = useServices();
  const { say, play } = useAudio();
  const [state, setState] = useState(initialCountingState);
  const [helping, setHelping] = useState(false);
  const { scene } = round;
  const { item } = scene;
  const solved = state.answer.solved;
  const question = countingQuestion(scene);
  useAnnouncement(question);

  const countNext = (itemId: number) => {
    const next = countItem(state, itemId);
    if (next === state) return;
    setState(next);
    const tally = next.counted.length;
    play('count', { step: tally });
    say(...countAloud(tally, round.count));
  };

  const helpTick = useEffectEvent(() => {
    const nextId = itemIds(round).find((id) => !state.counted.includes(id));
    if (nextId === undefined) setHelping(false);
    else countNext(nextId);
  });

  // One timeout per item, re-armed after each count renders, so a tick never sees stale state.
  const helpedSoFar = state.counted.length;
  useEffect(() => {
    if (!helping) return;
    const timer = setTimeout(() => helpTick(), HELP_STEP_MS);
    return () => clearTimeout(timer);
  }, [helping, helpedSoFar]);

  const startHelp = () => {
    setState(resetCount(state));
    setHelping(true);
    play('tap');
    say(countTogether(scene));
  };

  const pick = (choice: number) => {
    const result = choose(state.answer, round.count, choice);
    if (result.outcome === 'ignored') return;
    setState({ ...state, answer: result.state });
    setHelping(false);
    if (result.outcome === 'correct') {
      play('correct');
      say(...countingSuccess(praise(random), scene, round.count));
      onSolved();
    } else {
      play('tryAgain');
      say(...countingRetry(choice));
    }
  };

  const sceneryStyle = {
    '--scenery-top': story.scenery.top,
    '--scenery-bottom': story.scenery.bottom,
    '--grid': round.gridSize,
  } as CSSProperties;

  return (
    <div className={styles.round}>
      <PromptBubble
        caption={question.text}
        onReplay={() => say(question)}
        speaker={<span className={cx(styles.hero, solved && styles.cheering)}>{story.hero}</span>}
      />
      <div className={styles.boardArea}>
        <div
          className={styles.board}
          style={sceneryStyle}
          role="group"
          aria-label={`${item.many} to count`}
        >
          {round.cells.map((cell, index) => {
            if (!cell) return <span key={index} />;
            const position = state.counted.indexOf(cell.id) + 1;
            return (
              <button
                key={index}
                type="button"
                className={cx(
                  styles.item,
                  position > 0 && styles.counted,
                  solved && styles.dancing,
                )}
                style={
                  {
                    '--tilt': `${cell.tilt}deg`,
                    '--nudge-x': `${cell.nudgeX}%`,
                    '--nudge-y': `${cell.nudgeY}%`,
                    '--order': cell.id,
                  } as CSSProperties
                }
                aria-label={position > 0 ? `${item.one} ${position}` : item.one}
                aria-pressed={position > 0}
                onClick={() => {
                  if (!helping) countNext(cell.id);
                }}
              >
                <span className={styles.emoji} aria-hidden="true">
                  {item.emoji}
                </span>
                {position > 0 && (
                  <span className={styles.badge} aria-hidden="true">
                    {position}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.footer}>
        <div className={styles.tally} role="status" aria-label="Counted so far">
          {state.counted.length}
        </div>
        <div className={styles.choices} role="group" aria-label="How many?">
          {round.choices.map((choice) => (
            <ChoiceTile
              key={choice}
              label={String(choice)}
              status={choiceStatus(state.answer, round.count, choice)}
              onChoose={() => pick(choice)}
            >
              <Glyph text={String(choice)} />
            </ChoiceTile>
          ))}
        </div>
        {solved ? (
          <BigButton icon={isLastRound ? '🎉' : '➡️'} onClick={onNext} pulse autoFocus>
            {isLastRound ? 'Finish' : 'Next'}
          </BigButton>
        ) : (
          <BigButton icon="🙌" variant="plain" onClick={startHelp} disabled={helping}>
            Count with me
          </BigButton>
        )}
      </div>
    </div>
  );
}
