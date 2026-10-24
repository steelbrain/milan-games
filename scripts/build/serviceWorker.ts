import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { build, type Plugin, type ResolvedConfig } from 'vite';

/** Every file under `dir`, relative to it with forward slashes, skipping dotfiles like .DS_Store. */
export function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .map((file) => file.split(path.sep).join('/'))
    .sort();
}

/** The total size in bytes of the files under `dir` that `include` picks. */
export function totalBytes(dir: string, include: (file: string) => boolean): number {
  return listFiles(dir)
    .filter(include)
    .reduce((sum, file) => sum + statSync(path.join(dir, file)).size, 0);
}

/** The app's files, sorted, and a version that changes whenever any name or content does. */
export function shellOf(contents: ReadonlyMap<string, string | Uint8Array>): {
  files: string[];
  version: string;
} {
  const files = [...contents.keys()].sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`${file}\0`);
    hash.update(contents.get(file) ?? '');
  }
  return { files, version: hash.digest('hex').slice(0, 12) };
}

export interface ServiceWorkerPluginOptions {
  /** The service worker's source file. */
  readonly entry: string;
  /** Public files to leave out of the app's offline copy, such as the speech clips. */
  readonly skip?: (file: string) => boolean;
}

/**
 * Builds the service worker into sw.js, with the list of this build's files (and a version
 * from their contents) baked in, so it can save exactly this build for offline use.
 */
export function serviceWorker({ entry, skip = () => false }: ServiceWorkerPluginOptions): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'service-worker',
    apply: 'build',
    // After Vite's own plugins, so the bundle already holds index.html and the CSS.
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    async generateBundle(_options, bundle) {
      const contents = new Map<string, string | Uint8Array>();
      for (const [file, output] of Object.entries(bundle)) {
        if (!file.endsWith('.map'))
          contents.set(file, output.type === 'chunk' ? output.code : output.source);
      }
      if (!contents.has('index.html')) throw new Error('The service worker needs index.html.');
      if (config.publicDir) {
        for (const file of listFiles(config.publicDir)) {
          if (!skip(file)) contents.set(file, readFileSync(path.join(config.publicDir, file)));
        }
      }
      const shell = shellOf(contents);

      // A separate build, so the worker is one self-contained script that shares no chunks.
      const result = await build({
        configFile: false,
        logLevel: 'warn',
        mode: config.mode,
        root: config.root,
        publicDir: false,
        define: {
          __SHELL_FILES__: JSON.stringify(shell.files),
          __SHELL_VERSION__: JSON.stringify(shell.version),
        },
        build: {
          write: false,
          minify: config.build.minify,
          lib: { entry, formats: ['iife'], name: 'serviceWorker', fileName: () => 'sw.js' },
        },
      });
      const outputs = (Array.isArray(result) ? result : [result]).flatMap((out) =>
        'output' in out ? out.output : [],
      );
      const worker = outputs.find((out) => out.type === 'chunk');
      if (!worker || worker.type !== 'chunk')
        throw new Error('The service worker build was empty.');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker.code });
    },
  };
}
