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

import {
  explainClaim,
  locateInUnits,
  normalizeSource,
  verifyQuote,
  type CompiledConcept,
  type CompiledObjective,
  type LocalizedText,
  type Merge,
  type PositionedUnit,
  type SourceLocator,
} from '@bingoo.ai/authoring'
import type { Facets } from '@bingoo.ai/facets'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { db, type Prisma } from '@bingoo.ai/db'
import { getStorage } from '../providers'

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
  readonly artifact: 'OBJECTIVE_EXISTS' | 'CONCEPT_EXISTS' | 'PREREQ_EDGE' | 'OBJECTIVE_COVERAGE'
  readonly subjectSlug: string
  /** Đầu `to` của một quan hệ. Vắng với thẻ về một mục đơn lẻ. */
  readonly objectSlug?: string
  /** PREREQUISITE | ENABLES | COMPOSES | MAPS_TO — phân biệt loại quan hệ trong cùng một thẻ. */
  readonly relType?: string
  readonly claim: { readonly vi: string; readonly en: string }
  /** Ai/cái gì đã quyết: model, luật phạm vi, cổng bất biến, hay người duyệt. */
  readonly method: 'LLM' | 'RULE_SCOPE' | 'RULE_INVARIANT' | 'TRIGRAM' | 'HUMAN'
  readonly basis: EvidenceBasis
  readonly checksPassed: readonly string[]
  readonly checksFailed: readonly string[]
  readonly evidence: readonly TraceEvidenceInput[]
}

const CHECK_COVERAGE = 'coverage:nonempty'
/** Kiến thức có khai dấu hiệu phân biệt (`object`) — thiếu là máy không tách được nó khỏi cái khác. */
const CHECK_DISCRIMINATING = 'facets:discriminating'
/** Thứ tự CHỨNG ĐƯỢC bằng phạm vi bao nhau (cùng đối tượng). */
const CHECK_ORDER_PROVEN = 'scope:subset'
/** Phạm vi chỉ NGƯỢC chiều — dấu hiệu cạnh đặt sai, cần người xem. */
const CHECK_ORDER_REVERSED = 'scope:superset'
/** Khác đối tượng / không so được phạm vi → máy chỉ chắc chuỗi không quay vòng. */
const CHECK_ORDER_JUDGMENT = 'order:judgment'
/** Đạt mục tiêu đòi ĐỦ mọi mảnh (MAPS_TO là REQUIRED — bất biến I4). */
const CHECK_REQUIRED_ALL = 'coverage:required-all'
/**
 * Chính TÀI LIỆU xếp cái nào trước.
 *
 * Không phải bằng chứng sư phạm — người ta xếp trang vì nhiều lý do. Nhưng khi máy không chứng được
 * gì từ dấu hiệu, đây là thứ DUY NHẤT còn kiểm được, và nó có sức nặng thật theo chiều NGƯỢC: tài
 * liệu đặt A sau B trong khi khung khai A học trước B là một mâu thuẫn đáng nhìn lại.
 */
const CHECK_READING_ORDER = 'order:reading'

/**
 * Dựng thẻ OBJECTIVE_EXISTS cho một mục tiêu, đối chiếu câu trích vào `excerpt` (đoạn nguồn ĐÃ
 * chuẩn hoá sẽ được LƯU cùng — offset trả về khớp với nó). Thuần, không I/O.
 */
