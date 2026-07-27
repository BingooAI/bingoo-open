// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Adapter LLM cho pipeline @bingoo.ai/authoring — hiện thực các port bằng hạ tầng provider
 * sẵn có (getAi = Claude mặc định, getEmbedding). Lõi authoring vẫn thuần; đây là biên "bẩn".
 * Mọi output model đều qua sanitize — KHÔNG tin shape model trả (xem media-nl-query).
 */

import type {
  AuthoringPorts,
  ConceptCandidate,
  ConceptExtractorPort,
  EdgeCandidate,
  EdgeProposerPort,
  EmbeddingPort,
  VisionPort,
} from '@bingoo.ai/authoring'
import type { CompetencyKind } from '@bingoo.ai/knowledge-engine'
import {
  BLOOM,
  FLUENCY,
  TRANSFER,
  type Bloom,
  type Facets,
  type Fluency,
  type Transfer,
} from '@bingoo.ai/facets'
import { getAi, getEmbedding, getVision } from '../providers'
import { renderPrompt } from '../prompts'
import { modelFor } from '../config/models'
import { parseModelJson } from '../lib/model-json'

const KINDS: readonly CompetencyKind[] = [
  'OBJECTIVE',
  'OUTCOME',
  'SKILL',
  'KNOWLEDGE',
  'PROCEDURE',
  'BEHAVIOR',
  'ATTITUDE',
  'DISPOSITION',
]
const RELS = ['PREREQUISITE', 'ENABLES', 'COMPOSES'] as const
const MODES = ['REQUIRED', 'RECOMMENDED'] as const

/**
 * CHI PHÍ: trích khái niệm/cạnh/objective là TRÍCH XUẤT CÓ CẤU TRÚC — không cần model đắt nhất.
 * Mặc định `ANTHROPIC_MODEL=claude-opus-4-8` khiến MỖI lượt authoring (~14 lượt/tài liệu, 4k token
 * output) chạy bằng Opus → đốt tiền vô lý. Tách riêng model cho authoring (khuôn có sẵn của bingoo:
 * TRANSLATION_MODEL, MEDIA_ENRICH_AI_PROVIDER). Đổi model = đổi env, không đụng code.
 */

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/** Lấy object JSON đầu tiên trong text model; hỏng cú pháp → undefined. */

function asLocalized(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return Object.keys(out).length ? out : undefined
}

/** Nhãn hiển thị 1 khái niệm (để proposer/edge tham chiếu theo title). */
function displayTitle(t: Record<string, string>): string {
  return t.en ?? t.vi ?? Object.values(t)[0] ?? ''
}

/**
 * Facets = 6 trục PHÂN BIỆT KC. Chỉ nhận trục hợp lệ; `scope` giữ nguyên cấu trúc (mỗi môn một hình
 * dạng: {max:100} · {lexis:2000} · {tempoBpm:120}) — so sánh định danh sẽ so theo CẤU TRÚC.
 */
function sanitizeFacets(raw: unknown): Facets | undefined {
  const o = rec(raw)
  if (Object.keys(o).length === 0) return undefined

  // Model hay trả đa giá trị ("pictorial|concrete", "read|write"). Nếu để nguyên thì so cấu trúc
  // hỏng ngay ("concrete|pictorial" ≠ "pictorial|concrete"). Chuẩn hoá: tách → sort → nối lại.
  const s = (v: unknown): string | undefined => {
    if (typeof v !== 'string' || !v.trim()) return undefined
    const parts = v
      .split(/[|,/]/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
    if (parts.length === 0) return undefined
    return [...new Set(parts)].sort().join('+')
  }

  const scopeRaw = rec(o.scope)
  const scope: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(scopeRaw)) {
    if (typeof v === 'number' || (typeof v === 'string' && v.trim())) scope[k.trim().toLowerCase()] = v
  }

  const f: Facets = {
    ...(s(o.object) ? { object: s(o.object) as string } : {}),
    ...(s(o.channel) ? { channel: s(o.channel) as string } : {}),
    ...(BLOOM.includes(o.bloom as Bloom) ? { bloom: o.bloom as Bloom } : {}),
    ...(Object.keys(scope).length ? { scope } : {}),
    ...(s(o.representation) ? { representation: s(o.representation) as string } : {}),
    ...(TRANSFER.includes(o.transfer as Transfer) ? { transfer: o.transfer as Transfer } : {}),
    ...(FLUENCY.includes(o.fluency as Fluency) ? { fluency: o.fluency as Fluency } : {}),
  }
  return Object.keys(f).length ? f : undefined
}

