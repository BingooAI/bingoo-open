// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Đường cong quên → độ khẩn ôn tập. SPEC §8.1.
 *
 * Đặt ở lõi mastery (thuần, chỉ phụ thuộc mastery + thời gian + ReviewParams) để golden
 * C.3 kiểm được ngay ở M1. Sequencer (M4) tái dùng cho dueForReview.
 */

import type { CompetencyKind } from '../domain'
import type { Millis } from '../contracts'
import type { ReviewParams } from '../policy'
import { DAY_MS, LN2 } from './math'

/**
 * Nửa đời (ngày) áp cho một loại năng lực.
 *
 * Không truyền `kind`, hoặc loại đó không được khai riêng, thì rơi về cặp tham số chung — nên
 * mọi đường gọi cũ giữ nguyên kết quả tới từng chữ số.
 */
export function halfLifeDays(mastery: number, p: ReviewParams, kind?: CompetencyKind): number {
  const hl = kind === undefined ? undefined : p.halfLifeByKind?.[kind]
  const base = hl?.base ?? p.halfLifeBase
  const slope = hl?.slope ?? p.halfLifeSlope
  return base + mastery * slope
}

/**
 * SPEC §8.1. halfLife ~1 ngày khi non → ~1 tháng khi vững (với loại mặc định).
 * lastSeenMs null → 0 (chưa từng gặp, không có gì để "quên").
 *
 * `kind` tuỳ chọn: có thì tra nửa đời riêng của loại đó, không có thì y hệt hành vi cũ. Để
 * tuỳ chọn thay vì bắt buộc là có chủ ý — người gọi nào không biết loại năng lực thì thà
 * dùng đường chung còn hơn phải bịa ra một `kind` để hàm chịu biên dịch.
 */
export function reviewUrgency(
  mastery: number,
  lastSeenMs: Millis | null,
  nowMs: Millis,
  p: ReviewParams,
  kind?: CompetencyKind,
): number {
  if (lastSeenMs == null) return 0
  const days = Math.max(0, (nowMs - lastSeenMs) / DAY_MS)
  const retention = Math.exp((-days / halfLifeDays(mastery, p, kind)) * LN2)
  return 1 - retention
}
