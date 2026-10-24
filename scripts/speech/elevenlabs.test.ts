import { describe, expect, it, vi } from 'vitest';
import {
  createElevenLabsClient,
  ElevenLabsError,
  QuotaExceededError,
  type SpeechRequest,
} from './elevenlabs.ts';

const request: SpeechRequest = {
  voiceId: 'voice123',
  text: 'Yay!',
  modelId: 'eleven_multilingual_v2',
  seed: 42,
  settings: {
    stability: 0.4,
    similarity_boost: 0.8,
    style: 0.2,
    use_speaker_boost: true,
    speed: 1,
  },
};

const audio = (bytes = [1, 2, 3, 4], credits = '2') =>
  new Response(new Uint8Array(bytes), { headers: { 'character-cost': credits } });

function client(...responses: (Response | Error)[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const response of responses) {
    if (response instanceof Error) fetch.mockRejectedValueOnce(response);
    else fetch.mockResolvedValueOnce(response);
  }
  const sleep = vi.fn((_ms: number) => Promise.resolve());
  return { synthesize: createElevenLabsClient({ apiKey: 'secret', fetch, sleep }), fetch, sleep };
}

describe('createElevenLabsClient', () => {
  it('asks for raw PCM with just the words and voice settings', async () => {
    const { synthesize, fetch } = client(audio());
    const result = await synthesize(request);
    expect(result).toEqual({ pcm: new Uint8Array([1, 2, 3, 4]), credits: 2 });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/voice123?output_format=pcm_24000',
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'xi-api-key': 'secret', 'content-type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({
      text: 'Yay!',
      model_id: 'eleven_multilingual_v2',
      seed: 42,
      voice_settings: request.settings,
    });
  });

  it('retries rate limits and server errors with backoff', async () => {
    const { synthesize, sleep } = client(
      new Response('busy', { status: 429 }),
      new Response('oops', { status: 503 }),
      new Error('socket hang up'),
      audio(),
    );
    await expect(synthesize(request)).resolves.toMatchObject({ credits: 2 });
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000, 2000]);
  });

  it('honors Retry-After', async () => {
    const { synthesize, sleep } = client(
      new Response('slow down', { status: 429, headers: { 'retry-after': '3' } }),
      audio(),
    );
    await synthesize(request);
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it('gives up after too many attempts', async () => {
    const failures = Array.from({ length: 6 }, () => new Response('down', { status: 500 }));
    const { synthesize } = client(...failures);
    await expect(synthesize(request)).rejects.toBeInstanceOf(ElevenLabsError);
  });

  it('rethrows network errors on the last attempt', async () => {
    const failures = Array.from({ length: 6 }, () => new Error('offline'));
    const { synthesize } = client(...failures);
    await expect(synthesize(request)).rejects.toThrow('offline');
  });

  it('stops at once when the credits run out', async () => {
    const { synthesize, fetch } = client(
      new Response('{"detail":{"status":"quota_exceeded"}}', { status: 401 }),
    );
    await expect(synthesize(request)).rejects.toBeInstanceOf(QuotaExceededError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry other client errors', async () => {
    const { synthesize, fetch } = client(new Response('bad voice', { status: 400 }));
    const error = await synthesize(request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ElevenLabsError);
    expect((error as ElevenLabsError).status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports zero credits when the API does not say', async () => {
    const { synthesize } = client(new Response(new Uint8Array([0, 0])));
    await expect(synthesize(request)).resolves.toMatchObject({ credits: 0 });
  });
});