function sanitizeConcepts(raw: Record<string, unknown> | undefined, chunkId: string): ConceptCandidate[] {
  const arr = Array.isArray(raw?.concepts) ? (raw.concepts as unknown[]) : []
  const out: ConceptCandidate[] = []
  for (const c of arr) {
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    const title = asLocalized(o.title)
    if (!title) continue
    const kind = KINDS.includes(o.kind as CompetencyKind) ? (o.kind as CompetencyKind) : undefined
    const description = asLocalized(o.description)
    const evidence = (Array.isArray(o.evidence) ? o.evidence : [])
      .map((e): { chunkId: string; quote: string } | undefined => {
        const q = (e as Record<string, unknown> | null)?.quote
        return typeof q === 'string' && q.trim() ? { chunkId, quote: q.trim() } : undefined
      })
      .filter((e): e is { chunkId: string; quote: string } => e !== undefined)
    const confidence = typeof o.confidence === 'number' ? clamp01(o.confidence) : undefined
    // KHÔNG nhận `stage` ở đây: KC là canonical, trung lập với khung (bất biến I2). Stage nằm trên OBJECTIVE.
    const strand = typeof o.strand === 'string' && o.strand.trim() ? o.strand.trim() : undefined
    const subject =
      typeof o.subject === 'string' && o.subject.trim() ? o.subject.trim().toLowerCase() : undefined
    const facets = sanitizeFacets(o.facets)
    out.push({
      title,
      ...(kind ? { kind } : {}),
      ...(description ? { description } : {}),
      ...(strand ? { strand } : {}),
      ...(subject ? { subject } : {}),
      ...(facets ? { facets } : {}),
      evidence,
      ...(confidence !== undefined ? { confidence } : {}),
    })
  }
  return out
}

/** Cạnh do model trả về THEO ID (k0, k1…) → map ngược ra title. Không so chuỗi dài → không mong manh. */
function sanitizeEdgesById(
  raw: Record<string, unknown> | undefined,
  titleById: ReadonlyMap<string, string>,
): EdgeCandidate[] {
  const arr = Array.isArray(raw?.edges) ? (raw.edges as unknown[]) : []
  const out: EdgeCandidate[] = []
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue
    const o = e as Record<string, unknown>
    const fromId = typeof o.from === 'string' ? o.from.trim() : ''
    const toId = typeof o.to === 'string' ? o.to.trim() : ''
    if (!fromId || !toId || fromId === toId) continue

    const fromTitle = titleById.get(fromId)
    const toTitle = titleById.get(toId)
    if (!fromTitle || !toTitle) continue // id model bịa → bỏ

    const relType = RELS.includes(o.relType as (typeof RELS)[number])
      ? (o.relType as (typeof RELS)[number])
      : undefined
    if (!relType) continue
    const mode = MODES.includes(o.mode as (typeof MODES)[number])
      ? (o.mode as (typeof MODES)[number])
      : 'RECOMMENDED'
    const rationale = typeof o.rationale === 'string' && o.rationale.trim() ? o.rationale.trim() : undefined
    const confidence = typeof o.confidence === 'number' ? clamp01(o.confidence) : undefined
    out.push({
      fromTitle,
      toTitle,
      relType,
      mode,
      ...(rationale ? { rationale } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    })
  }
  return out
}

