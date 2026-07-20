/** supporterView — mặt đọc của người hỗ trợ (phụ huynh/trợ giảng). BỔ SUNG §3.4. */

import type { Millis, SkillSnapshot, Slug } from '../contracts'
import type { EnginePolicy } from '../policy'
import { REPORTING_UNSEEN_PRIOR } from '../policy'
import type { SkillGraph } from '../graph/build'
import { aggregate, nodeMastery } from '../graph/composite'
import type { SkillMastery } from '../mastery/observe'
import { dueForReview, type DueItem } from '../sequencer/review'
import { learningCurve, type CurvePoint } from './curve'

export interface SupporterViewInput {
  readonly graph: SkillGraph
  readonly states: ReadonlyMap<Slug, SkillMastery>
  /** Năng lực báo cáo trung thực cho người hỗ trợ. */
  readonly targets: readonly Slug[]
  readonly relevant: Iterable<Slug>
  readonly encountered: ReadonlySet<Slug>
  readonly nowMs: Millis
  readonly snapshots?: readonly SkillSnapshot[]
}

export interface HonestItem {
  readonly slug: Slug
  readonly pKnown: number
  readonly achieved: boolean
}

export interface HonestRollup {
  readonly items: readonly HonestItem[]
  readonly pKnown: number
  readonly percent: number
}

export interface SupporterView {
  readonly honestRollup: HonestRollup
  readonly curve: Map<Slug, CurvePoint[]>
  readonly reviewNudges: DueItem[]
}

/**
 * Rollup TRUNG THỰC (unseenPrior 0 — chưa có bằng chứng đọc là 0, không "ảo") + đường cong
 * + nhắc ôn. Đây là nhánh báo cáo, khác nhánh sequencing (prior 0.25).
 */
export function supporterView(input: SupporterViewInput, policy: EnginePolicy): SupporterView {
  const threshold = policy.mastery.threshold
  const items: HonestItem[] = input.targets.map((slug) => {
    const r = nodeMastery(input.graph, input.states, slug, threshold, {
      unseenPrior: REPORTING_UNSEEN_PRIOR,
    })
    return { slug, pKnown: r.pKnown, achieved: r.achieved }
  })
  const rolled = aggregate(items.map((i) => ({ pKnown: i.pKnown, achieved: i.achieved })))

  return {
    honestRollup: { items, pKnown: rolled.pKnown, percent: rolled.percent },
    curve: learningCurve(input.snapshots ?? []),
    reviewNudges: dueForReview(
      input.graph,
      input.states,
      input.relevant,
      input.encountered,
      input.nowMs,
      policy,
    ),
  }
}
