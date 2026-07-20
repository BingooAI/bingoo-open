/**
 * Đường cong quên → độ khẩn ôn tập. SPEC §8.1.
 *
 * Đặt ở lõi mastery (thuần, chỉ phụ thuộc mastery + thời gian + ReviewParams) để golden
 * C.3 kiểm được ngay ở M1. Sequencer (M4) tái dùng cho dueForReview.
 */

import type { Millis } from '../contracts';
import type { ReviewParams } from '../policy';
import { DAY_MS, LN2 } from './math';

/**
 * SPEC §8.1. halfLife ~1 ngày khi non → ~1 tháng khi vững.
 * lastSeenMs null → 0 (chưa từng gặp, không có gì để "quên").
 */
export function reviewUrgency(
  mastery: number,
  lastSeenMs: Millis | null,
  nowMs: Millis,
  p: ReviewParams,
): number {
  if (lastSeenMs == null) return 0;
  const days = Math.max(0, (nowMs - lastSeenMs) / DAY_MS);
  const halfLifeDays = p.halfLifeBase + mastery * p.halfLifeSlope;
  const retention = Math.exp((-days / halfLifeDays) * LN2);
  return 1 - retention;
}
