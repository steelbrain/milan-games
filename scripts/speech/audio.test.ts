import { describe, expect, it } from 'vitest';
import { encodeWav, pcm16ToFloat, tidy } from './audio.ts';

const RATE = 1000;

function rms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/** Silence, then a tone of `amplitude` for `seconds`, then silence. */
function clip(amplitude: number, seconds = 0.5, silence = 0.3): Float32Array {
  const quiet = Math.round(silence * RATE);
  const loud = Math.round(seconds * RATE);
  const samples = new Float32Array(quiet * 2 + loud);
  for (let i = 0; i < loud; i++) samples[quiet + i] = amplitude * Math.sin(i * 0.7);
  return samples;
}

describe('pcm16ToFloat', () => {
  it('reads little-endian 16-bit samples', () => {
    const bytes = new Uint8Array([0x00, 0x40, 0x00, 0xc0, 0xff, 0x7f]);
    const samples = pcm16ToFloat(bytes);
    expect(samples[0]).toBe(0.5);
    expect(samples[1]).toBe(-0.5);
    expect(samples[2]).toBeCloseTo(1, 3);
  });

  it('ignores a stray odd byte', () => {
    expect(pcm16ToFloat(new Uint8Array([0, 0, 1]))).toHaveLength(1);
  });
});

describe('tidy', () => {
  it('trims the silence around the speech, keeping a little padding', () => {
    const tidied = tidy(clip(0.5), RATE, { padding: 0.05 });
    expect(tidied.length).toBeGreaterThanOrEqual(500);
    expect(tidied.length).toBeLessThanOrEqual(600);
  });

  it('makes quiet and loud voices equally loud', () => {
    const quiet = tidy(clip(0.05), RATE, { padding: 0, fade: 0 });
    const loud = tidy(clip(0.6), RATE, { padding: 0, fade: 0 });
    expect(rms(quiet)).toBeCloseTo(0.1, 2);
    expect(rms(loud)).toBeCloseTo(0.1, 2);
  });

  it('never pushes peaks past the limit', () => {
    const spiky = new Float32Array(1000);
    spiky[500] = 0.9;
    let peak = 0;
    for (const sample of tidy(spiky, RATE, { fade: 0 })) peak = Math.max(peak, Math.abs(sample));
    expect(peak).toBeCloseTo(0.89, 5);
  });

  it('fades the edges so cuts never click', () => {
    const tidied = tidy(clip(0.5, 0.5, 0), RATE, { padding: 0, fade: 0.01 });
    expect(tidied[0]).toBe(0);
    expect(tidied.at(-1)).toBeCloseTo(0, 5);
  });

  it('leaves pure silence alone', () => {
    expect(tidy(new Float32Array(10), RATE)).toEqual(new Float32Array(10));
  });
});

describe('encodeWav', () => {
  it('writes a mono 16-bit PCM WAV file', () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -1, 2]), 24000);
    const view = new DataView(wav.buffer);
    const text = (offset: number, length: number) =>
      String.fromCharCode(...wav.slice(offset, offset + length));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([
      0, 16384, -32767, 32767,
    ]);
  });
});
