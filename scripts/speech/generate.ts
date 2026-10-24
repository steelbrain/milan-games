/**
 * Records every line the games say (see src/speech/catalog.ts) with ElevenLabs, in every voice
 * from voices.ts, as several takes per line. Clips go to public/speech/<voice>/<clip>[-<take>].m4a
 * and public/speech/manifest.json tells the app what exists. The app picks one voice per visit
 * and plays a random take of each line in it.
 *
 *   npm run speech                       Record whatever is missing. Safe to stop and re-run.
 *   npm run speech -- --dry-run          Show what would be recorded and roughly what it costs.
 *   npm run speech -- --limit 20         Record at most 20 clips, e.g. to try new settings.
 *   npm run speech -- --model eleven_v3  Use another ElevenLabs model.
 *   npm run speech -- --manifest-only    Rewrite the manifest from the files on disk.
 *
 * Needs ELEVENLABS_API_KEY (in the environment or .local.env) and afconvert (macOS) or ffmpeg.
 * Only the words to say are sent to ElevenLabs. To re-record a clip, delete its file and re-run.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { runnerImport } from 'vite';
import type * as Catalog from '../../src/speech/catalog.ts';
import type * as ClipIds from '../../src/speech/clipId.ts';
import { listFiles } from '../build/serviceWorker.ts';
import { encodeWav, pcm16ToFloat, tidy } from './audio.ts';
import {
  createElevenLabsClient,
  QuotaExceededError,
  SAMPLE_RATE,
  type VoiceSettings,
} from './elevenlabs.ts';
import { readSecret } from './env.ts';
import {
  buildManifest,
  type ClipSpec,
  expectedFiles,
  type FileNamer,
  type Job,
  type Manifest,
  planJobs,
} from './plan.ts';
import { VOICES } from './voices.ts';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'public/speech');
/** Inside the project, so finished clips can be renamed into outDir (no cross-device rename). */
const scratchRoot = path.join(root, 'node_modules/.cache');
const manifestPath = path.join(outDir, 'manifest.json');

/**
 * A little below full stability lets each take come out differently (that's the variety), while
 * staying recognizably the same voice. Slightly slow suits a three-year-old.
 */
const SETTINGS: VoiceSettings = {
  stability: 0.4,
  similarity_boost: 0.8,
  style: 0.2,
  use_speaker_boost: true,
  speed: 0.95,
};
/** Rough ElevenLabs credits per character, for the dry-run estimate only. */
const CREDITS_PER_CHARACTER = 0.44;
/** Speech compresses well: 24 kHz mono AAC at 32 kbps sounds clean and stays small. */
const BITRATE = 32_000;

const { values: options } = parseArgs({
  options: {
    model: { type: 'string', default: 'eleven_multilingual_v2' },
    concurrency: { type: 'string', default: '3' },
    limit: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'manifest-only': { type: 'boolean', default: false },
  },
});

/** A whole number option of at least `min`, or a clear error instead of a silent no-op. */
function wholeNumber(name: string, value: string, min: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`--${name} needs a whole number of at least ${min}, not "${value}".`);
  }
  return parsed;
}

async function loadCatalog(): Promise<{ clips: ClipSpec[]; fileName: FileNamer }> {
  const config = { configFile: false as const, logLevel: 'error' as const };
  const [{ module: catalog }, { module: ids }] = await Promise.all([
    runnerImport<typeof Catalog>(path.join(root, 'src/speech/catalog.ts'), config),
    runnerImport<typeof ClipIds>(path.join(root, 'src/speech/clipId.ts'), config),
  ]);
  const clips = catalog.speechCatalog().map(({ line, takes }) => ({
    id: ids.clipId(line),
    words: ids.clipWords(line),
    takes,
  }));
  return { clips, fileName: ids.clipFileName };
}

const onDisk = (file: string) => existsSync(path.join(outDir, file));

const FFMPEG_QUIET = ['-y', '-loglevel', 'error'];

