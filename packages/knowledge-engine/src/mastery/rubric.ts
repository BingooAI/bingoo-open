/** Chấm rubric → outcome + confidence. SPEC §5. */

import type { RubricCriterion } from '../contracts'
import { clamp01 } from './math'

export interface RubricScore {
  readonly outcome: number
  readonly confidence: number
}

/**
 * SPEC §5.
 * outcome    = Σ clamp01(score/max)·weight / Σ weight  (chỉ tiêu chí max>0)
 * confidence = min(1, 0.5 + 0.1·|valid|)
 * Không tiêu chí hợp lệ → {0, 0}.
 */
export function scoreRubric(criteria: readonly RubricCriterion[]): RubricScore {
  const valid = criteria.filter((c) => c.max > 0)
  if (valid.length === 0) return { outcome: 0, confidence: 0 }

  let weighted = 0
  let weightSum = 0
  for (const c of valid) {
    const w = c.weight ?? 1
    weighted += clamp01(c.score / c.max) * w
    weightSum += w
  }
  const outcome = weightSum > 0 ? weighted / weightSum : 0
  const confidence = Math.min(1, 0.5 + 0.1 * valid.length)
  return { outcome, confidence }
}
