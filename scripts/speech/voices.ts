/** An ElevenLabs voice the games speak with. The app picks one at random per page load. */
export interface VoiceSpec {
  /** Folder name under public/speech/ and the id the app uses. */
  readonly id: string;
  readonly name: string;
  readonly elevenLabsId: string;
}

export const VOICES: readonly VoiceSpec[] = [
  { id: 'katie', name: 'Katie', elevenLabsId: 'YyRJWuwyhKdMZRRnm464' },
  { id: 'lulu', name: 'Lulu', elevenLabsId: 'itMkRQx56fOF4CJe1D0C' },
  { id: 'clara', name: 'Clara', elevenLabsId: 'Qggl4b0xRMiqOwhPtVWT' },
  { id: 'zara', name: 'Zara', elevenLabsId: 'jqcCZkN6Knx8BJ5TBdYR' },
];
