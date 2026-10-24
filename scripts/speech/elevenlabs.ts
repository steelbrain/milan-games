/**
 * A minimal ElevenLabs text-to-speech client. It sends only the words to say and the voice
 * settings: no names, no project details.
 */

export interface VoiceSettings {
  readonly stability: number;
  readonly similarity_boost: number;
  readonly style: number;
  readonly use_speaker_boost: boolean;
  readonly speed: number;
}

export interface SpeechRequest {
  readonly voiceId: string;
  readonly text: string;
  readonly modelId: string;
  /** Different seeds give different deliveries of the same words; the same seed repeats one. */
  readonly seed: number;
  readonly settings: VoiceSettings;
}

export interface SpeechResult {
  /** 16-bit little-endian mono PCM at SAMPLE_RATE. */
  readonly pcm: Uint8Array;
  /** Credits charged for the request, when the API reports it. */
  readonly credits: number;
}

export const SAMPLE_RATE = 24000;
const OUTPUT_FORMAT = `pcm_${SAMPLE_RATE}`;
const API = 'https://api.elevenlabs.io/v1/text-to-speech';

/** The account ran out of credits; nothing more can be recorded until it is topped up. */
export class QuotaExceededError extends Error {}

export class ElevenLabsError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ClientOptions {
  readonly apiKey: string;
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly maxAttempts?: number;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createElevenLabsClient({
  apiKey,
  fetch: fetchFn = fetch,
  sleep = wait,
  maxAttempts = 6,
}: ClientOptions) {
  return async function synthesize(request: SpeechRequest): Promise<SpeechResult> {
    for (let attempt = 1; ; attempt++) {
      let response: Response | undefined;
      try {
        response = await fetchFn(`${API}/${request.voiceId}?output_format=${OUTPUT_FORMAT}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            text: request.text,
            model_id: request.modelId,
            seed: request.seed,
            voice_settings: request.settings,
          }),
        });
      } catch (error) {
        // Network hiccup: retry like a server error.
        if (attempt >= maxAttempts) throw error;
      }

      if (response?.ok) {
        return {
          pcm: new Uint8Array(await response.arrayBuffer()),
          credits: Number(response.headers.get('character-cost') ?? 0),
        };
      }

      if (response) {
        const body = await response.text();
        if (/quota|credits|insufficient/i.test(body) && [401, 402, 403].includes(response.status)) {
          throw new QuotaExceededError(`ElevenLabs credits ran out: ${body.slice(0, 200)}`);
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt >= maxAttempts) {
          throw new ElevenLabsError(
            response.status,
            `ElevenLabs ${response.status}: ${body.slice(0, 300)}`,
          );
        }
        const retryAfter = Number(response.headers.get('retry-after'));
        if (retryAfter > 0) {
          await sleep(retryAfter * 1000);
          continue;
        }
      }
      await sleep(Math.min(30_000, 500 * 2 ** (attempt - 1)));
    }
  };
}
