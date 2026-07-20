/**
 * Cổng LLM/vision — biên "bẩn" của pipeline. Host cấp adapter (Claude vision, embedding…).
 * Mirror của EnginePorts: lõi authoring thuần; mọi I/O/model nằm sau các interface này.
 */

import type { Awaitable, CompetencyKind } from '@bingoo/knowledge-engine'
import type { Facets } from '@bingoo/facets'
import type { EvidenceRef, LocalizedText, SourceChunk } from './model'

/** Khái niệm ứng viên do extractor trả về (kind tuỳ chọn — có thể để classifier gán sau). */
export interface ConceptCandidate {
  readonly title: LocalizedText
  readonly kind?: CompetencyKind
  /** Mạch kiến thức (vd "Number"). */
  readonly strand?: string
  /** Môn/ngành — chọn DomainProfile để xét định danh. */
  readonly subject?: string
  /** 6 trục PHÂN BIỆT — cái quyết định hai KC có phải một (thay cho ngưỡng so chuỗi). */
  readonly facets?: Facets
  readonly description?: LocalizedText
  readonly evidence: readonly EvidenceRef[]
  readonly confidence?: number
}

/** Cạnh ứng viên do proposer trả về (theo title/khoá tạm của extractor). */
export interface EdgeCandidate {
  readonly fromTitle: string
  readonly toTitle: string
  readonly relType: 'PREREQUISITE' | 'ENABLES' | 'COMPOSES'
  readonly mode: 'REQUIRED' | 'RECOMMENDED'
  readonly weight?: number
  readonly rationale?: string
  readonly confidence?: number
}

/** ① Ảnh/PDF → văn bản có cấu trúc. */
export interface VisionPort {
  extractText(chunk: SourceChunk): Awaitable<string>
}

/** ③ Một đơn vị văn bản → danh sách khái niệm ứng viên. */
export interface ConceptExtractorPort {
  extractConcepts(unit: {
    readonly chunkId: string
    readonly text: string
  }): Awaitable<readonly ConceptCandidate[]>
}

/** ⑤ Tập khái niệm → cạnh tiên quyết/thành phần đề xuất (KHÓ NHẤT; người duyệt sau). */
export interface EdgeProposerPort {
  proposeEdges(concepts: readonly ConceptCandidate[]): Awaitable<readonly EdgeCandidate[]>
}

/** ⑥ (tuỳ chọn) Embedding cho dedup ngữ nghĩa; thiếu → fallback trigram thuần. */
export interface EmbeddingPort {
  embed(text: string): Awaitable<readonly number[]>
}

export interface AuthoringPorts {
  readonly vision?: VisionPort
  readonly extractor: ConceptExtractorPort
  readonly edges: EdgeProposerPort
  readonly embedding?: EmbeddingPort
}
