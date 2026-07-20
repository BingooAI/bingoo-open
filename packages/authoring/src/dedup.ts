/** Chống trùng khái niệm + gán slug ổn định. SPEC D.4 (trigram-trước). */

import type { Slug } from '@bingoo.ai/knowledge-engine'
import type { ConceptDraft, ExistingConcept } from './model'
import { canonicalTitle, mintSlug, slugify } from './slug'
import { diceSimilarity } from './trigram'

export interface Merge {
  readonly tempId: string
  readonly into: Slug
  readonly reason: 'existing' | 'within-batch'
  readonly similarity: number
}

export interface DedupResult {
  /** Khái niệm được giữ (đã gán slug), theo thứ tự xuất hiện. */
  readonly concepts: readonly ConceptDraft[]
  /** tempId → slug cuối (kể cả cái bị gộp). */
  readonly alias: ReadonlyMap<string, Slug>
  readonly merges: readonly Merge[]
}

// TIẾNG ANH LÀ GỐC: slug + so trùng đều theo tiêu đề tiếng Anh → cùng kiến thức thì cùng slug,
// và dedup khớp được giữa nguồn Việt và nguồn Cambridge (trigram so trên cùng một ngôn ngữ).
const titleOf = (c: ConceptDraft): string => canonicalTitle(c.title)

/**
 * SPEC D.4 — trùng thì gộp, không tạo node mới:
 * 1) so với khái niệm ĐÃ CÓ trong graph (cùng kind) → tái dùng slug cũ (không mint mới).
 * 2) so với khái niệm đã giữ trong lô này (cùng kind) → gộp về slug đó.
 * 3) mới → mint slug ổn định.
 * Ngưỡng mặc định 0.72; embedding (nếu có) là bước sau, ngoài hàm thuần này.
 */
export function dedupeConcepts(
  concepts: readonly ConceptDraft[],
  existing: readonly ExistingConcept[] = [],
  threshold = 0.72,
): DedupResult {
  const taken = new Set<string>(existing.map((e) => e.slug))
  const alias = new Map<string, Slug>()
  const merges: Merge[] = []
  const kept: ConceptDraft[] = []

  for (const c of concepts) {
    const title = titleOf(c)

    // (1) vs existing
    let best: { slug: Slug; sim: number } | null = null
    for (const e of existing) {
      if (e.kind && e.kind !== c.kind) continue
      const sim = diceSimilarity(title, e.title)
      if (sim >= threshold && (!best || sim > best.sim)) best = { slug: e.slug, sim }
    }
    if (best) {
      alias.set(c.tempId, best.slug)
      merges.push({ tempId: c.tempId, into: best.slug, reason: 'existing', similarity: best.sim })
      continue
    }

    // (2) vs kept in batch
    let dup: { slug: Slug; sim: number } | null = null
    for (const k of kept) {
      if (k.kind !== c.kind) continue
      const sim = diceSimilarity(title, titleOf(k))
      if (sim >= threshold && (!dup || sim > dup.sim)) dup = { slug: k.slug as Slug, sim }
    }
    if (dup) {
      alias.set(c.tempId, dup.slug)
      merges.push({
        tempId: c.tempId,
        into: dup.slug,
        reason: 'within-batch',
        similarity: dup.sim,
      })
      continue
    }

    // (3) new
    const slug = mintSlug(slugify(title), taken)
    alias.set(c.tempId, slug)
    kept.push({ ...c, slug })
  }

  return { concepts: kept, alias, merges }
}
