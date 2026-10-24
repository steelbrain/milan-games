/** Cache Storage names, shared by the page and the service worker. */

/**
 * The recorded speech, saved by the "Play offline" download: one cache per voice. Chrome can't
 * list a cache of more than about 18,000 entries ("Operation too large"), and all four voices
 * together are well past that.
 */
export const SPEECH_CACHE_PREFIX = 'speech-';

export function speechCacheName(voice: string): string {
  return SPEECH_CACHE_PREFIX + voice;
}

/** Where older versions saved every voice's speech, in one cache that grew too big to list. */
export const LEGACY_SPEECH_CACHE = 'speech';

export function isSpeechCache(name: string): boolean {
  return name === LEGACY_SPEECH_CACHE || name.startsWith(SPEECH_CACHE_PREFIX);
}

/** The app itself (page, scripts, styles, fonts, icons), one cache per build. */
export const SHELL_CACHE_PREFIX = 'shell-';
