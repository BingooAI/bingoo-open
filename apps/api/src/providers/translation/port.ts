import type { Locale } from '@bingoo/i18n'

/**
 * Machine-translation capability for *dynamic* content (AI output, lessons,
 * community posts) — NOT for static UI copy, which is authored by hand in
 * `@bingoo/i18n` (R3/R4). Vendor-neutral: the active engine is chosen by the
 * `TRANSLATION_PROVIDER` env (R6). Adapters return raw translations; child-facing
 * callers moderate the result at the service layer above (R5), same as `ai`.
 */
export interface TranslateInput {
  /** Batch of source strings — translated together to save round-trips. */
  texts: string[]
  /** Target locale. */
  to: Locale
  /** Source locale; omit to let the engine infer it. */
  from?: Locale
  /** Domain hint that steers tone/terminology, e.g. 'lesson' | 'community'. */
  context?: string
  /** Term → preferred translation overrides applied verbatim by the engine. */
  glossary?: Record<string, string>
}

export interface TranslateResult {
  /** One translation per input text, in the same order. */
  translations: string[]
  /** The source locale the engine used (echoes `from` when it was provided). */
  detectedFrom?: Locale
  /** Which engine produced these translations. */
  provider: string
}

export interface TranslationPort {
  translate(input: TranslateInput): Promise<TranslateResult>
}
