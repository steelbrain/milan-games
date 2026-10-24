/** Little-endian 16-bit PCM bytes (what ElevenLabs' pcm_* formats return) to float samples. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}

export interface TidyOptions {
  /** Silence kept before and after the speech, in seconds. */
  readonly padding?: number;
  /** Fade in and out over this many seconds, so cuts never click. */
  readonly fade?: number;
  /** Loudness target (RMS of the speech). Every clip and voice ends up equally loud. */
  readonly targetRms?: number;
  /** Peaks never go above this. */
  readonly peakLimit?: number;
}

/**
 * Trims the silence around the speech, matches loudness across clips and voices, and fades the
 * edges. Clips play back to back in the games, so tight, even clips sound like one sentence.
 */
export function tidy(
  samples: Float32Array,
  sampleRate: number,
  { padding = 0.05, fade = 0.01, targetRms = 0.1, peakLimit = 0.89 }: TidyOptions = {},
): Float32Array {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak === 0) return samples.slice();

  // "Speech" is anything above 5% of the clip's own peak, so quiet voices are treated fairly.
  const threshold = peak * 0.05;
  let first = 0;
  while (first < samples.length && Math.abs(samples[first] ?? 0) < threshold) first++;
  let last = samples.length - 1;
  while (last > first && Math.abs(samples[last] ?? 0) < threshold) last--;

  const pad = Math.round(padding * sampleRate);
  const trimmed = samples.slice(Math.max(0, first - pad), Math.min(samples.length, last + pad + 1));

  let sumOfSquares = 0;
  for (const sample of trimmed) sumOfSquares += sample * sample;
  const rms = Math.sqrt(sumOfSquares / trimmed.length);
  const gain = Math.min(targetRms / rms, peakLimit / peak);

  const fadeLength = Math.min(Math.round(fade * sampleRate), Math.floor(trimmed.length / 2));
  for (let i = 0; i < trimmed.length; i++) {
    const edge = Math.min(i, trimmed.length - 1 - i);
    const envelope = edge < fadeLength ? edge / fadeLength : 1;
    trimmed[i] = (trimmed[i] ?? 0) * gain * envelope;
  }
  return trimmed;
}

/** A mono 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  });
  return bytes;
}
