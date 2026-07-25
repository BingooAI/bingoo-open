// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * GIẢI THÍCH MỘT KHẲNG ĐỊNH — một hàm cho mọi mặt của hệ biên soạn.
 *
 * Mỗi mảnh trong đồ thị năng lực là một khẳng định do AI đưa ra: kiến thức này tồn tại, mục tiêu kia
 * gồm những kiến thức này, cái này học trước cái kia, hai kiến thức này là một, bài sách này dạy
 * kiến thức đó. Người duyệt phải hiểu VÌ SAO trước khi chốt — nên tất cả đi qua đúng một chỗ.
 *
 * Hàm này KHÔNG tự suy luận gì mới. Nó GHÉP bốn làn đã có, mỗi làn kiểm được độc lập:
 *
 *   NGUỒN     `verifyQuote`     — câu trích có nằm nguyên văn trong tài liệu không
 *   CẤU TRÚC  `explainRelation` — phạm vi/đối tượng có tự chứng được thứ tự hoặc định danh không
 *   TOẠ ĐỘ    `locateInUnits`   — câu đó ở đúng trang nào, dòng nào
 *   THỨ TỰ ĐỌC                  — tài liệu liệt kê cái nào trước
 *
 * `tier` là làn MẠNH NHẤT KIỂM ĐƯỢC. Vì sao phải là "kiểm được": nếu một tín hiệu chỉ do model nói
 * ra thì không có cách nào phản chứng, và một khẳng định không phản chứng được thì không phải bằng
 * chứng — dù nó kèm số 0.95. Các CAP dưới đây nằm trong lõi thuần, không phải trong UI, nên không
 * bật/tắt được từ chỗ khác:
 *
 *   • `proven` phải có ít nhất một làn kiểm được. Không bao giờ từ điểm giống mờ hay từ mình model.
 *   • Thứ tự đọc tài liệu là thứ tự YÊU CẦU, không phải thứ tự dạy đã kiểm → không bao giờ vượt
 *     `reading-order-corroborated`, và tô như phán đoán.
 *   • Điểm giống MỜ (trigram/cosine) hiện ra được nhưng KHÔNG tham gia tính `tier` — chút nào.
 *   • `contradicted` là một CÂU HỎI, không phải khẳng định: hàm này chỉ báo, không sửa gì cả.
 *
 * `basis` là thứ UI tô màu theo, và nó khoá theo XUẤT XỨ đầu vào chứ không chỉ theo bước suy luận:
 * một thứ tự chứng bằng phạm vi mà phạm vi đó do AI gán và chưa ai kiểm thì vẫn tô như phán đoán —
 * bước suy luận đúng không cứu được đầu vào chưa kiểm.
 *
 * Mọi lý do là MÃ, không phải câu chữ: UI dựng câu {vi,en} từ mã (R4).
 */

import { compareIdentity, type DomainProfile, type Facets } from '@bingoo.ai/facets'
import { compareScope } from './alignment'
import { locateInUnits, type Anchor, type PositionedUnit } from './anchor'
import { verifyQuote, type QuoteMatch } from './quote'
import { explainRelation, type RelationExplanation } from './relation-explain'

/** Loại khẳng định. Thêm một mặt mới = thêm một mã ở đây, KHÔNG phải viết engine mới. */
export type ClaimKind =
  | 'CONCEPT_EXISTS' // kiến thức/kỹ năng này có trong tài liệu
  | 'OBJECTIVE_EXISTS' // mục tiêu này có trong tài liệu
  | 'OBJECTIVE_COVERAGE' // mục tiêu gồm những kiến thức nào
  | 'ORDERING_EDGE' // cái này học trước cái kia
  | 'CONCEPT_IDENTITY' // hai kiến thức là một, hay khác nhau
  | 'LESSON_MAPPING' // bài trong sách dạy kiến thức nào
  | 'KC_PROPOSED' // kiến thức MỚI phát hiện từ sách, chưa có trong khung

/**
 * Bậc — làn mạnh nhất KIỂM ĐƯỢC. Thứ tự trong union này chính là thứ tự mạnh yếu.
 */
export type ClaimTier =
  | 'proven' // cấu trúc tự chứng: phạm vi bao nhau / trục định danh trùng
  | 'quote-verified' // câu trích khớp nguyên văn trong tài liệu
  | 'reading-order-corroborated' // tài liệu liệt kê theo đúng chiều này (KHÔNG bao giờ mạnh hơn)
  | 'contradicted' // có dấu hiệu NGƯỢC — cần người xem, không phải kết luận
  | 'ai-judgment' // chỉ còn phán đoán của AI

/** Cái UI tô màu theo. Khoá theo xuất xứ đầu vào, không chỉ theo bước suy luận. */
export type ClaimBasis = 'FROM_SOURCE' | 'STRUCTURAL' | 'AI_INFERRED'

/** Ai/cái gì làm dấy lên nghi vấn — để UI đặt câu đúng, vì hai nguồn này khác hẳn độ mạnh. */
export type ContradictedBy = 'structure' | 'reading-order'

