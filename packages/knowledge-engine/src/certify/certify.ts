/** certifyFramework — đạt chuẩn theo objective. SPEC §12. */

import type { Slug } from '../contracts'
import type { EnginePolicy } from '../policy'
import { REPORTING_UNSEEN_PRIOR } from '../policy'
import type { SkillGraph } from '../graph/build'
import { nodeMastery, type MasteryStates } from '../graph/composite'

export interface CertifyObjective {
  readonly slug: Slug
}

export interface ObjectiveResult {
  readonly slug: Slug
  readonly mastery: number
  readonly passed: boolean
}

export interface CertifyReport {
  readonly objectives: readonly ObjectiveResult[]
  readonly total: number
  readonly passedCount: number
  readonly percent: number
  readonly passed: boolean
}

export interface CertifyOpts {
  readonly cut?: number
  readonly passRatio?: number
}

/**
 * SPEC §12. Trên `measured` (chỉ MEASURE, đúng lang; unseenPrior 0 — nhánh báo cáo):
 * mỗi objective mastery = max(effectiveMastery qua MAPS_TO, direct pKnown nếu đề chấm thẳng);
 * passed = mastery ≥ cut. percent = round(#passed/total·100); passed = #passed/total ≥ passRatio.
 */
export function certifyFramework(
  graph: SkillGraph,
  measured: MasteryStates,
  objectives: readonly CertifyObjective[],
  policy: EnginePolicy,
  opts: CertifyOpts = {},
): CertifyReport {
  const cut = opts.cut ?? policy.certify.cut
  const passRatio = opts.passRatio ?? policy.certify.passRatio

  const results: ObjectiveResult[] = objectives.map((obj) => {
    const r = nodeMastery(graph, measured, obj.slug, cut, { unseenPrior: REPORTING_UNSEEN_PRIOR })
    return { slug: obj.slug, mastery: r.pKnown, passed: r.achieved }
  })

  const total = results.length
  const passedCount = results.filter((r) => r.passed).length
  return {
    objectives: results,
    total,
    passedCount,
    percent: total > 0 ? Math.round((passedCount / total) * 100) : 0,
    passed: total > 0 && passedCount / total >= passRatio,
  }
}
