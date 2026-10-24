export interface ClipInfo {
  /** The words in the clip, for people reading the manifest. */
  readonly words: string;
  /** How many takes of it every voice has; see TAKES in catalog.ts. */
  readonly takes: number;
}

export interface VoiceInfo {
  /** Folder under speech/ holding this voice's clips. */
  readonly id: string;
  readonly name: string;
}

/** Written by `npm run speech` next to the clips: which voices and clips exist. */
export interface SpeechManifest {
  readonly voices: readonly VoiceInfo[];
  readonly clips: Readonly<Record<string, ClipInfo>>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function isClipInfo(value: unknown): value is ClipInfo {
  return (
    isObject(value) &&
    typeof value.words === 'string' &&
    typeof value.takes === 'number' &&
    Number.isInteger(value.takes) &&
    value.takes >= 1
  );
}

function isVoiceInfo(value: unknown): value is VoiceInfo {
  return isObject(value) && typeof value.id === 'string' && typeof value.name === 'string';
}

export function isSpeechManifest(value: unknown): value is SpeechManifest {
  return (
    isObject(value) &&
    Array.isArray(value.voices) &&
    value.voices.every(isVoiceInfo) &&
    isObject(value.clips) &&
    Object.values(value.clips).every(isClipInfo)
  );
}

/** Resolves to undefined (never rejects) when there are no recordings, so speech can fall back. */
export async function loadSpeechManifest(
  url: string,
  fetchJson: (url: string) => Promise<unknown> = defaultFetchJson,
): Promise<SpeechManifest | undefined> {
  try {
    const value = await fetchJson(url);
    return isSpeechManifest(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}
