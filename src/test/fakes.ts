import { type Line, spokenText } from '../content/line';
import { createSeededRandom } from '../core/random';
import type { OfflineSaver, OfflineStatus } from '../offline/offlineSaver';
import type { Services } from '../services/services';
import type { CueOptions, SoundCue } from '../services/soundCues';
import type { SoundPlayer } from '../services/sounds';
import { NO_SPEECH, type Speaker, type Speech } from '../services/speech';
import { createMemoryStore, type Store } from '../services/storage';
import { speechCatalog } from '../speech/catalog';
import { clipId } from '../speech/clipId';

let catalogIds: Set<string> | undefined;
const uncataloged: string[] = [];

/**
 * Lines said during a test that have no recording in the speech catalog. The test setup fails any
 * test that leaves something here, so the games can never say a line nobody recorded.
 */
export function takeUncatalogedLines(): string[] {
  return uncataloged.splice(0);
}

/** A Speaker that remembers everything it was asked to say. */
export class RecordingSpeaker implements Speaker {
  readonly lines: Line[] = [];
  stops = 0;
  unlocks = 0;
  /**
   * Normally speech finishes at once. While this is set, it keeps "playing" until
   * `finishSpeaking`, `stop` or the next `say`, the way real speech takes time.
   */
  holdSpeech = false;

  /** Strict speakers report lines missing from the speech catalog. */
  private readonly strict: boolean;
  private cutOff = () => {};

  constructor(strict = true) {
    this.strict = strict;
  }

  readonly say = (...lines: Line[]): Speech => {
    this.cutOff();
    for (const line of lines) {
      this.lines.push(line);
      if (!this.strict) continue;
      catalogIds ??= new Set(speechCatalog().map((entry) => clipId(entry.line)));
      if (!catalogIds.has(clipId(line))) uncataloged.push(spokenText(line));
    }
    if (!this.holdSpeech) return NO_SPEECH;
    return {
      finished: new Promise((resolve) => {
        this.cutOff = resolve;
      }),
    };
  };
  readonly stop = () => {
    this.stops++;
    this.cutOff();
  };
  /** Ends the speech `holdSpeech` kept playing. */
  readonly finishSpeaking = () => {
    this.cutOff();
  };
  readonly unlock = () => {
    this.unlocks++;
  };

  get texts(): string[] {
    return this.lines.map((line) => line.text);
  }

  get lastText(): string | undefined {
    return this.lines.at(-1)?.text;
  }

  clear(): void {
    this.lines.length = 0;
  }
}

/** A SoundPlayer that remembers every cue it was asked to play. */
export class RecordingSoundPlayer implements SoundPlayer {
  readonly played: { cue: SoundCue; options?: CueOptions }[] = [];
  unlocks = 0;

  readonly play = (cue: SoundCue, options?: CueOptions) => {
    this.played.push(options ? { cue, options } : { cue });
  };
  readonly unlock = () => {
    this.unlocks++;
  };

  get cues(): SoundCue[] {
    return this.played.map((entry) => entry.cue);
  }

  clear(): void {
    this.played.length = 0;
  }
}

/** An OfflineSaver whose status tests move along by hand; it counts starts and stops. */
export class FakeOfflineSaver implements OfflineSaver {
  starts = 0;
  stops = 0;
  removes = 0;

  private current: OfflineStatus;
  private readonly listeners = new Set<() => void>();

  constructor(status: OfflineStatus = { phase: 'unsupported', saved: 0, total: 0 }) {
    this.current = status;
  }

  readonly status = () => this.current;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  readonly start = () => {
    this.starts++;
  };
  readonly stop = () => {
    this.stops++;
  };
  readonly remove = () => {
    this.removes++;
    return Promise.resolve();
  };
  readonly savedVoices = () => Promise.resolve([]);

  /** Moves to a new status, the way a real download would. */
  set(status: OfflineStatus): void {
    this.current = status;
    for (const listener of this.listeners) listener();
  }
}

/** A clock that moves on a second at every reading, like a child tapping at a calm pace. */
export function steadyClock(stepMs = 1000): () => number {
  let time = 0;
  return () => (time += stepMs);
}

export interface TestServices extends Services {
  readonly speaker: RecordingSpeaker;
  readonly sounds: RecordingSoundPlayer;
  readonly offline: FakeOfflineSaver;
}

export function createTestServices({
  seed = 7,
  store = createMemoryStore(),
  strictSpeech = true,
  offline = new FakeOfflineSaver(),
  now = steadyClock(),
}: {
  seed?: number;
  store?: Store;
  strictSpeech?: boolean;
  offline?: FakeOfflineSaver;
  now?: () => number;
} = {}): TestServices {
  return {
    speaker: new RecordingSpeaker(strictSpeech),
    sounds: new RecordingSoundPlayer(),
    random: createSeededRandom(seed),
    now,
    store,
    offline,
  };
}
