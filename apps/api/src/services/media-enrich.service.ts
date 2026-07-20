import { createHash } from 'node:crypto'
import type { LocalizedText } from '@bingoo/core'
import { db } from '@bingoo/db'
import type { Prisma } from '@bingoo/db'
import { getAi, getEmbedding } from '../providers'
import { ProviderNotConfiguredError } from '../providers'
import { readEnv } from '../providers/core/config'
import { renderPrompt } from '../prompts'
import { currentEmbeddingHash, upsertEmbedding } from '../repos/media-embedding.repo'
import { addAssetTags, upsertTag } from '../repos/media-tag.repo'

/**
 * Media enrichment (docs/media-library-design.md §6). Runs on the server, off the
 * upload critical path. Two outputs:
 *  1. A SEMANTIC EMBEDDING over the human-authored, moderatable text — this is an
 *     internal index signal (never shown to a child), so it needs no moderation.
 *  2. AI SUGGESTIONS (caption/alt/keywords) stashed in `metadata.aiSuggested`.
 *     These are NOT written to the child-facing title/description — an editor or
 *     moderator promotes them (R5: nothing AI-authored reaches a child unreviewed).
 */

function localizedValues(v: unknown): string[] {
  if (v && typeof v === 'object')
    return Object.values(v as Record<string, unknown>).filter((x): x is string => typeof x === 'string')
  return []
}

/** The text an embedding is computed from: title + description + alt + tag labels. */
function embeddingText(asset: {
  title: unknown
  description: unknown
  altText: unknown
  tags: { tag: { label: unknown } }[]
  source: string | null
}): string {
  const parts = [
    ...localizedValues(asset.title),
    ...localizedValues(asset.description),
    ...localizedValues(asset.altText),
    ...asset.tags.flatMap((t) => localizedValues(t.tag.label)),
    asset.source ?? '',
  ]
  return parts.filter(Boolean).join(' \n ').slice(0, 8000)
}

export interface EnrichResult {
  embedded: boolean
  suggested: boolean
  skipped?: 'unchanged' | 'no-text'
}

export interface EnrichOptions {
  force?: boolean
  /** Only recompute the embedding (skip the slower LLM suggestion). Used for the
   *  auto-enrich hook on upload-complete so the critical path stays fast. */
  embedOnly?: boolean
}

const loadAssetForEnrich = (assetId: string) =>
  db.mediaAsset.findUnique({
    where: { id: assetId },
    include: { tags: { include: { tag: { select: { label: true } } } } },
  })

export async function enrichAsset(assetId: string, opts: EnrichOptions = {}): Promise<EnrichResult> {
  let asset = await loadAssetForEnrich(assetId)
  if (!asset) throw new Error('asset not found')

  // ── 1. AI suggestions + content tags ─────────────────────────────────────────
  // Runs FIRST so the promoted tags feed the embedding below. The suggested
  // caption/alt stay stashed (never published — R5), but the CONTENT tags are
  // attached with source=AI so a moderator can see/prune their provenance.
  let suggested = false
  if (!opts.embedOnly) {
    try {
      const suggestion = await suggestMetadata(embeddingText(asset))
      if (suggestion) {
        // JSON round-trip drops any `undefined` fields → valid Prisma JSON input.
        const metadata = JSON.parse(
          JSON.stringify({
            ...(asset.metadata as Record<string, unknown> | null),
            aiSuggested: { ...suggestion, at: new Date().toISOString() },
          }),
        ) as Prisma.InputJsonObject
        await db.mediaAsset.update({ where: { id: assetId }, data: { metadata } })
        if (suggestion.tags?.length) await promoteSuggestedTags(assetId, suggestion.tags)
        asset = (await loadAssetForEnrich(assetId)) ?? asset // refresh tags for embedding
        suggested = true
      }
    } catch (err) {
      if (!(err instanceof ProviderNotConfiguredError)) {
        console.error('[media.enrich] suggestion failed', err instanceof Error ? err.message : err)
      }
    }
  }

  // ── 2. Embedding over the (now tag-enriched) text ────────────────────────────
  const text = embeddingText(asset)
  if (!text.trim()) return { embedded: false, suggested, skipped: 'no-text' }
  const hash = createHash('sha256').update(text).digest('hex')

  let embedded = false
  try {
    const embedding = getEmbedding()
    if (!opts.force && (await currentEmbeddingHash(assetId, embModel(embedding))) === hash) {
      // unchanged → skip re-embedding.
    } else {
      const res = await embedding.embed({ texts: [text] })
      const vector = res.vectors[0]
      if (vector) {
        await upsertEmbedding({
          assetId,
          model: res.model,
          dim: res.dim,
          vector,
          contentHash: hash,
        })
        embedded = true
      }
    }
  } catch (err) {
    if (!(err instanceof ProviderNotConfiguredError)) throw err
    // no embedding provider → semantic search degrades to lexical; not fatal.
  }

  return { embedded, suggested }
}

