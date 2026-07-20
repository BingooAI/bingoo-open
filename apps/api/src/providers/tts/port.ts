/** Text-to-speech capability. */
export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'pcm';

export interface SynthesizeInput {
  text: string;
  /** Provider-specific voice id; falls back to the provider's configured default. */
  voice?: string;
  model?: string;
  format?: AudioFormat;
  languageCode?: string;
  /** Abort the underlying provider call (e.g. a cancelled background job). */
  signal?: AbortSignal;
}

/** Per-word timing (seconds) when the adapter can align speech to text. */
export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface SynthesizeResult {
  audio: Uint8Array;
  contentType: string;
  /**
   * Optional per-word timings. Adapters that can align (e.g. ElevenLabs
   * with-timestamps) populate this; others leave it undefined. Consumers that
   * need speech↔visual sync (the explainer's narration cues) use it and fall
   * back to even word-spacing when absent. Purely additive — existing callers
   * ignore it.
   */
  timings?: WordTiming[];
}

export interface TtsPort {
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}