/** Dựng bộ port biên soạn từ hạ tầng provider. `aiKey`/`embeddingKey`/`visionKey` override vendor. */
export function buildAuthoringPorts(opts?: {
  aiKey?: string
  embeddingKey?: string
  visionKey?: string
}): AuthoringPorts {
  const vision: VisionPort = {
    async extractText(chunk) {
      if (!chunk.imageRef) return ''
      const r = await getVision(opts?.visionKey).extractText({ image: chunk.imageRef })
      return r.text
    },
  }

  /**
   * Trích khái niệm CÓ TỰ THÍCH NGHI với mật độ.
   *
   * Bài học từ MOET: một dòng "Count, read and write numbers within 10; within 20; within 100" nở ra
   * tới 9 KC nguyên tử. Nghĩa là ĐỘ DÀI OUTPUT tỉ lệ với MẬT ĐỘ KIẾN THỨC, KHÔNG phải với độ dài
   * input — nên chia chunk theo số ký tự là sai gốc, và nới maxTokens chỉ đẩy lùi ngưỡng vỡ.
   *
   * Lời giải: bị cắt → TỰ CHIA ĐÔI ở ranh giới dòng rồi thử lại. Hệ thống thích nghi, không bắt
   * người gọi đoán đúng kích thước chunk. Chỉ khi không chia nhỏ hơn được nữa mới chịu thua và NỔ
   * (vẫn không bao giờ im lặng trả 0).
   */
  const MAX_SPLIT_DEPTH = 4

  async function extractAdaptive(text: string, chunkId: string, depth: number): Promise<ConceptCandidate[]> {
    const res = await getAi(opts?.aiKey).generateText({
      system: await renderPrompt('authoring.concept.extract'),
      messages: [{ role: 'user', content: text }],
      model: modelFor('extraction'),
      maxTokens: 8000,
    })

    if (res.finishReason !== 'max_tokens') {
      return sanitizeConcepts(parseModelJson(res.text, `Trích khái niệm hỏng ở đoạn "${chunkId}"`), chunkId)
    }

    const lines = text.split('\n')
    if (depth >= MAX_SPLIT_DEPTH || lines.length < 2) {
      throw new Error(
        `Trích khái niệm bị CẮT dù đã chia tới đáy (chunk "${chunkId}", ${text.length} ký tự, ` +
          `độ sâu ${depth}). Đoạn này quá dày kiến thức cho một lượt — cần tăng maxTokens hoặc tách tay.`,
      )
    }

    const mid = Math.floor(lines.length / 2)
    const [a, b] = await Promise.all([
      extractAdaptive(lines.slice(0, mid).join('\n'), `${chunkId}·a`, depth + 1),
      extractAdaptive(lines.slice(mid).join('\n'), `${chunkId}·b`, depth + 1),
    ])
    return [...a, ...b]
  }

  const extractor: ConceptExtractorPort = {
    extractConcepts: (unit) => extractAdaptive(unit.text, unit.chunkId, 0),
  }

  const edges: EdgeProposerPort = {
    async proposeEdges(concepts) {
      const items = concepts
        .map((c, i) => ({ id: `k${i}`, title: displayTitle(c.title) }))
        .filter((x) => x.title.length > 0)
      if (items.length < 2) return []

      // Cạnh tham chiếu bằng ID NGẮN, KHÔNG bằng chuỗi title.
      // Trước đây bắt model lặp lại y hệt cả câu dài ("Count objects from 0 to 20, recognising
      // conservation of number and one-to-one correspondence") để khớp — lệch một chữ là RỚT SẠCH,
      // và đó là lý do đồ thị ra 0 cạnh tiên quyết. Khớp theo id thì hết mong manh.
      const titleById = new Map(items.map((x) => [x.id, x.title]))

      // Chia lô + cửa sổ trượt (mỗi lô vẫn thấy phần cuối lô trước → bắt được cạnh liên lô).
      const BATCH = 18
      const OVERLAP = 6
      const out: EdgeCandidate[] = []
      const seen = new Set<string>()

      for (let i = 0; i < items.length; i += BATCH - OVERLAP) {
        const window = items.slice(Math.max(0, i - OVERLAP), i + BATCH)
        if (window.length < 2) break

        const res = await getAi(opts?.aiKey).generateText({
          system: await renderPrompt('authoring.edge.propose'),
          messages: [{ role: 'user', content: JSON.stringify({ concepts: window }) }],
          model: modelFor('extraction'),
          maxTokens: 4000,
        })
        if (res.finishReason === 'max_tokens') {
          throw new Error(`Đề xuất cạnh bị CẮT vì hết token (lô ${i}). Giảm BATCH.`)
        }

        for (const e of sanitizeEdgesById(
          parseModelJson(res.text, `Đề xuất quan hệ hỏng ở lô ${i}`),
          titleById,
        )) {
          const k = `${e.fromTitle}→${e.toTitle}:${e.relType}`
          if (seen.has(k)) continue
          seen.add(k)
          out.push(e)
        }
        if (i + BATCH >= items.length) break
      }
      return out
    },
  }

  const embedding: EmbeddingPort = {
    async embed(text) {
      const r = await getEmbedding(opts?.embeddingKey).embed({ texts: [text] })
      return r.vectors[0] ?? []
    },
  }

  return { vision, extractor, edges, embedding }
}