export function buildObjectiveTrace(o: CompiledObjective, excerpt: string): TraceRecordInput {
  const evidence: TraceEvidenceInput[] = []

  // SOURCE_SPAN — KIỂM LẠI vào chính đoạn sẽ lưu, không tin cờ verified mang từ lúc trích.
  // Đi qua engine giải thích dùng chung, không gọi verifyQuote trực tiếp: mọi mặt của hệ phải đọc
  // cùng một kết luận, và một bản sao logic ở đây là chỗ để hai mặt lệch nhau về sau.
  const quote = o.evidence?.[0]?.quote
  let grounded = false
  if (quote !== undefined) {
    const ex = explainClaim({ claimKind: 'OBJECTIVE_EXISTS', quote, sourceExcerpt: excerpt })
    const m = ex.quote ?? { status: 'not_found' as const }
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

/**
 * Dựng thẻ CONCEPT_EXISTS cho một kiến thức.
 *
 * Cùng làn nguồn với mục tiêu — cùng một câu hỏi ("câu này có thật trong tài liệu không?") nên cùng
 * một cách trả lời. Trước đây kiến thức không có thẻ nào cả: người duyệt thấy một danh sách khái niệm
 * xuất hiện từ hư không, và câu "vì sao có kiến thức này" không có chỗ nào trả lời.
 *
 * Làn cấu trúc ở đây hỏi một việc khác với mục tiêu: kiến thức này có khai đủ dấu hiệu để PHÂN BIỆT
 * với kiến thức khác không. Không có `object` thì máy không có cơ sở nào tách nó khỏi cái bên cạnh —
 * đúng chỗ mà quy tắc định danh sẽ chặn, nên nói ra từ đây thay vì để người duyệt gặp lỗi ở cuối.
 */
export function buildConceptTrace(c: CompiledConcept, excerpt: string): TraceRecordInput {
  const evidence: TraceEvidenceInput[] = []

  const quote = c.evidence[0]?.quote
  let grounded = false
  if (quote !== undefined) {
    const ex = explainClaim({ claimKind: 'CONCEPT_EXISTS', quote, sourceExcerpt: excerpt })
    const m = ex.quote ?? { status: 'not_found' as const }
    grounded = m.status === 'verified'
    const chunkId = c.evidence[0]?.chunkId
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

  const facets = (c.facets ?? {}) as Record<string, unknown>
  const discriminating = typeof facets.object === 'string' && facets.object.length > 0
  evidence.push({
    kind: 'STRUCTURAL_CHECK',
    basis: 'STRUCTURAL',
    method: 'invariant:I1',
    checkCode: CHECK_DISCRIMINATING,
    passed: discriminating,
    detail: { facets },
  })

  const titleVi = c.title.vi ?? c.title.en ?? c.slug
  const titleEn = c.title.en ?? c.title.vi ?? c.slug
  return {
    artifact: 'CONCEPT_EXISTS',
    subjectSlug: c.slug,
    claim: {
      vi: `Tài liệu có nói tới kiến thức "${titleVi}".`,
      en: `The source mentions the knowledge "${titleEn}".`,
    },
    method: 'LLM',
    // Câu trích khớp thì đây là dữ kiện từ tài liệu; không khớp thì nó vẫn chỉ là AI nói.
    basis: grounded ? 'FROM_SOURCE' : 'AI_INFERRED',
    checksPassed: discriminating ? [CHECK_DISCRIMINATING] : [],
    checksFailed: discriminating ? [] : [CHECK_DISCRIMINATING],
    evidence,
  }
}

/**
 * Dựng thẻ PREREQ_EDGE — "vì sao cái này học trước cái kia".
 *
 * Đây là chỗ trung thực khó nhất của cả hệ. Cạnh do AI đề xuất, và với hai kiến thức CÙNG đối tượng
 * mà phạm vi nằm gọn trong nhau (đếm đến 20 ⊂ đếm đến 100) thì thứ tự là thứ MÁY TỰ CHỨNG ĐƯỢC. Với
 * hai đối tượng KHÁC nhau thì máy không chứng được gì cả — nó chỉ biết chuỗi học không quay vòng, còn
 * "vì sao trước" là phán đoán sư phạm. Thẻ này nói ra đúng cái nào là cái nào, và không bịa lý do cho
 * trường hợp thứ hai.
 *
 * `inputsVerified` khoá theo XUẤT XỨ: một bước suy luận đúng trên phạm vi mà AI gán và chưa ai đối
 * chiếu tài liệu thì kết quả vẫn chưa kiểm — nên nó chỉ true khi CẢ HAI đầu có câu trích đã khớp.
 */
export function buildEdgeOrderingTrace(
  edge: { readonly from: string; readonly to: string; readonly relType?: string },
  from: {
    readonly title: LocalizedText
    readonly facets?: Readonly<Record<string, unknown>>
    readonly grounded: boolean
  },
  to: {
    readonly title: LocalizedText
    readonly facets?: Readonly<Record<string, unknown>>
    readonly grounded: boolean
  },
  /** Vị trí câu trích của hai đầu TRONG tài liệu. Vắng khi một đầu không có câu trích đã kiểm. */
  readingOrder?: { readonly fromOrder: number; readonly toOrder: number },
): TraceRecordInput {
  const relType = edge.relType ?? 'PREREQUISITE'
  const ex = explainClaim({
    claimKind: 'ORDERING_EDGE',
    relType,
    ...(from.facets !== undefined ? { fromFacets: from.facets as Facets } : {}),
    ...(to.facets !== undefined ? { toFacets: to.facets as Facets } : {}),
    inputsVerified: from.grounded && to.grounded,
    ...(readingOrder !== undefined ? { readingOrder } : {}),
  })

  const fv = from.title.vi ?? from.title.en ?? edge.from
  const tv = to.title.vi ?? to.title.en ?? edge.to
  const fe = from.title.en ?? from.title.vi ?? edge.from
  const te = to.title.en ?? to.title.vi ?? edge.to

  const proven = ex.relation?.basis === 'ordering-proven'
  const contradicted = ex.relation?.basis === 'ordering-contradicted'
  const check = proven ? CHECK_ORDER_PROVEN : contradicted ? CHECK_ORDER_REVERSED : CHECK_ORDER_JUDGMENT

  return {
    artifact: 'PREREQ_EDGE',
    subjectSlug: edge.from,
    objectSlug: edge.to,
    relType,
    claim: {
      vi: `"${fv}" học trước "${tv}".`,
      en: `"${fe}" comes before "${te}".`,
    },
    method: proven || contradicted ? 'RULE_SCOPE' : 'LLM',
    // `basis` là thứ giao diện tô màu theo, và explainClaim đã khoá nó theo xuất xứ đầu vào — nên
    // không đọc lại `tier` để tự suy ra màu ở đây.
    basis: ex.basis,
    checksPassed: proven ? [check] : [],
    checksFailed: contradicted ? [check] : [],
    evidence: [
      {
        kind: 'STRUCTURAL_CHECK',
        basis: ex.basis === 'STRUCTURAL' ? 'STRUCTURAL' : 'AI_INFERRED',
        method: 'rule:compareScope',
        checkCode: check,
        passed: proven,
        // ĐÓNG BĂNG so sánh: đọc lại sau này mà đồ thị đã đổi thì còn đối chiếu được với lúc quyết.
        detail: {
          relationBasis: ex.relation?.basis ?? 'unknown',
          sameObject: ex.relation?.sameObject ?? false,
          scope: ex.relation?.scope ?? 'incomparable',
          tier: ex.tier,
          machineProven: ex.machineProven,
          provenanceCaveat: ex.provenanceCaveat,
          ...(ex.contradictedBy !== undefined ? { contradictedBy: ex.contradictedBy } : {}),
          axes: ex.facets?.axes ?? [],
        },
      },
      /**
       * Làn THỨ TỰ ĐỌC — chỉ ghi khi biết được, và ghi cả khi nó NÓI NGƯỢC.
       *
       * Engine vốn tính được làn này từ đầu và chưa ai truyền vào, nên nó chưa từng xuất hiện ở
       * đâu. Nó yếu — cách xếp trang không phải lý lẽ dạy học — nhưng ở đúng những cạnh mà máy
       * không chứng được gì thì đây là thứ duy nhất còn đối chiếu được, và một tài liệu xếp ngược
       * hẳn với thứ tự đang khai là điều người duyệt phải thấy.
       */
      ...(ex.readingOrderAgrees !== undefined
        ? [
            {
              kind: 'STRUCTURAL_CHECK' as const,
              basis: 'AI_INFERRED' as const,
              method: 'rule:readingOrder',
              checkCode: CHECK_READING_ORDER,
              passed: ex.readingOrderAgrees,
            },
          ]
        : []),
    ],
  }
}

/**
 * Dựng thẻ OBJECTIVE_COVERAGE — "vì sao mục tiêu này cần đúng kiến thức đó".
 *
 * Một thẻ cho MỖI cặp (mục tiêu, kiến thức), không phải một thẻ gộp: người duyệt bỏ hoặc giữ từng
 * mảnh một, nên căn cứ cũng phải ở mức từng mảnh.
 *
 * Đây LUÔN là lựa chọn của AI, không phải điều máy chứng được — máy chỉ cưỡng chế được một việc khác:
 * đạt mục tiêu đòi ĐỦ mọi mảnh (MAPS_TO là REQUIRED, bất biến I4). Hai điều đó phải tách nhau trong
 * giao diện, nếu không "máy bắt buộc đủ cả" bị đọc thành "máy đã kiểm rằng đúng những mảnh này".
 */
export function buildCoverageTrace(
  objective: { readonly slug: string; readonly title: LocalizedText },
  concept: {
    readonly slug: string
    readonly title: LocalizedText
    readonly facets?: Readonly<Record<string, unknown>>
  },
): TraceRecordInput {
  const ex = explainClaim({
    claimKind: 'OBJECTIVE_COVERAGE',
    relType: 'MAPS_TO',
    ...(concept.facets !== undefined ? { toFacets: concept.facets as Facets } : {}),
  })
  const ov = objective.title.vi ?? objective.title.en ?? objective.slug
  const cv = concept.title.vi ?? concept.title.en ?? concept.slug
  const oe = objective.title.en ?? objective.title.vi ?? objective.slug
  const ce = concept.title.en ?? concept.title.vi ?? concept.slug
  return {
    artifact: 'OBJECTIVE_COVERAGE',
    subjectSlug: objective.slug,
    objectSlug: concept.slug,
    relType: 'MAPS_TO',
    claim: {
      vi: `Để đạt "${ov}", người học cần "${cv}".`,
      en: `Reaching "${oe}" requires "${ce}".`,
    },
    method: 'LLM',
    // Chọn mảnh nào là việc của AI → phán đoán. Không có làn nào kiểm được điều đó.
    basis: 'AI_INFERRED',
    checksPassed: [CHECK_REQUIRED_ALL],
    checksFailed: [],
    evidence: [
      {
        kind: 'STRUCTURAL_CHECK',
        basis: 'STRUCTURAL',
        method: 'invariant:I4',
        checkCode: CHECK_REQUIRED_ALL,
        passed: true,
        detail: { note: 'mapsTo-required-and', relationBasis: ex.relation?.basis ?? 'mapping' },
      },
    ],
  }
}

/** Chuẩn hoá đoạn nguồn trước khi lưu (offset của thẻ khớp với chuỗi này). Re-export cho seed/writer. */
export { normalizeSource }

// ─────────────────────────────────────────────────────────────────────────────
// PHỤC VỤ BYTES tài liệu cho viewer. `storageKey` là đường dẫn TƯƠNG ĐỐI trong thư mục gốc cấu hình
// (SOURCE_DOC_ROOT). R8: self-hoster trỏ tới file của họ; KHÔNG hạ tầng Bingoo. Chống path traversal.
// ─────────────────────────────────────────────────────────────────────────────

function sourceDocRoot(): string {
  return resolve(process.env.SOURCE_DOC_ROOT ?? resolve(process.cwd(), '../..'))
}

/** Đường dẫn tuyệt đối trong SOURCE_DOC_ROOT cho một storageKey — dùng chung seed + serve. */

export function resolveSourcePath(storageKey: string): string {
  return resolve(sourceDocRoot(), storageKey)
}

/**
 * Lấy bytes của một tài liệu trong KHO.
 *
 * Cổng lưu trữ không có hàm đọc thẳng — nó ký URL rồi ai cần thì tự tải. Đúng cho luồng bình
 * thường (hàng trăm MB không nên chạy vòng qua máy chủ), nên chỗ này đi đúng đường đó: ký một URL
 * sống rất ngắn rồi tự tải về.
 */
export async function fetchStoredBytes(storageKey: string): Promise<Uint8Array | null> {
  try {
    const { url } = await getStorage().createSignedDownloadUrl({ key: storageKey, expiresInSeconds: 120 })
    const res = await fetch(url)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Bytes tài liệu nguồn: thử THƯ MỤC TRÊN MÁY trước, rồi tới KHO.
 *
 * Chỉ có nhánh đầu thì trình xem PDF chỉ mở được tài liệu nằm sẵn trên đĩa máy phát triển. Mọi tài
 * liệu người dùng tải lên đều nằm trong kho, nên nút "mở đúng trang" tắt ngóm với đúng những tài
 * liệu mà tính năng này được dựng ra để phục vụ.
 */
export async function getSourceDocumentBytes(id: string): Promise<Uint8Array | null> {
  const doc = await db.sourceDocument.findUnique({ where: { id }, select: { storageKey: true } })
  if (!doc?.storageKey) return null
  const root = sourceDocRoot()
  const abs = resolve(root, doc.storageKey)
  if (abs === root || abs.startsWith(root + sep)) {
    try {
      return new Uint8Array(await readFile(abs))
    } catch {
      // Không có trên đĩa — bình thường với tài liệu tải lên. Rơi xuống kho.
    }
  }
  return fetchStoredBytes(doc.storageKey)
}

// ─────────────────────────────────────────────────────────────────────────────
// GHI (server-side) — seed/công cụ gọi TRỰC TIẾP. KHÔNG nối vào /apply: đường duyệt
// giữ nguyên như cũ (yêu cầu phản biện), tránh plumb evidence qua round-trip client.
// ─────────────────────────────────────────────────────────────────────────────

export interface WriteTraceResult {
  readonly records: number
  readonly sourceDocumentId: string
  readonly anchored: number
}

/**
 * NEO tài liệu (tuỳ chọn): nếu truyền, mỗi câu trích được ĐỊNH VỊ trong tài liệu (`locateInUnits`)
 * để "mở đúng trang, tô đúng dòng". `storageKey` cho viewer biết lấy bytes ở đâu. KHÔNG truyền =
 * chỉ excerpt như cũ.
 */
export interface AnchorContext {
  readonly units: readonly PositionedUnit[]
  readonly contentHash: string
  readonly pageCount?: number
  readonly storageKey?: string
}

/**
 * Ghi thẻ OBJECTIVE_EXISTS cho một BỘ mục tiêu vừa persist, đối chiếu vào `sourceText`.
 * IDEMPOTENT theo frameworkVersionId: xoá thẻ + nguồn cũ của đúng bản này rồi ghi lại (seed chạy
 * nhiều lần vẫn sạch — evidence cascade theo FK).
 */
/**
 * Ghi thẻ cho MỘT LƯỢT ÁP KHUNG — mục tiêu và kiến thức cùng một đường.
 *
 * Trước đây chỉ mục tiêu có thẻ, và hàm ghi nằm riêng cho nó. Kiến thức thì không có thẻ nào, nên
 * "vì sao có kiến thức này" không có chỗ nào trả lời — dù câu trích đã được kiểm ở pipeline. Một
 * hàm ghi cho cả hai vì phần khó (xoá-rồi-ghi idempotent, lưu đoạn nguồn, neo toạ độ, băm nội dung)
 * giống hệt nhau; nhân bản nó là nhân bản luôn mọi lỗi tương lai.
 */
export async function writeClaimTraces(
  frameworkVersionId: string,
  claims: {
    readonly objectives?: readonly CompiledObjective[]
    readonly concepts?: readonly CompiledConcept[]
    /** Cạnh thứ tự giữa các kiến thức — để trả lời "vì sao cái này học trước cái kia". */
    readonly edges?: readonly { readonly from: string; readonly to: string; readonly relType?: string }[]
  },
  sourceText: string,
  anchorCtx?: AnchorContext,
): Promise<WriteTraceResult> {
  const excerpt = normalizeSource(sourceText)
  const objectives = claims.objectives ?? []
  const concepts = claims.concepts ?? []

  // Mỗi mục là một thẻ + CÂU TRÍCH riêng của nó (câu để neo toạ độ ở dưới).
  // Tra kiến thức theo slug + biết đầu nào CÓ NGUỒN — cạnh cần cả hai để khoá `inputsVerified`.
  const byS = new Map(concepts.map((c) => [c.slug as string, c]))
  const grounded = new Map(
    concepts.map((c) => {
      const q = c.evidence[0]?.quote
      return [c.slug as string, q !== undefined && verifyQuote(q, excerpt).status === 'verified']
    }),
  )
  /**
   * Câu trích của một kiến thức nằm ở đâu TRONG tài liệu.
   *
   * `undefined` khi không có câu trích, hoặc câu trích không tìm lại được — và khi đó làn thứ-tự-đọc
   * phải VẮNG hẳn chứ không được đoán bừa một vị trí. Đoán ở đây là bịa ra một căn cứ.
   */
  const quoteOffset = (c: CompiledConcept | undefined): number | undefined => {
    const q = c?.evidence[0]?.quote
    if (q === undefined) return undefined
    const m = verifyQuote(q, excerpt)
    return m.status === 'verified' ? m.charStart : undefined
  }
  const side = (slug: string) => {
    const c = byS.get(slug)
    return {
      title: c?.title ?? { en: slug },
      ...(c?.facets !== undefined ? { facets: c.facets } : {}),
      grounded: grounded.get(slug) === true,
    }
  }

  const items: { record: TraceRecordInput; quote?: string }[] = [
    ...objectives.map((o) => {
      const q = o.evidence?.[0]?.quote
      return { record: buildObjectiveTrace(o, excerpt), ...(q !== undefined ? { quote: q } : {}) }
    }),
    ...concepts.map((c) => {
      const q = c.evidence[0]?.quote
      return { record: buildConceptTrace(c, excerpt), ...(q !== undefined ? { quote: q } : {}) }
    }),
    // Thứ tự học — chỉ cho cạnh giữa hai KIẾN THỨC mình biết mặt; cạnh trỏ ra ngoài lô thì bỏ, vì
    // không có facet hai đầu thì thẻ chỉ nói được "AI bảo thế", mà điều đó thẻ nào cũng nói được.
    ...(claims.edges ?? [])
      .filter((e) => byS.has(e.from) && byS.has(e.to))
      .map((e) => {
        // Vị trí câu trích trong CHÍNH đoạn nguồn đã chuẩn hoá — cùng thước đo cho cả hai đầu.
        const fo = quoteOffset(byS.get(e.from))
        const to = quoteOffset(byS.get(e.to))
        return {
          record: buildEdgeOrderingTrace(
            e,
            side(e.from),
            side(e.to),
            fo !== undefined && to !== undefined ? { fromOrder: fo, toOrder: to } : undefined,
          ),
        }
      }),
    // Mục tiêu gồm kiến thức nào — một thẻ cho MỖI cặp.
    ...objectives.flatMap((o) =>
      o.mapsTo
        .filter((t) => byS.has(t))
        .map((t) => ({ record: buildCoverageTrace(o, byS.get(t) as CompiledConcept) })),
    ),
  ]

  await db.decisionRecord.deleteMany({
    where: {
      artifact: { in: ['OBJECTIVE_EXISTS', 'CONCEPT_EXISTS', 'PREREQ_EDGE', 'OBJECTIVE_COVERAGE'] },
      frameworkVersionId,
      subjectSlug: { in: items.map((i) => i.record.subjectSlug) },
    },
  })
  // CHỈ tài liệu của KHUNG này. Sách của một khoá học nằm ở `courseSlug`, và xoá theo
  // frameworkVersionId sẽ không chạm tới nó — đó là lý do hai ref được tách cột.
  await db.sourceDocument.deleteMany({ where: { frameworkVersionId } })

  const source = await db.sourceDocument.create({
    data: {
      frameworkVersionId,
      excerptText: excerpt,
      ...(anchorCtx?.contentHash ? { contentHash: anchorCtx.contentHash } : {}),
      ...(anchorCtx?.pageCount !== undefined ? { pageCount: anchorCtx.pageCount } : {}),
      ...(anchorCtx?.storageKey ? { storageKey: anchorCtx.storageKey } : {}),
    },
  })

  let anchored = 0
  for (const { record: t, quote } of items) {
    // NEO: định vị câu trích trong tài liệu. Chỉ lưu locator khi định vị CHẮC CHẮN (locateInUnits
    // tự từ chối khi trùng/nhảy cột) — không tô khung bừa.
    const anchor = anchorCtx && quote !== undefined ? locateInUnits(quote, anchorCtx.units) : undefined
    if (anchor?.locator) anchored++
    await db.decisionRecord.create({
      data: {
        artifact: t.artifact,
        subjectSlug: t.subjectSlug,
        ...(t.objectSlug !== undefined ? { objectSlug: t.objectSlug } : {}),
        ...(t.relType !== undefined ? { relType: t.relType } : {}),
        claim: t.claim as unknown as Prisma.InputJsonValue,
        method: t.method,
        basis: t.basis,
        checksPassed: [...t.checksPassed],
        checksFailed: [...t.checksFailed],
        frameworkVersionId,
        sourceDocumentId: source.id,
        evidence: {
          create: t.evidence.map((e) => ({
            kind: e.kind,
            basis: e.basis,
            method: e.method,
            ...(e.quote !== undefined ? { quote: e.quote } : {}),
            ...(e.chunkId !== undefined ? { chunkId: e.chunkId } : {}),
            ...(e.quoteVerified !== undefined ? { quoteVerified: e.quoteVerified } : {}),
            ...(e.charStart !== undefined ? { charStart: e.charStart } : {}),
            ...(e.charEnd !== undefined ? { charEnd: e.charEnd } : {}),
            ...(e.checkCode !== undefined ? { checkCode: e.checkCode } : {}),
            ...(e.passed !== undefined ? { passed: e.passed } : {}),
            ...(e.detail !== undefined ? { detail: e.detail as unknown as Prisma.InputJsonValue } : {}),
            // Neo vị-trí CHỈ trên SOURCE_SPAN và CHỈ khi định vị chắc chắn.
            ...(e.kind === 'SOURCE_SPAN' && anchor?.locator
              ? {
                  anchorKind: anchor.locator.kind,
                  anchorLocator: anchor.locator as unknown as Prisma.InputJsonValue,
                  ...(anchorCtx?.contentHash ? { anchorContentHash: anchorCtx.contentHash } : {}),
                }
              : {}),
          })),
        },
      },
    })
  }
  return { records: items.length, sourceDocumentId: source.id, anchored }
}

/**
 * Đường cũ chỉ-mục-tiêu. Giữ lại vì seed dùng, và vì gọi tên đúng việc vẫn tốt hơn bắt mọi chỗ khai
 * một object rỗng cho phần nó không có.
 */
export async function writeObjectiveTraces(
  frameworkVersionId: string,
  objectives: readonly CompiledObjective[],
  sourceText: string,
  anchorCtx?: AnchorContext,
): Promise<WriteTraceResult> {
  return writeClaimTraces(frameworkVersionId, { objectives }, sourceText, anchorCtx)
}

// ─────────────────────────────────────────────────────────────────────────────
// ĐÓNG ĐIỂM MÙ TRIGRAM — dedupeConcepts tự gộp hai khái niệm khi tên GẦN GIỐNG (ngưỡng 0.72),
// KHÔNG người, KHÔNG cấu trúc, và trước đây KHÔNG để lại vết. Một walk "sao hai cái này là một?"
// rơi vào hư không. Nay mỗi lần gộp phát một thẻ CONCEPT_IDENTITY — gắn rõ TRIGRAM/AI_INFERRED,
// verdict PENDING (chờ người duyệt). KHÔNG có bằng chứng cấu trúc: đó chính là điểm cần cảnh báo.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConceptIdentityTraceInput {
  readonly artifact: 'CONCEPT_IDENTITY'
  readonly subjectSlug: string
  readonly claim: { readonly vi: string; readonly en: string }
  readonly reason: { readonly vi: string; readonly en: string }
  readonly method: 'TRIGRAM'
  readonly basis: 'AI_INFERRED'
}

export function buildConceptIdentityTrace(m: Merge): ConceptIdentityTraceInput {
  const pct = Math.round(m.similarity * 100)
  return {
    artifact: 'CONCEPT_IDENTITY',
    // Gắn vào KC SỐNG SÓT: hỏi "cái gì đã gộp vào đây?" thì tra theo slug này.
    subjectSlug: m.into,
    claim: {
      vi: `"${m.fromTitle}" được coi là CÙNG một kiến thức với "${m.intoTitle}".`,
      en: `"${m.fromTitle}" is treated as the SAME knowledge as "${m.intoTitle}".`,
    },
    reason: {
      vi: `Máy tự gộp vì hai tên GẦN GIỐNG nhau (giống ${pct}%) — KHÔNG phải kết luận cấu trúc, cần thầy/cô xác nhận đúng là một.`,
      en: `Auto-merged because the two names are NEARLY identical (${pct}% similar) — not a structural finding; a reviewer should confirm they really are one.`,
    },
    method: 'TRIGRAM',
    basis: 'AI_INFERRED',
  }
}

/**
 * Ghi thẻ CONCEPT_IDENTITY cho MỌI lần gộp trigram của một bản phát hành. Idempotent theo
 * frameworkVersionId. Không có evidence row (trigram không sinh SOURCE_SPAN/STRUCTURAL_CHECK) —
 * độ giống nằm trong `reason`; verdict để PENDING vì đây là thứ cần người duyệt nhất.
 */
export async function writeConceptIdentityTraces(
  frameworkVersionId: string,
  merges: readonly Merge[],
): Promise<number> {
  await db.decisionRecord.deleteMany({ where: { artifact: 'CONCEPT_IDENTITY', frameworkVersionId } })
  for (const m of merges) {
    const t = buildConceptIdentityTrace(m)
    await db.decisionRecord.create({
      data: {
        artifact: t.artifact,
        subjectSlug: t.subjectSlug,
        claim: t.claim as unknown as Prisma.InputJsonValue,
        reason: t.reason as unknown as Prisma.InputJsonValue,
        method: t.method,
        basis: t.basis,
        frameworkVersionId,
      },
    })
  }
  return merges.length
}

// ─────────────────────────────────────────────────────────────────────────────
// ĐỌC — trả về cho panel truy ngược. KIỂM LẠI SỐNG rồi ĐỐI CHIẾU bản đóng băng:
// nếu khác (đồ thị đã đổi sau lần duyệt) thì `drift=true` → UI hiện "cần duyệt lại"
// (đúng R5, cùng lớp vấn đề re-review nội dung ở commit cd717f7). KHÔNG âm thầm
// thay số cũ bằng số mới, cũng KHÔNG chỉ phát lại số cũ.
// ─────────────────────────────────────────────────────────────────────────────

export interface TraceSourceLane {
  readonly quote: string
  readonly chunkId?: string
  readonly excerpt: string
  readonly charStart?: number
  readonly charEnd?: number
  readonly verifiedAtWrite: boolean
  readonly verifiedNow: boolean
  /** NEO tài liệu: viewer lấy bytes qua `documentId`, mở đúng `locator.page` + tô `locator.rects`. */
  readonly documentId?: string
  readonly pageCount?: number
  readonly locator?: SourceLocator
}

export interface TraceStructuralLane {
  readonly checkCode: string
  readonly passedAtWrite: boolean
  readonly passedNow: boolean
  /**
   * Hôm nay có kiểm lại được thật không.
   *
   * Trước đây một mã kiểm không nhận ra sẽ ĐỘI LẠI giá trị đóng băng vào `passedNow`, và giao diện
   * vẽ nó y như một lần kiểm vừa chạy xong. Lúc chỉ một trong sáu mã có đường chạy thì không ai
   * thấy; mở cả bốn loại thẻ ra thì nó thành lời nói dối mặc định. Có cờ này thì tấm thẻ nói được
   * "đây là kết quả lúc duyệt, hôm nay chưa kiểm lại" thay vì giả vờ đã kiểm.
   */
  readonly liveChecked: boolean
  readonly detail?: unknown
}

export type TraceArtifact = 'OBJECTIVE_EXISTS' | 'CONCEPT_EXISTS' | 'PREREQ_EDGE' | 'OBJECTIVE_COVERAGE'

export interface DecisionTraceView {
  readonly id: string
  readonly artifact: TraceArtifact
  readonly subjectSlug: string
  readonly objectSlug: string | null
  readonly relType: string | null
  readonly claim: unknown
  /** Câu AI tự lý giải — LUÔN là phán đoán, không phải bằng chứng. Chỉ hiện khi có. */
  readonly reason: unknown | null
  readonly method: string
  readonly basis: EvidenceBasis
  readonly verdict: string
  readonly overridden: boolean
  readonly decidedAt: string | null
  readonly createdAt: string
  /**
   * Còn bao nhiêu bản CŨ cho cùng một chỗ.
   *
   * Nhập lại khung lần nữa sinh thế hệ thẻ mới. Bản mới nhất thắng, nhưng giấu hẳn số bản cũ thì
   * người đọc không biết tấm thẻ trước mắt là bản thứ mấy.
   */
  readonly supersededCount: number
  readonly source: TraceSourceLane | null
  readonly structural: readonly TraceStructuralLane[]
  readonly drift: boolean
}

/** Giữ tên cũ cho chỗ đang dùng — cùng một hình dạng, chỉ hẹp hơn. */
export type ObjectiveTraceView = DecisionTraceView

/**
 * Ảnh chụp đồ thị ĐANG CÓ, đủ để kiểm lại mọi mã kiểm trong bộ nhớ.
 *
 * Bản cũ hỏi cơ sở dữ liệu một lần cho MỖI thẻ. Với 30 thẻ phủ của một mục tiêu là hơn 60 lượt đi
 * về cho một lần mở panel. Nạp một lần rồi tính trong bộ nhớ.
 */
interface LiveGraph {
  readonly idBySlug: ReadonlyMap<string, string>
  readonly facetsBySlug: ReadonlyMap<string, Record<string, unknown>>
  readonly mapsToCount: ReadonlyMap<string, number>
  readonly edgeKeys: ReadonlySet<string>
}

async function loadLiveGraph(slugs: readonly string[]): Promise<LiveGraph> {
  const comps = slugs.length
    ? await db.competency.findMany({
        where: { slug: { in: [...new Set(slugs)] } },
        select: { id: true, slug: true, facets: true },
      })
    : []
  const idBySlug = new Map(comps.map((c) => [c.slug, c.id]))
  const facetsBySlug = new Map(comps.map((c) => [c.slug, (c.facets ?? {}) as Record<string, unknown>]))
  const ids = comps.map((c) => c.id)
  const rels = ids.length
    ? await db.capabilityRelation.findMany({
        where: { fromId: { in: ids } },
        select: { fromId: true, toId: true, relType: true },
      })
    : []
  const slugById = new Map(comps.map((c) => [c.id, c.slug]))
  const mapsToCount = new Map<string, number>()
  const edgeKeys = new Set<string>()
  for (const r of rels) {
    const from = slugById.get(r.fromId)
    const to = slugById.get(r.toId)
    if (from === undefined) continue
    if (r.relType === 'MAPS_TO') mapsToCount.set(from, (mapsToCount.get(from) ?? 0) + 1)
    if (to !== undefined) edgeKeys.add(`${from}|${to}|${r.relType}`)
  }
  return { idBySlug, facetsBySlug, mapsToCount, edgeKeys }
}

/**
 * Kiểm lại MỘT mã kiểm trên đồ thị đang có. `undefined` = không kiểm lại được.
 *
 * Trả `undefined` chứ không trả `false`: "không kiểm được" và "kiểm rồi, trượt" là hai chuyện khác
 * hẳn, và gộp chúng làm một là dựng ra một lời cảnh báo không có thật.
 */
export function recheck(
  code: string,
  rec: { readonly subjectSlug: string; readonly objectSlug: string | null; readonly relType: string | null },
  live: LiveGraph,
): boolean | undefined {
  switch (code) {
    // I5: mục tiêu phải đo bằng ít nhất một kiến thức.
    case CHECK_COVERAGE:
      return live.idBySlug.has(rec.subjectSlug) ? (live.mapsToCount.get(rec.subjectSlug) ?? 0) >= 1 : false
    // I1: kiến thức phải nói rõ nó nói VỀ CÁI GÌ, không thì không tách khỏi cái bên cạnh được.
    case CHECK_DISCRIMINATING: {
      const f = live.facetsBySlug.get(rec.subjectSlug)
      if (f === undefined) return false
      return typeof f.object === 'string' && f.object.length > 0
    }
    // I4: cạnh đo phải còn đó và còn đúng kiểu.
    case CHECK_REQUIRED_ALL:
      return rec.objectSlug === null
        ? undefined
        : live.edgeKeys.has(`${rec.subjectSlug}|${rec.objectSlug}|MAPS_TO`)
    /**
     * Thứ tự: chạy lại engine giải thích trên dấu hiệu ĐANG CÓ, không phát lại kết luận cũ.
     *
     * Cả ba mã cùng một câu hỏi — "máy CHỨNG được thứ tự này chưa" — vì chỗ ghi lưu `passed: proven`
     * cho cả ba. Đọc mã `order:judgment` thành "có đúng là phán đoán không" là đảo nghĩa, và hậu quả
     * không nhẹ: mọi cạnh phán đoán lập tức báo lệch, tức là màn hình giục người duyệt xem lại
     * đúng những cạnh không hề đổi gì.
     */
    case CHECK_ORDER_PROVEN:
    case CHECK_ORDER_REVERSED:
    case CHECK_ORDER_JUDGMENT: {
      if (rec.objectSlug === null) return undefined
      const from = live.facetsBySlug.get(rec.subjectSlug)
      const to = live.facetsBySlug.get(rec.objectSlug)
      if (from === undefined || to === undefined) return false
      const ex = explainClaim({
        claimKind: 'ORDERING_EDGE',
        relType: rec.relType ?? 'PREREQUISITE',
        fromFacets: from,
        toFacets: to,
      })
      return ex.relation?.basis === 'ordering-proven'
    }
    /**
     * Thứ tự đọc KHÔNG kiểm lại được ở đây.
     *
     * Nó phụ thuộc đoạn nguồn lúc trích, mà đoạn đó đã đóng băng cùng thẻ. Trả `undefined` để tấm
     * thẻ nói thẳng "đây là kết quả lúc duyệt" — chứ không phát lại giá trị cũ như một lần kiểm mới.
     */
    case CHECK_READING_ORDER:
      return undefined
    default:
      return undefined
  }
}

/**
 * Gom thẻ theo CHỖ nó nói về, bản mới nhất thắng, đếm số bản cũ.
 *
 * Thuần, tách ra để kiểm được mà không cần cơ sở dữ liệu.
 */
export function newestPerSubject<
  T extends { subjectSlug: string; objectSlug: string | null; relType: string | null; createdAt: Date },
>(rows: readonly T[]): { readonly row: T; readonly supersededCount: number }[] {
  const groups = new Map<string, T[]>()
  for (const r of rows) {
    const k = `${r.subjectSlug}|${r.objectSlug ?? ''}|${r.relType ?? ''}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  return [...groups.values()].map((g) => {
    const sorted = [...g].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return { row: sorted[0] as T, supersededCount: sorted.length - 1 }
  })
}

/**
 * ĐỌC thẻ căn cứ cho MỘT chỗ bất kỳ — bốn loại đi chung một đường.
 *
 * Trước file này chỉ có `getObjectiveTrace`, viết cứng `artifact: 'OBJECTIVE_EXISTS'`. Ba loại còn
 * lại vẫn được ghi đầy đủ mỗi lần duyệt và không đường nào đọc ra: vì sao kiến thức này có mặt, vì
 * sao học cái này trước cái kia, vì sao mục tiêu cần đúng những mảnh đó. Đúng ba câu hỏi mà cả hệ
 * được dựng lên để trả lời.
 *
 * Trả về DANH SÁCH chứ không một thẻ: một quan hệ có thể có nhiều thẻ (mỗi cặp mục-tiêu↔kiến-thức
 * một thẻ), và "chưa có thẻ nào" là trạng thái bình thường của người duyệt, không phải lỗi.
 */
export async function getDecisionTraces(q: {
  readonly artifact: TraceArtifact
  readonly subjectSlug: string
  readonly objectSlug?: string
}): Promise<DecisionTraceView[]> {
  const rows = await db.decisionRecord.findMany({
    where: {
      artifact: q.artifact,
      subjectSlug: q.subjectSlug,
      ...(q.objectSlug !== undefined ? { objectSlug: q.objectSlug } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { evidence: true },
  })
  if (rows.length === 0) return []

  const picked = newestPerSubject(rows)

  // Nạp MỘT lần cho cả lô: tài liệu nguồn và ảnh chụp đồ thị.
  const docIds = [...new Set(picked.map((p) => p.row.sourceDocumentId).filter((x): x is string => !!x))]
  const docs = docIds.length ? await db.sourceDocument.findMany({ where: { id: { in: docIds } } }) : []
  const docById = new Map(docs.map((d) => [d.id, d]))
  const live = await loadLiveGraph(
    picked.flatMap((p) => [p.row.subjectSlug, p.row.objectSlug].filter((x): x is string => !!x)),
  )

  return picked.map(({ row: rec, supersededCount }) => {
    const doc = rec.sourceDocumentId ? docById.get(rec.sourceDocumentId) : undefined

    // Làn NGUỒN — kiểm lại byte-for-byte vào chính đoạn đã lưu, không tin cờ đã lưu.
    const span = rec.evidence.find((e) => e.kind === 'SOURCE_SPAN')
    let source: TraceSourceLane | null = null
    if (span?.quote !== undefined && span.quote !== null && doc) {
      const m = verifyQuote(span.quote, doc.excerptText)
      source = {
        quote: span.quote,
        ...(span.chunkId ? { chunkId: span.chunkId } : {}),
        excerpt: doc.excerptText,
        ...(span.charStart != null ? { charStart: span.charStart } : {}),
        ...(span.charEnd != null ? { charEnd: span.charEnd } : {}),
        verifiedAtWrite: span.quoteVerified ?? false,
        verifiedNow: m.status === 'verified',
        documentId: doc.id,
        ...(doc.pageCount != null ? { pageCount: doc.pageCount } : {}),
        // Neo chỉ dùng khi tài liệu KHÔNG đổi kể từ lúc tính — không thì vệt tô cũ có thể lệch dòng.
        ...(span.anchorLocator && span.anchorContentHash === doc.contentHash
          ? { locator: span.anchorLocator as unknown as SourceLocator }
          : {}),
      }
    }

    const structural: TraceStructuralLane[] = rec.evidence
      .filter((e) => e.kind === 'STRUCTURAL_CHECK')
      .map((e) => {
        const code = e.checkCode ?? ''
        const now = recheck(code, rec, live)
        return {
          checkCode: code,
          passedAtWrite: e.passed ?? false,
          passedNow: now ?? e.passed ?? false,
          liveChecked: now !== undefined,
          ...(e.detail != null ? { detail: e.detail } : {}),
        }
      })

    // Lệch chỉ tính trên thứ HÔM NAY kiểm lại được. Làn không kiểm được thì không có gì để so.
    const drift =
      (source !== null && source.verifiedNow !== source.verifiedAtWrite) ||
      structural.some((s) => s.liveChecked && s.passedNow !== s.passedAtWrite)

    return {
      id: rec.id,
      artifact: rec.artifact as TraceArtifact,
      subjectSlug: rec.subjectSlug,
      objectSlug: rec.objectSlug,
      relType: rec.relType,
      claim: rec.claim,
      reason: rec.reason ?? null,
      method: rec.method,
      basis: rec.basis as EvidenceBasis,
      verdict: rec.verdict,
      overridden: rec.overridden,
      decidedAt: rec.decidedAt ? rec.decidedAt.toISOString() : null,
      createdAt: rec.createdAt.toISOString(),
      supersededCount,
      source,
      structural,
      drift,
    }
  })
}

/** Đường cũ, giữ nguyên chữ ký cho chỗ đang gọi. */
export async function getObjectiveTrace(slug: string): Promise<ObjectiveTraceView | null> {
  const [first] = await getDecisionTraces({ artifact: 'OBJECTIVE_EXISTS', subjectSlug: slug })
  return first ?? null
}
