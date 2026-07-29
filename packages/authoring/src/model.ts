// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Mô hình dữ liệu trung gian cho pipeline biên soạn (ingestion).
 *
 * Đây là các "bản nháp" (draft) giữa nguồn thô (PDF/ảnh/sách) và đầu ra engine-ready.
 * Chỉ khai báo kiểu; logic ở các module thuần. Đầu ra cuối khớp `GraphData` + `Framework`
 * mà engine đã nhận (xem compile.ts).
 */

import type { CompetencyKind, FrameworkKind, PrereqMode, RelType, Slug } from '@bingoo.ai/knowledge-engine'
import type { Facets } from '@bingoo.ai/facets'

export type LocalizedText = Readonly<Record<string, string>>

/** Một mảnh nguồn: trang PDF / ảnh / khối văn bản. */
export interface SourceChunk {
  readonly id: string
  readonly order: number
  readonly label?: string
  readonly text?: string
  readonly imageRef?: string
}

export interface RawSource {
  readonly id: string
  /**
   * Nguồn thuộc loại gì — NHÃN ĐỂ ĐỌC, pipeline không rẽ nhánh theo nó.
   *
   * Việc đọc ảnh hay không do TỪNG MẨU quyết định (`imageRef` có hay không), nên trường này chưa
   * bao giờ được đọc tới. Trước đây một giá trị của nó là `zip-images`, và đó là một lời hứa không
   * có mã đứng sau: schema nhận, trả 200, mà không gì giải nén — người gửi tưởng hệ thống hiểu tệp
   * nén của họ. Nhãn phải nói đúng thứ hệ thống làm được: từng ảnh, không phải tệp nén.
   */
  readonly kind: 'pdf' | 'images' | 'text'
  readonly locale: string
  readonly chunks: readonly SourceChunk[]
}

/** Trích dẫn nguồn để truy vết một khái niệm/mục tiêu về đâu trong sách (audit học thuật). */
export interface EvidenceRef {
  readonly chunkId: string
  readonly quote: string
  /**
   * Kết quả KIỂM câu trích tại chỗ (verifyQuote): `verified=true` CHỈ khi câu này tìm thấy nguyên
   * văn trong nguồn. Không set = chưa kiểm. Đây là thứ cho phép tô "từ tài liệu" thay vì "AI đoán".
   */
  readonly verified?: boolean
  /** Offset trong nguồn ĐÃ chuẩn hoá (normalizeSource) — để tô sáng đúng đoạn cho người duyệt. */
  readonly charStart?: number
  readonly charEnd?: number
}

/** Khái niệm ứng viên do máy trích (chưa gán slug ổn định). */
export interface ConceptDraft {
  readonly tempId: string
  readonly title: LocalizedText
  readonly kind: CompetencyKind
  // KHÔNG có `stage`: KC canonical, trung lập với khung (bất biến I2 — chặn ngay ở TẦNG KIỂU,
  // không đợi runtime). "add within 20" nằm ở Cambridge Stage 2 VÀ Lớp 1 VN → không thể có 1 stage.
  /** Mạch kiến thức (vd "Number") — để nhóm/lọc. */
  readonly strand?: string
  /** Môn/ngành — chọn DomainProfile nào để xét định danh. */
  readonly subject?: string
  /** 6 trục phân biệt — cái quyết định HAI KC CÓ PHẢI MỘT KHÔNG (thay cho ngưỡng so chuỗi). */
  readonly facets?: Facets
  readonly description?: LocalizedText
  readonly evidence: readonly EvidenceRef[]
  readonly confidence?: number
  /** Gán ở bước dedup/compile. */
  readonly slug?: Slug
}

/** Cạnh đề xuất giữa hai khái niệm (tham chiếu theo tempId). */
export interface EdgeDraft {
  readonly fromTempId: string
  readonly toTempId: string
  readonly relType: RelType
  readonly mode: PrereqMode
  readonly weight?: number
  readonly rationale?: string
  readonly confidence?: number
}

/** Mục tiêu/chuẩn từ khung chương trình, ánh xạ xuống concept nền qua tempId. */
export interface ObjectiveDraft {
  readonly tempId: string
  readonly title: LocalizedText
  readonly code?: string
  readonly stage?: string
  readonly strand?: string
  readonly mapsToTempIds: readonly string[]
  readonly evidence?: readonly EvidenceRef[]
}

export interface FrameworkDraft {
  readonly slug: string
  readonly name: LocalizedText
  readonly kind: FrameworkKind
  readonly locale: string
  readonly objectives: readonly ObjectiveDraft[]
}

/** Bản nháp hoàn chỉnh sau khi trích — đầu vào cho dedup → compile → validate. */
export interface IngestDraft {
  readonly concepts: readonly ConceptDraft[]
  readonly edges: readonly EdgeDraft[]
  readonly framework?: FrameworkDraft
  readonly warnings: readonly string[]
}

/** Khái niệm đã tồn tại trong graph (để dedup không tạo trùng). */
export interface ExistingConcept {
  readonly slug: Slug
  readonly title: string
  readonly kind?: CompetencyKind
}