/** Bảy trục facet, theo đúng thứ tự hiện cho người duyệt. */
const AXES = ['object', 'channel', 'bloom', 'scope', 'representation', 'transfer', 'fluency'] as const

export interface AxisAgreement {
  readonly axis: (typeof AXES)[number]
  readonly same: boolean
  /** Giá trị hai bên, đã chuỗi hoá để hiện thẳng. Vắng = phía đó không khai trục này. */
  readonly a?: string
  readonly b?: string
}

/**
 * So từng trục — đây là câu trả lời cho "vì sao trùng" và "vì sao khác", và cũng là thứ giải thích
 * được lúc máy BÍ: nếu không trục nào khác nhau thì máy không có cơ sở tách hai khái niệm (I1), và
 * người duyệt là người duy nhất chốt được. Một con số phần trăm không nói được điều đó.
 */
export interface FacetAgreement {
  readonly axes: readonly AxisAgreement[]
  readonly sameCount: number
  readonly comparedCount: number
  /** Cả hai đều khai, và KHÔNG trục nào khác → máy không phân biệt được. */
  readonly indistinguishable: boolean
  /** Quan hệ phạm vi, tách riêng vì nó là trục duy nhất suy ra được thứ tự. */
  readonly scope: 'equal' | 'subset' | 'superset' | 'incomparable'
}

/**
 * Điểm giống MỜ. Có mặt để HIỆN RA, không để quyết định.
 *
 * `trigram` so mặt chữ nên chỉ chạy trong cùng một ngôn ngữ; `cosine` so nghĩa nên qua được ranh
 * giới ngôn ngữ. Cả hai đều có thể sai cả hai chiều, nên chúng không được nâng bậc — người duyệt
 * thấy đúng con số và tự cân.
 */
export interface FuzzySimilarity {
  readonly trigram?: number
  readonly cosine?: number
}

export interface ClaimInput {
  readonly claimKind: ClaimKind
  /** Cạnh: PREREQUISITE | ENABLES | COMPOSES | MAPS_TO | ALIGNS… */
  readonly relType?: string
  readonly fromFacets?: Facets
  readonly toFacets?: Facets
  /** Câu người/AI bảo là trích từ tài liệu. */
  readonly quote?: string
  /** Văn bản nguồn để đối chiếu câu trích — chính đoạn SẼ được lưu, không phải bản khác. */
  readonly sourceExcerpt?: string
  /** Đơn vị có toạ độ (từ PDF) để neo trang/dòng. */
  readonly units?: readonly PositionedUnit[]
  /** Thứ tự đọc trong tài liệu của hai đầu. */
  readonly readingOrder?: { readonly fromOrder: number; readonly toOrder: number }
  readonly fuzzy?: FuzzySimilarity
  readonly profile?: DomainProfile
  /**
   * Đầu vào (facet/câu trích) đã được kiểm chưa. Mặc định COI LÀ CHƯA: một bước suy luận đúng trên
   * dữ liệu chưa kiểm thì kết quả vẫn chưa kiểm, và mặc định phải là phía an toàn.
   */
  readonly inputsVerified?: boolean
}

export interface ClaimExplanation {
  readonly claimKind: ClaimKind
  readonly tier: ClaimTier
  readonly basis: ClaimBasis
  /** CHỈ true khi cấu trúc tự chứng VÀ đầu vào đã kiểm. Đây là cái UI được phép gọi là "chắc". */
  readonly machineProven: boolean
  /** Bậc là `proven` nhưng đầu vào chưa kiểm → câu chữ phải nêu điều kiện, không nói "chắc chắn". */
  readonly provenanceCaveat: boolean
  readonly contradictedBy?: ContradictedBy
  readonly relation?: RelationExplanation
  readonly quote?: QuoteMatch
  readonly anchor?: Anchor
  readonly readingOrderAgrees?: boolean
  readonly facets?: FacetAgreement
  readonly fuzzy?: FuzzySimilarity
}

const str = (v: unknown): string | undefined =>
  v === undefined ? undefined : typeof v === 'string' ? v : JSON.stringify(v)

/** So từng trục facet. Trục chỉ một bên khai thì KHÔNG tính là "khác" — thiếu tin, không phải lệch. */
export function compareFacetAxes(a: Facets | undefined, b: Facets | undefined): FacetAgreement {
  const axes: AxisAgreement[] = []
  let sameCount = 0
  let comparedCount = 0
  const scope = compareScope(a?.scope, b?.scope)

  for (const axis of AXES) {
    const va = a?.[axis]
    const vb = b?.[axis]
    const sa = str(va)
    const sb = str(vb)
    if (sa === undefined || sb === undefined) {
      axes.push({
        axis,
        same: false,
        ...(sa !== undefined ? { a: sa } : {}),
        ...(sb !== undefined ? { b: sb } : {}),
      })
      continue
    }
    // `scope` là cấu trúc, không phải chuỗi: {max:20} và {max:100} khác nhau nhưng CÓ QUAN HỆ, và
    // so bằng chuỗi thì mất luôn quan hệ đó.
    const same = axis === 'scope' ? scope === 'equal' : sa === sb
    comparedCount += 1
    if (same) sameCount += 1
    axes.push({ axis, same, a: sa, b: sb })
  }

  return {
    axes,
    sameCount,
    comparedCount,
    indistinguishable: comparedCount > 0 && sameCount === comparedCount,
    scope,
  }
}

