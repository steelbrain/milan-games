import { type CSSProperties, useEffect, useEffectEvent, useRef, useState } from 'react';
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
  SLOW_DOWN,
  storyEnding,
  tappingTooFast,
  TOO_FAST,
} from './countingLogic';

/** The least time "Count with me" takes per item, even when muted or the words are quick. */
export const HELP_STEP_MS = 1100;
/** "Count with me" lets each line finish, then takes a breath before the next number. */
export const HELP_PAUSE_MS = 350;
/** How long the board rests after the child taps too fast. */
export const SLOW_DOWN_MS = 5000;

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
    <GameFrame
      session={session}
      exitTo={exitTo}
      heroes={[story.hero]}
      finales={[storyEnding(story)]}
    >
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
  const { random, now } = useServices();
  const { say, play } = useAudio();
  const [state, setState] = useState(initialCountingState);
  const [helping, setHelping] = useState(false);
  // After tapping too fast, the board takes a short rest and the count starts over.
  const [resting, setResting] = useState(false);
  const tapTimes = useRef<number[]>([]);
  // When the last thing said ends; "Count with me" never talks over it.
  const speaking = useRef(Promise.resolve());
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
    speaking.current = say(...countAloud(tally, round.count)).finished;
  };

  const tapItem = (itemId: number) => {
    if (helping || resting || countItem(state, itemId) === state) return;
    tapTimes.current = [...tapTimes.current, now()].slice(-TOO_FAST.taps);
    if (!tappingTooFast(tapTimes.current)) {
      countNext(itemId);
      return;
    }
    tapTimes.current = [];
    setState(resetCount(state));
    setResting(true);
    play('tryAgain');
    speaking.current = say(SLOW_DOWN).finished;
  };

  useEffect(() => {
    if (!resting) return;
    const timer = setTimeout(() => setResting(false), SLOW_DOWN_MS);
    return () => clearTimeout(timer);
  }, [resting]);

  const helpTick = useEffectEvent(() => {
    const nextId = itemIds(round).find((id) => !state.counted.includes(id));
    if (nextId === undefined) setHelping(false);
    else countNext(nextId);
  });

  // One wait per item, re-armed after each count renders, so a tick never sees stale state.
  // Each wait lasts until the last line has been said, plus a breath, and at least a step.
  const helpedSoFar = state.counted.length;
  useEffect(() => {
    if (!helping) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        if (!cancelled) timers.push(setTimeout(resolve, ms));
      });
    const lineEnded = speaking.current.then(() => wait(HELP_PAUSE_MS));
    void Promise.all([wait(HELP_STEP_MS), lineEnded]).then(() => {
      if (!cancelled) helpTick();
    });
    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [helping, helpedSoFar]);

  const startHelp = () => {
    if (resting) return;
    setState(resetCount(state));
    setHelping(true);
    play('tap');
    speaking.current = say(countTogether(scene)).finished;
  };

  const pick = (choice: number) => {
    if (resting) return;
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
        caption={resting ? SLOW_DOWN.text : question.text}
        onReplay={() => say(resting ? SLOW_DOWN : question)}
        speaker={<span className={cx(styles.hero, solved && styles.cheering)}>{story.hero}</span>}
      />
      <div className={cx(styles.boardArea, resting && styles.resting)} inert={resting}>
        {resting && (
          <span className={styles.turtle} aria-hidden="true">
            🐢
          </span>
        )}
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
                disabled={resting}
                // Counts the moment a finger lands: a small child's tap often slides a little,
                // which the browser would otherwise take for a scroll and never call a click.
                onPointerDown={(event) => {
                  if (event.button === 0) tapItem(cell.id);
                }}
                // Keyboard presses arrive as clicks with no pointer behind them.
                onClick={(event) => {
                  if (event.detail === 0) tapItem(cell.id);
                }}
              >
                <span className={styles.disc}>
                  <span className={styles.emoji} aria-hidden="true">
                    {item.emoji}
                  </span>
                  {position > 0 && (
                    <span className={styles.badge} aria-hidden="true">
                      {position}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={cx(styles.footer, resting && styles.resting)} inert={resting}>
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
          <BigButton icon="🙌" variant="plain" onClick={startHelp} disabled={helping || resting}>
            Count with me
          </BigButton>
        )}
      </div>
    </div>
  );
}
