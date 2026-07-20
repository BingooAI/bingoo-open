/** Orchestrator ①→⑤: nguồn thô → bản nháp (dùng cổng LLM/vision). Ranh giới async. */

import type { CompetencyKind } from '@bingoo.ai/knowledge-engine'
import type { ConceptDraft, EdgeDraft, IngestDraft, LocalizedText, RawSource } from './model'
import { canonicalTitle } from './slug'
import type { AuthoringPorts, ConceptCandidate } from './ports'

// TIẾNG ANH LÀ GỐC — PHẢI dùng chung `canonicalTitle` với slug/dedup/adapter.
// Trước đây hàm này ưu tiên 'vi' còn adapter ưu tiên 'en' → map cạnh trượt 100% → đồ thị MẤT SẠCH
// cạnh tiên quyết, mà chỉ ghi một dòng warning không ai đọc. Định danh không được phép phụ thuộc
// vào "ngôn ngữ nào tình cờ đứng trước".
const titleKey = (t: LocalizedText): string => canonicalTitle(t)

/**
 * Chạy trích xuất: mỗi chunk → text (vision nếu là ảnh) → khái niệm → cạnh đề xuất.
 * Trả IngestDraft để host chạy tiếp dedupeConcepts → compileDraft → validateDraft → duyệt.
 * KHÔNG tự publish: người duyệt + validity gate là bắt buộc.
 */
export async function runIngest(source: RawSource, ports: AuthoringPorts): Promise<IngestDraft> {
  const warnings: string[] = []
  const concepts: ConceptDraft[] = []
  const titleToTempId = new Map<string, string>()
  let counter = 0

  const chunks = [...source.chunks].sort((a, b) => a.order - b.order)
  for (const chunk of chunks) {
    let text = chunk.text ?? ''
    if (!text && chunk.imageRef && ports.vision) {
      text = await ports.vision.extractText(chunk)
    }
    if (!text) {
      warnings.push(`Chunk ${chunk.id} không có văn bản (thiếu vision?).`)
      continue
    }

    const candidates = await ports.extractor.extractConcepts({ chunkId: chunk.id, text })
    for (const cand of candidates) {
      const kind: CompetencyKind = cand.kind ?? 'KNOWLEDGE'
      if (cand.kind === undefined)
        warnings.push(`"${titleKey(cand.title)}" chưa phân loại — tạm coi là KNOWLEDGE.`)
      if ((cand.confidence ?? 1) < 0.5)
        warnings.push(`"${titleKey(cand.title)}" độ tin cậy thấp — cần soạn giả xem lại.`)

      const tempId = `c${counter++}`
      titleToTempId.set(titleKey(cand.title), tempId)
      concepts.push({
        tempId,
        title: cand.title,
        kind,
        evidence: cand.evidence,
        ...(cand.description !== undefined ? { description: cand.description } : {}),
        ...(cand.strand !== undefined ? { strand: cand.strand } : {}),
        ...(cand.subject !== undefined ? { subject: cand.subject } : {}),
        ...(cand.facets !== undefined ? { facets: cand.facets } : {}),
        ...(cand.confidence !== undefined ? { confidence: cand.confidence } : {}),
      })
    }
  }

  // ⑤ cạnh đề xuất — proposer nhận toàn bộ khái niệm để suy tiên quyết/thành phần
  const asCandidates: ConceptCandidate[] = concepts.map((c) => ({
    title: c.title,
    kind: c.kind,
    evidence: c.evidence,
    ...(c.description !== undefined ? { description: c.description } : {}),
    ...(c.strand !== undefined ? { strand: c.strand } : {}),
    ...(c.subject !== undefined ? { subject: c.subject } : {}),
    ...(c.facets !== undefined ? { facets: c.facets } : {}),
    ...(c.confidence !== undefined ? { confidence: c.confidence } : {}),
  }))
  const edgeCands = await ports.edges.proposeEdges(asCandidates)

  const edges: EdgeDraft[] = []
  for (const e of edgeCands) {
    const from = titleToTempId.get(e.fromTitle)
    const to = titleToTempId.get(e.toTitle)
    if (from === undefined || to === undefined) {
      warnings.push(`Bỏ cạnh "${e.fromTitle}" → "${e.toTitle}" (không khớp khái niệm nào).`)
      continue
    }
    edges.push({
      fromTempId: from,
      toTempId: to,
      relType: e.relType,
      mode: e.mode,
      ...(e.weight !== undefined ? { weight: e.weight } : {}),
      ...(e.rationale !== undefined ? { rationale: e.rationale } : {}),
      ...(e.confidence !== undefined ? { confidence: e.confidence } : {}),
    })
  }

  return { concepts, edges, warnings }
}