/**
 * WAV → small .m4a. Apple's AAC encoder (afconvert) sounds best at low bitrates, but it pads
 * every file with 4 KB of empty space, almost half of a short clip, so the result is remuxed
 * losslessly with ffmpeg when it's available. Without afconvert, ffmpeg encodes directly.
 */
async function encoder(): Promise<(wav: string, m4a: string) => Promise<void>> {
  const hasFfmpeg = await run('ffmpeg', ['-version']).then(
    () => true,
    () => false,
  );
  const compact = (from: string, to: string) =>
    run('ffmpeg', [
      ...FFMPEG_QUIET,
      '-i',
      from,
      '-c',
      'copy',
      '-map_metadata',
      '-1',
      '-movflags',
      '+faststart',
      to,
    ]);

  if (process.platform === 'darwin') {
    return async (wav, m4a) => {
      const padded = `${m4a}.padded.m4a`;
      await run('afconvert', [
        '-f',
        'm4af',
        '-d',
        'aac',
        '-b',
        String(BITRATE),
        '-q',
        '127',
        wav,
        padded,
      ]);
      if (hasFfmpeg) {
        await compact(padded, m4a);
        await rm(padded);
      } else {
        await rename(padded, m4a);
      }
    };
  }
  if (!hasFfmpeg) throw new Error('Encoding needs afconvert (macOS) or ffmpeg.');
  return async (wav, m4a) => {
    await run('ffmpeg', [
      ...FFMPEG_QUIET,
      '-i',
      wav,
      '-c:a',
      'aac',
      '-b:a',
      String(BITRATE),
      '-movflags',
      '+faststart',
      '-f',
      'mp4',
      m4a,
    ]);
  };
}

interface Outcome {
  recorded: number;
  credits: number;
  failures: string[];
  stopped?: Error;
}

async function record(jobs: readonly Job[], apiKey: string, workers: number): Promise<Outcome> {
  const synthesize = createElevenLabsClient({ apiKey });
  const encode = await encoder();
  await mkdir(scratchRoot, { recursive: true });
  const scratch = await mkdtemp(path.join(scratchRoot, 'speech-'));
  const outcome: Outcome = { recorded: 0, credits: 0, failures: [] };
  const started = Date.now();
  let next = 0;

  const interrupt = () => {
    if (outcome.stopped) process.exit(130);
    outcome.stopped = new Error(
      'Interrupted; finishing the clips in flight. Press Ctrl-C again to quit now.',
    );
    console.log(`\n${outcome.stopped.message}`);
  };
  process.on('SIGINT', interrupt);

  /** Records one take; false if every attempt came back unusable. */
  async function recordOne(job: Job): Promise<boolean> {
    // A rare take comes back silent or clipped; a different seed fixes it.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { pcm, credits } = await synthesize({
        voiceId: job.voice.elevenLabsId,
        text: job.clip.words,
        modelId: options.model,
        seed: (job.seed + attempt * 7919) >>> 0,
        settings: SETTINGS,
      });
      outcome.credits += credits;
      const samples = tidy(pcm16ToFloat(pcm), SAMPLE_RATE);
      if (samples.length < SAMPLE_RATE * 0.15) continue;

      const base = path.join(scratch, job.file.replaceAll('/', '_'));
      await writeFile(`${base}.wav`, encodeWav(samples, SAMPLE_RATE));
      await encode(`${base}.wav`, `${base}.m4a`);
      const target = path.join(outDir, job.file);
      await mkdir(path.dirname(target), { recursive: true });
      // Renamed into place only when complete, so a stopped run never leaves half a file.
      await rename(`${base}.m4a`, target);
      await rm(`${base}.wav`, { force: true });
      return true;
    }
    outcome.failures.push(`${job.voice.name}: "${job.clip.words}" (take ${job.take})`);
    return false;
  }

  async function worker(): Promise<void> {
    while (!outcome.stopped && next < jobs.length) {
      const job = jobs[next++] as Job;
      let recorded = false;
      try {
        recorded = await recordOne(job);
      } catch (error) {
        outcome.stopped ??= error instanceof Error ? error : new Error(String(error));
      }
      if (recorded) outcome.recorded++;
      if ((recorded && outcome.recorded % 100 === 0) || next === jobs.length) {
        const minutes = (Date.now() - started) / 60_000;
        const rate = outcome.recorded / Math.max(minutes, 0.01);
        const left = (jobs.length - next) / Math.max(rate, 0.01);
        console.log(
          `  ${outcome.recorded}/${jobs.length} recorded, ${outcome.credits} credits, ~${Math.ceil(left)} min left`,
        );
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: workers }, worker));
  } finally {
    process.off('SIGINT', interrupt);
    await rm(scratch, { recursive: true, force: true });
  }
  return outcome;
}

