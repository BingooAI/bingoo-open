import type { MediaKind, MediaSearchQuery } from '@bingoo.ai/core'
import { getAi, ProviderNotConfiguredError } from '../providers'
import { renderPrompt } from '../prompts'

/**
 * Natural-language → structured query (docs/media-library-design.md §4/§7). Turns
 * a sentence like "tìm các ảnh liên quan đến chủ đề phòng cháy chữa cháy" into a
 * MediaSearchQuery ({ text: "phòng cháy chữa cháy", kind: ["IMAGE"] }) so a single
 * search box / voice input feeds the same hybrid search. This ONLY extracts intent
 * — retrieval + permission + moderation are unchanged (R5/R6). Best-effort: any
 * provider/parse failure falls back to using the raw sentence as `text`.
 */

const KINDS: MediaKind[] = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ANIMATION', 'FONT', 'ARCHIVE', 'OTHER']

/** Keep only known fields — never trust the model to shape the query object. */
function sanitize(raw: unknown, sentence: string): MediaSearchQuery {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = typeof obj.text === 'string' && obj.text.trim() ? obj.text.trim() : sentence
  const kind = Array.isArray(obj.kind)
    ? obj.kind.filter((k): k is MediaKind => typeof k === 'string' && KINDS.includes(k as MediaKind))
    : undefined
  const locale = obj.locale === 'vi' || obj.locale === 'en' ? obj.locale : undefined
  return { text, ...(kind && kind.length ? { kind } : {}), ...(locale ? { locale } : {}) }
}

export async function parseNlQuery(sentence: string): Promise<MediaSearchQuery> {
  try {
    const res = await getAi().generateText({
      system: await renderPrompt('media.nl.parse'),
      messages: [{ role: 'user', content: sentence }],
      maxTokens: 200,
    })
    const match = res.text.match(/\{[\s\S]*\}/)
    if (!match) return { text: sentence }
    return sanitize(JSON.parse(match[0]), sentence)
  } catch (err) {
    if (!(err instanceof ProviderNotConfiguredError)) {
      console.error('[media.nl] parse failed, using raw text', err instanceof Error ? err.message : err)
    }
    return { text: sentence }
  }
}