/** Attach AI-suggested content tags (KEYWORD) with source=AI; refreshes keywords. */
async function promoteSuggestedTags(assetId: string, tags: SuggestedTag[]): Promise<void> {
  const ids: string[] = []
  for (const t of tags) {
    const en = t.en?.trim()
    const vi = t.vi?.trim()
    if (!en && !vi) continue
    try {
      const tag = await upsertTag({ kind: 'KEYWORD', label: { en: en || vi!, vi: vi || en! } })
      ids.push(tag.id)
    } catch {
      // bad/empty slug → skip this one, keep the rest.
    }
  }
  if (ids.length) await addAssetTags({ assetId, tagIds: ids, source: 'AI', confidence: 0.7 })
}

// The embedding provider's active model name is only known after a call; we use a
// stable per-provider default for the hash lookup to avoid an extra round-trip.
function embModel(embedding: { dim: number }): string {
  return embedding.dim === 3072 ? 'text-embedding-3-large' : 'text-embedding-3-small'
}

interface SuggestedTag {
  en: string
  vi: string
}

interface Suggestion {
  description?: LocalizedText
  altText?: LocalizedText
  tags?: SuggestedTag[]
}

function isLocalized(v: unknown): v is LocalizedText {
  return Boolean(v && typeof v === 'object')
}

/** Normalise the model's `tags` into {en,vi} pairs (tolerates bare strings). */
function normalizeSuggestedTags(raw: unknown): SuggestedTag[] {
  if (!Array.isArray(raw)) return []
  const out: SuggestedTag[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ en: item.trim(), vi: item.trim() })
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const en = typeof o.en === 'string' ? o.en.trim() : ''
      const vi = typeof o.vi === 'string' ? o.vi.trim() : ''
      if (en || vi) out.push({ en: en || vi, vi: vi || en })
    }
  }
  return out
}

/** Ask the LLM for content suggestions as strict JSON. Returns null on any
 *  parse/provider issue (best-effort). Output is a SUGGESTION, never published. */
async function suggestMetadata(text: string): Promise<Suggestion | null> {
  // Enrichment is an internal, off-critical-path signal — let ops point it at a
  // provider that has credit (MEDIA_ENRICH_AI_PROVIDER) without switching the
  // platform-wide AI provider (R6). Falls back to the global default.
  const ai = getAi(readEnv('MEDIA_ENRICH_AI_PROVIDER'))
  const res = await ai.generateText({
    system: await renderPrompt('media.enrich.suggest'),
    messages: [{ role: 'user', content: text }],
    maxTokens: 500,
  })
  const match = res.text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>
    return {
      description: isLocalized(raw.description) ? (raw.description as LocalizedText) : undefined,
      altText: isLocalized(raw.altText) ? (raw.altText as LocalizedText) : undefined,
      tags: normalizeSuggestedTags(raw.tags),
    }
  } catch {
    return null
  }
}
