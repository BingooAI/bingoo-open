// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * providers/types.ts — the pluggable service boundary of the engine.
 *
 * The engine CORE (schema, runtime, frame, manipulatives) is pure and knows
 * nothing about any vendor. Everything that reaches the outside world — writing
 * lessons with an LLM, speaking with a voice service, drawing with an image
 * service, or fetching a picture from a media library / database — goes through
 * one of these interfaces. Swap the concrete adapter (OpenAI ↔ your media DB,
 * Anthropic ↔ another LLM, ElevenLabs ↔ your TTS) without touching a route or
 * the engine. No hardcoding, no per-vendor hot-fixes in call sites.
 */

/* ------------------------------------------------------------------ shared */
export type Word = { word: string; start: number; end: number }
export type CueMark = { cue: string; t: number }

/** A provider that isn't configured is not an error — it just reports `false`,
 *  and callers fall back (mock voice, skip image, offline mock lesson). */
export interface Provider {
  /** stable id, e.g. "openai", "elevenlabs", "anthropic", "media-library". */
  readonly id: string
  /** true when the adapter has what it needs (key/endpoint) to run for real. */
  available(): boolean
}

/* --------------------------------------------------------------------- llm */
export type LlmMessage = { role: 'user' | 'assistant'; content: string }
export type LlmRequest = {
  system: string
  messages: LlmMessage[]
  maxTokens?: number
  /** provider-specific model override; falls back to the adapter default. */
  model?: string
}
export interface LlmProvider extends Provider {
  /** the model this call will use (for reporting). */
  model(override?: string): string
  complete(req: LlmRequest): Promise<string>
}

/* ------------------------------------------------------------------- voice */
export type VoiceRequest = {
  /** raw script — MAY contain `[[cue:cN]]` markers; the adapter strips them for
   *  speech and re-times the cues onto the produced audio. */
  text: string
  locale?: string
  voiceId?: string
  modelId?: string
}
export type VoiceResult = {
  audioUrl: string | null // data-URI or hosted URL; null → caller speaks it live
  words: Word[]
  duration: number
  cueMarks: CueMark[]
  provider: string
  model?: string
  mock?: boolean
  error?: string
}
export interface VoiceProvider extends Provider {
  speak(req: VoiceRequest): Promise<VoiceResult>
}

/* ------------------------------------------------------------------- image */
export type ImageRequest = {
  /** what to draw (short description) — used as the GENERATION prompt / fallback. */
  prompt: string
  /** semantic description to SEARCH the media library for first (illustration-
   *  first). Falls back to `prompt` when absent. */
  query?: string
  /** routing tags for the library search (e.g. ["animal","duck"]). */
  tags?: string[]
  /** bump to force a FRESH generation instead of the cached one for this prompt. */
  variant?: number
  /** catalog style id (see lib/imageStyles) — the adapter decides how to use it
   *  (prompt suffix for a generator, a tag/filter for a media library). */
  style?: string
  /** ready-made style hint for generator adapters. */
  styleSuffix?: string
  alt?: string
  size?: string
  /** free-form routing hints for library/database adapters (subject, grade…). */
  hints?: Record<string, unknown>
}
export type ImageResult = {
  /** data-URI, R2/HTTP URL, or project-relative path — whatever the adapter
   *  produced or found. The engine renders it verbatim. */
  url: string
  provider: string
  meta?: Record<string, unknown>
}
export interface ImageProvider extends Provider {
  generate(req: ImageRequest): Promise<ImageResult>
}

/* ------------------------------------------------------- media search (library) */
/**
 * Illustration-first: BEFORE generating a picture, search an existing media
 * library (uploaded art — png/jpg/svg — indexed by NLP/embeddings). The default
 * host is bingoo's media search (NLP + LLM); a `local` adapter searches a small
 * on-disk catalog for standalone dev. Returns ranked hits; the resolver picks
 * the top match above a score threshold, else falls back to generation.
 */
