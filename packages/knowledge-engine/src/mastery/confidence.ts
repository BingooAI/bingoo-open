/** Quy đổi độ tin cậy → trọng số. SPEC §5.1. */

import type { ConfidenceParams } from '../policy';
import { clamp01 } from './math';

export interface ConfidenceInput {
  /** Trọng số người chấm (rater model, BỔ SUNG §3.2); mặc định 1. */
  readonly rater?: number;
  readonly latencyMs?: number;
  readonly expectedMs?: number;
  readonly hintsUsed?: number;
}

/**
 * SPEC §5.1.
 * w = rater; nếu latency/expected > ngưỡng → w·=factor; nếu có gợi ý → w·=max(floor, 1−per·h).
 */
export function interpolateConfidence(input: ConfidenceInput, p: ConfidenceParams): number {
  let w = input.rater ?? 1;

  if (
    input.latencyMs != null &&
    input.expectedMs != null &&
    input.expectedMs > 0 &&
    input.latencyMs / input.expectedMs > p.latencyRatioPenaltyAt
  ) {
    w *= p.latencyPenaltyFactor;
  }

  if (input.hintsUsed != null && input.hintsUsed > 0) {
    w *= Math.max(p.hintPenaltyFloor, 1 - p.hintPenaltyPer * input.hintsUsed);
  }

  return clamp01(w);
}