/** Deletes recordings the catalog no longer asks for. */
async function removeStale(expected: Set<string>): Promise<number> {
  const stale = listFiles(outDir).filter((file) => file.endsWith('.m4a') && !expected.has(file));
  await Promise.all(stale.map((file) => rm(path.join(outDir, file))));
  return stale.length;
}

async function previousRecipe(): Promise<string | undefined> {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Partial<Manifest>;
    return JSON.stringify(manifest.recipe);
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const workers = wholeNumber('concurrency', options.concurrency, 1);
  const { clips, fileName } = await loadCatalog();
  const recipe = {
    model: options.model,
    settings: SETTINGS,
    sampleRate: SAMPLE_RATE,
    bitrate: BITRATE,
  };
  await mkdir(outDir, { recursive: true });

  const all = planJobs(clips, VOICES, fileName, onDisk);
  const jobs =
    options.limit === undefined ? all : all.slice(0, wholeNumber('limit', options.limit, 0));
  const characters = jobs.reduce((sum, job) => sum + job.clip.words.length, 0);
  const totalFiles = expectedFiles(clips, VOICES, fileName).size;
  console.log(
    `${clips.length} lines × ${VOICES.length} voices = ${totalFiles} recordings; ${all.length} missing, ` +
      `recording ${jobs.length} (${characters} characters, ~${Math.round(characters * CREDITS_PER_CHARACTER)} credits).`,
  );

  if (!options['manifest-only'] && !options['dry-run'] && jobs.length > 0) {
    const before = await previousRecipe();
    if (before !== undefined && before !== JSON.stringify(recipe)) {
      console.log(
        'Note: settings changed since the last run. Existing clips are kept; delete them to re-record.',
      );
    }
    const apiKey = readSecret('ELEVENLABS_API_KEY', root);
    if (!apiKey) throw new Error('Set ELEVENLABS_API_KEY in the environment or in .local.env.');

    const outcome = await record(jobs, apiKey, workers);
    console.log(`Recorded ${outcome.recorded} clips for ${outcome.credits} credits.`);
    for (const failure of outcome.failures) console.log(`  could not record ${failure}`);
    if (outcome.stopped) {
      const reason = outcome.stopped instanceof QuotaExceededError ? 'Out of credits' : 'Stopped';
      console.log(`${reason}: ${outcome.stopped.message}`);
      process.exitCode = 1;
    }
  }
  if (options['dry-run']) return;

  const removed = await removeStale(expectedFiles(clips, VOICES, fileName));
  if (removed > 0) console.log(`Removed ${removed} unused recordings.`);
  const manifest = buildManifest(
    clips,
    VOICES,
    fileName,
    { exists: onDisk, read: (file) => readFileSync(path.join(outDir, file)) },
    recipe,
  );
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const fewest = Math.min(...Object.values(manifest.clips).map((clip) => clip.takes));
  console.log(
    `Manifest: ${manifest.voices.map((voice) => voice.name).join(', ') || 'no complete voices yet'}` +
      (manifest.voices.length > 0 ? `, at least ${fewest} takes per line.` : '.'),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