export type MediaSearchRequest = {
  /** natural-language description of the wanted illustration. */
  query: string
  tags?: string[]
  /** "image" (png/jpg) | "svg" | "any" — the renderer handles all. */
  kind?: 'image' | 'svg' | 'any'
  limit?: number
  hints?: Record<string, unknown>
}
export type MediaHit = {
  url: string
  label?: string
  kind?: 'image' | 'svg'
  tags?: string[]
  /** relevance 0..1; the resolver keeps a hit only above its threshold. */
  score: number
}
export type MediaSearchResult = { items: MediaHit[]; provider: string }
export interface MediaSearchProvider extends Provider {
  search(req: MediaSearchRequest): Promise<MediaSearchResult>
}

/* ------------------------------------------------------------- translation */
/**
 * i18n is its own service boundary: given text in one locale, return it in
 * another. The engine hands over ONLY human-readable values (bundle `strings`
 * and narration `scripts`) and re-assembles the bundle itself — cue markers,
 * object keys, and timing `marks` are the engine's invariant, never the
 * translator's. A plug-in adapter (your own i18n/translation service) implements
 * this; the default adapter drives the configured `LlmProvider`.
 */
export type TranslateRequest = {
  from: string
  to: string
  /** keyed UI/label strings — translate values, keep keys. */
  strings: Record<string, string>
  /** keyed narration scripts — keep every `[[cue:cN]]` marker in place. */
  scripts: Record<string, string>
  /** who the text is for ("a preschool child…", "an adult professional…") —
   *  drives register/vocabulary of the translation. Never hardcode an audience
   *  in an adapter. */
  audience?: string
}
export type TranslateResult = {
  strings: Record<string, string>
  scripts: Record<string, string>
  provider: string
}
export interface TranslationProvider extends Provider {
  translate(req: TranslateRequest): Promise<TranslateResult>
}

/* --------------------------------------------------------------------- sfx */
export type SfxRequest = { prompt: string; duration?: number }
export type SfxResult = {
  audioUrl: string | null
  duration: number
  provider: string
  mock?: boolean
  error?: string
}
export interface SfxProvider extends Provider {
  generate(req: SfxRequest): Promise<SfxResult>
}

/* -------------------------------------------------------------- media store */
/**
 * Where generated/uploaded bytes live. The default keeps them inline as data
 * URLs (self-contained, no infra). A host swaps in an R2/S3/DB adapter so audio
 * & images are stored once and referenced by URL — the engine renders any URL.
 */
export type MediaPutRequest = {
  bytes: ArrayBuffer | Uint8Array
  contentType: string
  key?: string
}
export interface MediaStore extends Provider {
  put(req: MediaPutRequest): Promise<{ url: string }>
}

/* ------------------------------------------------------- questions / gates */
/**
 * The checkpoints/quizzes ("gates") a lesson tests with. Today the LLM writes
 * them inline; tomorrow a question-bank / DB adapter feeds curated, standards-
 * aligned items. Both return GateSpec-shaped items the engine validates and
 * drops into a `gate` scene — same contract, swappable source.
 */
export type QuestionKind = 'predict-check' | 'sequence' | 'select' | 'hotspot' | 'input' | 'manipulate'
export type QuestionRequest = {
  topic: string
  locale?: string
  kinds?: QuestionKind[] // desired gate kinds (default: select / predict-check / manipulate)
  count?: number
  grade?: string | number
  skill?: string // curriculum skill / objective statements
  /** who the learner is ("a middle-school student…") — drives tone + difficulty. */
  audience?: string
  /** the WRITTEN lesson content (narration + strings). When present, questions
   *  must test ONLY material contained here — never untaught topic knowledge. */
  context?: string
  hints?: Record<string, unknown>
}
/** A single gate, GateSpec-shaped (validated against the engine schema on use). */
export type QuestionItem = {
  kind: QuestionKind
  prompt: string
  options?: { id: string; label: string }[]
  answer?: string | string[]
  manip?: { kind: string; params?: unknown; target: unknown }
  feedback?: { correct: string; wrong: string }
}
export type QuestionResult = { items: QuestionItem[]; provider: string }
export interface QuestionProvider extends Provider {
  fetch(req: QuestionRequest): Promise<QuestionResult>
}
