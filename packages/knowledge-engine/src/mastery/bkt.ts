/** BKT — Bayesian Knowledge Tracing. SPEC §3.2. */

import type { BktParams } from '../policy';
import { clamp01 } from './math';

/**
 * Suy giảm P(L) theo thời gian (lãng quên). SPEC §3.2.
 * `elapsedDays` là số thực (cho phép ngày lẻ).
 */
export function bktForget(pL: number, elapsedDays: number, p: BktParams): number {
  if (elapsedDays <= 0 || p.pForgetPerDay <= 0) return clamp01(pL);
  const retain = (1 - p.pForgetPerDay) ** elapsedDays;
  return clamp01(pL * retain);
}

export interface BktUpdateOpts {
  readonly elapsedDays?: number;
  readonly weight?: number;
}

/**
 * Cập nhật P(L) sau một quan sát. SPEC §3.2.
 * Thứ tự BẮT BUỘC: lãng quên → Bayes → pha trọng số → chuyển tiếp học.
 */
export function bktUpdate(
  pL: number,
  correct: boolean,
  p: BktParams,
  opts: BktUpdateOpts = {},
): number {
  const elapsedDays = opts.elapsedDays ?? 0;
  const weight = opts.weight ?? 1;

  const prior = bktForget(pL, elapsedDays, p); // (1) LÃNG QUÊN trước

  // (2) Bayes
  let num: number;
  let den: number;
  if (correct) {
    num = prior * (1 - p.pSlip);
    den = num + (1 - prior) * p.pGuess;
  } else {
    num = prior * p.pSlip;
    den = num + (1 - prior) * (1 - p.pGuess);
  }
  const posterior = den > 0 ? num / den : prior;

  // (3) bằng chứng "mềm" theo trọng số
  const conditioned = prior + (posterior - prior) * clamp01(weight);

  // (4) chuyển tiếp HỌC sau cùng
  const learned = conditioned + (1 - conditioned) * p.pLearn;
  return clamp01(learned);
}
