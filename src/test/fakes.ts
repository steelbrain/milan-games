import { type Line, spokenText } from '../content/line';
import { createSeededRandom } from '../core/random';
import type { OfflineSaver, OfflineStatus } from '../offline/offlineSaver';
import type { Services } from '../services/services';
import type { CueOptions, SoundCue } from '../services/soundCues';
import type { SoundPlayer } from '../services/sounds';
import type { Speaker } from '../services/speech';
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

  /** Strict speakers report lines missing from the speech catalog. */
  private readonly strict: boolean;

  constructor(strict = true) {
    this.strict = strict;
  }

  readonly say = (...lines: Line[]) => {
    for (const line of lines) {
      this.lines.push(line);
      if (!this.strict) continue;
      catalogIds ??= new Set(speechCatalog().map((entry) => clipId(entry.line)));
      if (!catalogIds.has(clipId(line))) uncataloged.push(spokenText(line));
    }
  };
  readonly stop = () => {
    this.stops++;
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
  readonly savedVoices = () => Promise.resolve([]);

  /** Moves to a new status, the way a real download would. */
  set(status: OfflineStatus): void {
    this.current = status;
    for (const listener of this.listeners) listener();
  }
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
}: {
  seed?: number;
  store?: Store;
  strictSpeech?: boolean;
  offline?: FakeOfflineSaver;
} = {}): TestServices {
  return {
    speaker: new RecordingSpeaker(strictSpeech),
    sounds: new RecordingSoundPlayer(),
    random: createSeededRandom(seed),
    store,
    offline,
  };
}
