// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * GHI THẺ TRUY NGUỒN cho các quyết định của AI — node của đồ thị truy-ngược (C1 schema).
 *
 * Phần THUẦN ở đây (`buildObjectiveTrace`) không đụng DB: nó biến một mục tiêu đã compile thành
 * payload thẻ + bằng chứng, và LÀ NƠI quyết định làn nào được bật:
 *   • SOURCE_SPAN  — câu trích, ĐƯỢC KIỂM LẠI byte-for-byte vào chính đoạn nguồn sẽ LƯU (không tin
 *                    cờ verified mang từ xa tới); khớp → basis FROM_SOURCE, không → AI_INFERRED.
 *   • STRUCTURAL_CHECK — I5 phủ (mục tiêu MAPS_TO ≥1 KC), ĐÓNG BĂNG kết quả lúc này để sau đối chiếu.
 *
 * "Tìm thấy chuỗi" ≠ "câu này chứng minh mục tiêu": basis chỉ nói câu CÓ trong tài liệu, người
 * duyệt mới xác nhận nó có đúng là căn cứ (R5). Mục tiêu KHÔNG có câu trích (đường sinh-từ-chủ-đề)
 * là AI_INFERRED trung thực — làn nguồn để TRỐNG (UI hiện dòng xám "không trích từ tài liệu nào"),
 * KHÔNG phải "kiểm hụt".
 */

import { normalizeSource, verifyQuote, type CompiledObjective } from '@bingoo.ai/authoring'

export type EvidenceBasis = 'FROM_SOURCE' | 'STRUCTURAL' | 'AI_INFERRED'

export interface TraceEvidenceInput {
  readonly kind: 'SOURCE_SPAN' | 'STRUCTURAL_CHECK'
  readonly basis: EvidenceBasis
  readonly method: string
  readonly quote?: string
  readonly chunkId?: string
  readonly quoteVerified?: boolean
  readonly charStart?: number
  readonly charEnd?: number
  readonly checkCode?: string
  readonly passed?: boolean
  readonly detail?: Readonly<Record<string, unknown>>
}

export interface TraceRecordInput {
  readonly artifact: 'OBJECTIVE_EXISTS'
  readonly subjectSlug: string
  readonly claim: { readonly vi: string; readonly en: string }
  readonly method: 'LLM'
  readonly basis: EvidenceBasis
  readonly checksPassed: readonly string[]
  readonly checksFailed: readonly string[]
  readonly evidence: readonly TraceEvidenceInput[]
}

const CHECK_COVERAGE = 'coverage:nonempty'

/**
 * Dựng thẻ OBJECTIVE_EXISTS cho một mục tiêu, đối chiếu câu trích vào `excerpt` (đoạn nguồn ĐÃ
 * chuẩn hoá sẽ được LƯU cùng — offset trả về khớp với nó). Thuần, không I/O.
 */
export function buildObjectiveTrace(o: CompiledObjective, excerpt: string): TraceRecordInput {
  const evidence: TraceEvidenceInput[] = []

  // SOURCE_SPAN — KIỂM LẠI vào chính đoạn sẽ lưu, không tin cờ verified mang từ lúc trích.
  const quote = o.evidence?.[0]?.quote
  let grounded = false
  if (quote !== undefined) {
    const m = verifyQuote(quote, excerpt)
    grounded = m.status === 'verified'
    const chunkId = o.evidence?.[0]?.chunkId
    evidence.push({
      kind: 'SOURCE_SPAN',
      basis: grounded ? 'FROM_SOURCE' : 'AI_INFERRED',
      method: 'quote',
      quote,
      ...(chunkId !== undefined ? { chunkId } : {}),
      quoteVerified: grounded,
      ...(m.charStart !== undefined ? { charStart: m.charStart, charEnd: m.charEnd } : {}),
    })
  }

  // STRUCTURAL_CHECK — I5 phủ: mục tiêu chứng nhận bởi ≥1 KC. Xác định, đóng băng lúc này.
  const covered = o.mapsTo.length >= 1
  evidence.push({
    kind: 'STRUCTURAL_CHECK',
    basis: 'STRUCTURAL',
    method: 'invariant:I5',
    checkCode: CHECK_COVERAGE,
    passed: covered,
    detail: { mapsTo: [...o.mapsTo] },
  })

  const titleVi = o.title.vi ?? o.title.en ?? o.slug
  const titleEn = o.title.en ?? o.title.vi ?? o.slug
  return {
    artifact: 'OBJECTIVE_EXISTS',
    subjectSlug: o.slug,
    claim: {
      vi: `"${titleVi}" là một mục tiêu học tập của khung này.`,
      en: `"${titleEn}" is a learning objective of this framework.`,
    },
    method: 'LLM',
    // basis của THẺ phản ánh làn mạnh nhất: có nguồn kiểm được → FROM_SOURCE, không → AI_INFERRED.
    // (Kiểm cấu trúc luôn có, nhưng nó chứng "đủ ≥1 KC", không chứng "vì sao có mục tiêu này".)
    basis: grounded ? 'FROM_SOURCE' : 'AI_INFERRED',
    checksPassed: covered ? [CHECK_COVERAGE] : [],
    checksFailed: covered ? [] : [CHECK_COVERAGE],
    evidence,
  }
}

/** Chuẩn hoá đoạn nguồn trước khi lưu (offset của thẻ khớp với chuỗi này). Re-export cho seed/writer. */
export { normalizeSource }
