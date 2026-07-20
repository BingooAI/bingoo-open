/** Rater model — độ tin cậy theo người chấm. BỔ SUNG §3.2. */

import type { EvidenceActor } from '../domain';
import type { RaterProfile } from '../contracts';
import type { EnginePolicy } from '../policy';
import { clamp01, shrink } from '../mastery/math';

export interface RaterWeightParams {
  readonly raterBase: Readonly<Record<EvidenceActor, number>>;
  readonly shrinkK: number;
  readonly neutral: number;
}

/** Trích tham số rater từ policy (dùng chung SHRINK_K/NEUTRAL §4.1). */
export function raterWeightParams(policy: EnginePolicy): RaterWeightParams {
  return {
    raterBase: policy.evidence.raterBase,
    shrinkK: policy.dreyfus.shrinkK,
    neutral: policy.dreyfus.neutral,
  };
}

/**
 * BỔ SUNG §3.2. Hồ sơ null → trọng số cơ sở theo vai. Có hồ sơ → base × (0.5 + shrink(calibration)):
 * calibration tốt + nhiều lượt → tiến về base; ít dữ liệu → kéo về 0.5 (adj), tức về base.
 */
export function raterWeight(
  profile: RaterProfile | null,
  fallbackRole: EvidenceActor,
  params: RaterWeightParams,
): number {
  if (profile == null) return clamp01(params.raterBase[fallbackRole]);
  const base = params.raterBase[profile.role];
  const adj = shrink(profile.calibration, profile.volume, params.shrinkK, params.neutral);
  return clamp01(base * (0.5 + adj));
}
