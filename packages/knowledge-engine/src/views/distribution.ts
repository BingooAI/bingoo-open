/** classRollup — phân phối mức nắm nhiều học viên. BỔ SUNG §3.4. */

import type { Slug } from '../contracts'
import type { EnginePolicy } from '../policy'
import { REPORTING_UNSEEN_PRIOR } from '../policy'
import type { SkillGraph } from '../graph/build'
import { nodeMastery, type MasteryStates } from '../graph/composite'

export interface Distribution {
  readonly count: number
  readonly mean: number
  readonly median: number
  readonly q1: number
  readonly q3: number
  readonly min: number
  readonly max: number
  readonly percentAchieved: number
}

/** Phân vị nội suy tuyến tính trên mảng ĐÃ sắp tăng. */
export function quantile(sorted: readonly number[], q: number): number {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0] as number
  const pos = (n - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  const vlo = sorted[lo] as number
  if (lo === hi) return vlo
  const vhi = sorted[hi] as number
  return vlo + (pos - lo) * (vhi - vlo)
}

export function distribution(values: readonly number[], threshold: number): Distribution {
  const n = values.length
  if (n === 0) {
    return { count: 0, mean: 0, median: 0, q1: 0, q3: 0, min: 0, max: 0, percentAchieved: 0 }
  }
  const sorted = [...values].sort((a, b) => a - b)
  let sum = 0
  let achieved = 0
  for (const v of values) {
    sum += v
    if (v >= threshold) achieved++
  }
  return {
    count: n,
    mean: sum / n,
    median: quantile(sorted, 0.5),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    min: sorted[0] as number,
    max: sorted[n - 1] as number,
    percentAchieved: Math.round((achieved / n) * 100),
  }
}

/**
 * BỔ SUNG §3.4 — gộp mastery per-competency trên tập học viên (nhánh báo cáo, unseenPrior 0).
 * Học viên chưa có bằng chứng → 0 (không "ảo" tiến bộ trước phụ huynh/giáo viên).
 */
export function classRollup(
  graph: SkillGraph,
  statesByLearner: ReadonlyMap<string, MasteryStates>,
  competencies: readonly Slug[],
  policy: EnginePolicy,
): Map<Slug, Distribution> {
  const out = new Map<Slug, Distribution>()
  for (const slug of competencies) {
    const values: number[] = []
    for (const states of statesByLearner.values()) {
      values.push(
        nodeMastery(graph, states, slug, policy.mastery.threshold, {
          unseenPrior: REPORTING_UNSEEN_PRIOR,
        }).pKnown,
      )
    }
    out.set(slug, distribution(values, policy.mastery.threshold))
  }
  return out
}
