// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Biên dịch bản nháp → GraphData + objectives (đầu ra engine-ready). */

import type { FrameworkKind, GraphData, SkillEdge, SkillNode, Slug } from '@bingoo.ai/knowledge-engine'
import type { EvidenceRef, IngestDraft, LocalizedText } from './model'
import { dedupeConcepts, type DedupResult } from './dedup'
import { canonicalTitle, mintSlug, slugify } from './slug'

export interface CompiledObjective {
  readonly slug: Slug
  readonly title: LocalizedText
  readonly code?: string
  readonly mapsTo: readonly Slug[]
  /** Câu nguồn mục tiêu này được trích ra (đã kiểm) — làn "từ tài liệu" của thẻ truy nguồn. */
  readonly evidence?: readonly EvidenceRef[]
}

/**
 * Một KIẾN THỨC sau compile, kèm thứ mà đồ thị không chở được.
 *
 * `SkillNode` là hợp đồng của engine và engine không đọc bằng chứng, nên nó không có chỗ cho câu
 * trích. Trước đây điều đó có nghĩa là câu trích của kiến thức chết ngay ở compile: pipeline kiểm nó
 * xong rồi không ai nhận. Danh sách này là chỗ nhận — song song với đồ thị, khoá theo slug ĐÃ SỐNG
 * SÓT sau dedup, nên một kiến thức bị gộp không để lại bằng chứng mồ côi.
 */
export interface CompiledConcept {
  readonly slug: Slug
  readonly title: LocalizedText
  readonly kind: SkillNode['kind']
  readonly facets?: Readonly<Record<string, unknown>>
  readonly evidence: readonly EvidenceRef[]
  /** Độ tin cậy AI tự khai. Hiện được, nhưng không bao giờ là bằng chứng. */
  readonly confidence?: number
}

export interface CompiledFramework {
  readonly graph: GraphData
  readonly objectives: readonly CompiledObjective[]
  /** Bằng chứng nguồn của từng kiến thức — đồ thị không chở được, nên nó đi đường này. */
  readonly concepts: readonly CompiledConcept[]
  readonly framework?: {
    readonly slug: string
    readonly name: LocalizedText
    readonly kind: FrameworkKind
    readonly locale: string
  }
  readonly dedup: DedupResult
}

/**
 * tempId → slug (qua dedup) rồi dựng SkillNode[]/SkillEdge[]. Objective thành node kind
 * OBJECTIVE + cạnh MAPS_TO trỏ về concept nền. Cạnh mất một đầu (do gộp/thiếu) bị bỏ, không ném.
 */
export function compileDraft(
  draft: IngestDraft,
  existing: Parameters<typeof dedupeConcepts>[1] = [],
  threshold?: number,
): CompiledFramework {
  const dedup = dedupeConcepts(draft.concepts, existing, threshold)
  const alias = dedup.alias
  const taken = new Set<string>([
    ...dedup.concepts.map((c) => c.slug as string),
    ...existing.map((e) => e.slug),
  ])

  const nodes: SkillNode[] = dedup.concepts.map((c) => ({
    slug: c.slug as Slug,
    title: c.title,
    kind: c.kind,
    // KHÔNG có stage: KC là canonical, trung lập với khung (I2). Stage chỉ nằm trên OBJECTIVE.
    ...(c.strand !== undefined ? { strand: c.strand } : {}),
    ...(c.subject !== undefined ? { subject: c.subject } : {}),
    // engine giữ facets OPAQUE (không đọc) → cast sang record.
    ...(c.facets !== undefined ? { facets: c.facets as Readonly<Record<string, unknown>> } : {}),
  }))

  const concepts: CompiledConcept[] = dedup.concepts.map((c) => ({
    slug: c.slug as Slug,
    title: c.title,
    kind: c.kind,
    ...(c.facets !== undefined ? { facets: c.facets as Readonly<Record<string, unknown>> } : {}),
    evidence: c.evidence,
    ...(c.confidence !== undefined ? { confidence: c.confidence } : {}),
  }))

  const edges: SkillEdge[] = []
  for (const e of draft.edges) {
    const from = alias.get(e.fromTempId)
    const to = alias.get(e.toTempId)
    if (from === undefined || to === undefined || from === to) continue
    edges.push({
      from,
      to,
      mode: e.mode,
      relType: e.relType,
      ...(e.weight !== undefined ? { weight: e.weight } : {}),
    })
  }

  const objectives: CompiledObjective[] = []
  if (draft.framework) {
    for (const o of draft.framework.objectives) {
      // Slug ƯU TIÊN MÃ chính thức (vd "1Nc.01" → 1nc-01): khoá bền, ngắn, tra ngược được về chuẩn.
      // Không có mã mới rơi về tiêu đề (câu dài → slug dài, dễ vỡ khi biên tập lại).
      const base = o.code ?? canonicalTitle(o.title) ?? o.tempId
      const slug = mintSlug(slugify(base), taken)
      const mapsTo: Slug[] = []
      for (const t of o.mapsToTempIds) {
        const target = alias.get(t)
        if (target !== undefined) mapsTo.push(target)
      }
      nodes.push({
        slug,
        title: o.title,
        kind: 'OBJECTIVE',
        ...(o.stage !== undefined ? { stage: o.stage } : {}),
        ...(o.strand !== undefined ? { strand: o.strand } : {}),
      })
      for (const target of mapsTo) {
        edges.push({ from: slug, to: target, mode: 'REQUIRED', relType: 'MAPS_TO', weight: 1 })
      }
      objectives.push({
        slug,
        title: o.title,
        mapsTo,
        ...(o.code !== undefined ? { code: o.code } : {}),
        ...(o.evidence !== undefined ? { evidence: o.evidence } : {}),
      })
    }
  }

  return {
    graph: { nodes, edges },
    objectives,
    concepts,
    ...(draft.framework
      ? {
          framework: {
            slug: draft.framework.slug,
            name: draft.framework.name,
            kind: draft.framework.kind,
            locale: draft.framework.locale,
          },
        }
      : {}),
    dedup,
  }
}
