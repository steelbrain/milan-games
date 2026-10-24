import { installServiceWorker, type WorkerScope } from './serviceWorker';

// Built separately into sw.js, with this build's files filled in (scripts/build/serviceWorker.ts).
installServiceWorker(self as unknown as WorkerScope, {
  version: __SHELL_VERSION__,
  files: __SHELL_FILES__,
});
