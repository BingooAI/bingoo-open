// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * GIẢI THÍCH MỘT QUAN HỆ — vì sao X học trước Y, vì sao mục tiêu đo bằng kiến thức này.
 *
 * Thuần, tất định. Cốt lõi TRUNG THỰC: phân biệt rõ quan hệ nào MÁY CHỨNG ĐƯỢC (cùng đối tượng +
 * phạm vi nằm-gọn ⇒ thứ tự có căn cứ cấu trúc) với quan hệ nào chỉ là PHÁN ĐOÁN của người soạn/AI
 * (khác đối tượng / không so được phạm vi). KHÔNG bịa một lý do sư phạm nghe kêu — đó là điều làm
 * nó khác "AI kể chuyện".
 *
 * `basis` là MÃ; UI render câu {vi,en} từ mã (R4). Không câu chữ ở đây.
 */

import type { Facets } from '@bingoo.ai/facets'
import { compareScope } from './alignment'

const ORDERING = new Set(['PREREQUISITE', 'ENABLES', 'COMPOSES'])

export type RelationBasis =
  | 'ordering-proven' // cùng đối tượng + từ ⊂ tới → học phần nhỏ trước; MÁY chứng được
  | 'ordering-contradicted' // cùng đối tượng nhưng từ ⊃ tới → thứ tự có vẻ NGƯỢC, xem lại
  | 'ordering-judgment' // khác đối tượng / không so được phạm vi → phán đoán người soạn/AI
  | 'mapping' // mục tiêu ĐO bằng kiến thức này (MAPS_TO)
  | 'lateral' // ALIGNS / VARIANT_OF… — liên quan, không phải thứ tự học

export interface RelationExplanation {
  readonly relType: string
  readonly basis: RelationBasis
  /** Máy tự tính được thứ tự? (chỉ true khi ordering-proven) — để UI tô "chắc chắn" đúng chỗ. */
  readonly machineProven: boolean
  readonly sameObject: boolean
  readonly scope: 'equal' | 'subset' | 'superset' | 'incomparable'
}

/**
 * Cạnh `from → to` với `relType`. Với thứ tự (PREREQUISITE/ENABLES/COMPOSES): `from` học TRƯỚC `to`.
 * Với MAPS_TO: `from` = mục tiêu, `to` = kiến thức nó đo.
 */
export function explainRelation(
  fromFacets: Facets | undefined,
  toFacets: Facets | undefined,
  relType: string,
): RelationExplanation {
  const sameObject =
    fromFacets?.object !== undefined &&
    toFacets?.object !== undefined &&
    fromFacets.object === toFacets.object
  const scope = compareScope(fromFacets?.scope, toFacets?.scope)

  let basis: RelationBasis
  if (relType === 'MAPS_TO') basis = 'mapping'
  else if (!ORDERING.has(relType)) basis = 'lateral'
  else if (sameObject && scope === 'subset') basis = 'ordering-proven'
  else if (sameObject && scope === 'superset') basis = 'ordering-contradicted'
  else basis = 'ordering-judgment'

  return { relType, basis, machineProven: basis === 'ordering-proven', sameObject, scope }
}