/**
 * Giải thích một khẳng định. Thuần, tất định, không I/O.
 *
 * Bậc được chọn theo làn mạnh nhất KIỂM ĐƯỢC, và các cap trung thực áp SAU cùng để không đường nào
 * lách qua được.
 */
export function explainClaim(input: ClaimInput): ClaimExplanation {
  const { claimKind, relType, fromFacets, toFacets, quote, sourceExcerpt, units, readingOrder } = input

  // ── Làn CẤU TRÚC ───────────────────────────────────────────────────────────────────────────────
  const relation = relType !== undefined ? explainRelation(fromFacets, toFacets, relType) : undefined
  const facets =
    fromFacets !== undefined || toFacets !== undefined ? compareFacetAxes(fromFacets, toFacets) : undefined

  // Định danh: chỉ tính cho khẳng định "hai cái này là một hay khác" — nơi duy nhất nó là kết luận.
  const identitySame =
    claimKind === 'CONCEPT_IDENTITY' && fromFacets && toFacets
      ? compareIdentity(fromFacets, toFacets, input.profile).verdict
      : undefined

  // ── Làn NGUỒN ──────────────────────────────────────────────────────────────────────────────────
  const quoteMatch =
    quote !== undefined && sourceExcerpt !== undefined ? verifyQuote(quote, sourceExcerpt) : undefined

  // ── Làn TOẠ ĐỘ ─────────────────────────────────────────────────────────────────────────────────
  // Chỉ neo khi câu trích đã khớp: neo một câu không có trong tài liệu thì chỉ tạo ra một mũi tên
  // trỏ vào chỗ trống, và người duyệt sẽ tin cái mũi tên đó.
  const anchor =
    quote !== undefined && units !== undefined && units.length > 0 && quoteMatch?.status === 'verified'
      ? locateInUnits(quote, units)
      : undefined

  // ── Làn THỨ TỰ ĐỌC ─────────────────────────────────────────────────────────────────────────────
  const readingOrderAgrees =
    readingOrder !== undefined && readingOrder.fromOrder !== readingOrder.toOrder
      ? readingOrder.fromOrder < readingOrder.toOrder
      : undefined

  // ── Chọn bậc: mạnh nhất KIỂM ĐƯỢC trước ────────────────────────────────────────────────────────
  let tier: ClaimTier = 'ai-judgment'
  let contradictedBy: ContradictedBy | undefined

  if (relation?.basis === 'ordering-contradicted') {
    tier = 'contradicted'
    contradictedBy = 'structure'
  } else if (relation?.basis === 'ordering-proven') {
    tier = 'proven'
  } else if (identitySame === 'SAME' || identitySame === 'DIFFERENT') {
    // Trục định danh kết luận được → cấu trúc chứng. `UNKNOWN` thì không, và đó là lúc cần người.
    tier = 'proven'
  } else if (quoteMatch?.status === 'verified') {
    tier = 'quote-verified'
  } else if (readingOrderAgrees === true) {
    tier = 'reading-order-corroborated'
  } else if (readingOrderAgrees === false) {
    tier = 'contradicted'
    contradictedBy = 'reading-order'
  }

  // ── CAP TRUNG THỰC (áp cuối, không lách được) ──────────────────────────────────────────────────
  const inputsVerified = input.inputsVerified === true

  // Cap: bậc `proven` phải có làn kiểm được. Ở đây nó luôn có (cấu trúc), nhưng nếu ĐẦU VÀO chưa
  // kiểm thì tô như phán đoán và câu chữ phải nêu điều kiện — bước đúng không cứu được đầu vào.
  const provenanceCaveat = tier === 'proven' && !inputsVerified

  const basis: ClaimBasis =
    tier === 'proven'
      ? inputsVerified
        ? 'STRUCTURAL'
        : 'AI_INFERRED'
      : tier === 'quote-verified'
        ? 'FROM_SOURCE'
        : // Thứ tự đọc, nói ngược, phán đoán — tất cả là phán đoán về mặt tô màu. Thứ tự đọc tài
          // liệu KHÔNG phải bằng chứng sư phạm, chỉ là cách người ta xếp trang.
          'AI_INFERRED'

  return {
    claimKind,
    tier,
    basis,
    machineProven: tier === 'proven' && inputsVerified,
    provenanceCaveat,
    ...(contradictedBy !== undefined ? { contradictedBy } : {}),
    ...(relation !== undefined ? { relation } : {}),
    ...(quoteMatch !== undefined ? { quote: quoteMatch } : {}),
    ...(anchor !== undefined ? { anchor } : {}),
    ...(readingOrderAgrees !== undefined ? { readingOrderAgrees } : {}),
    ...(facets !== undefined ? { facets } : {}),
    // Điểm mờ đi kèm để HIỆN, và ở trên nó không hề tham gia tính `tier`.
    ...(input.fuzzy !== undefined ? { fuzzy: input.fuzzy } : {}),
  }
}
