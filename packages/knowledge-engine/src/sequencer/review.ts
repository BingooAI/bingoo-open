/** Danh sách đến hạn ôn. SPEC §8.5. */

import type { Millis, Slug } from '../contracts'
import type { EnginePolicy } from '../policy'
import type { SkillMastery } from '../mastery/observe'
import { reviewUrgency } from '../mastery/review-urgency'
import { compositeMastery } from '../graph/composite'
import type { SkillGraph } from '../graph/build'

export interface DueItem {
  readonly slug: Slug
  readonly urgency: number
}

/**
 * SPEC §8.5 — chỉ kỹ năng relevant ∩ encountered ĐÃ mastered (m ≥ threshold);
 * giữ urgency ≥ dueThreshold; sort urgency DESC.
 */
export function dueForReview(
  graph: SkillGraph,
  states: ReadonlyMap<Slug, SkillMastery>,
  relevant: Iterable<Slug>,
  encountered: ReadonlySet<Slug>,
  nowMs: Millis,
  policy: EnginePolicy,
): DueItem[] {
  const memo = new Map<Slug, number>()
  const out: DueItem[] = []
  for (const slug of relevant) {
    if (!encountered.has(slug)) continue
    const m = compositeMastery(graph, states, slug, { memo })
    if (m < policy.mastery.threshold) continue // chỉ ôn cái đã nắm
    const lastSeen = states.get(slug)?.lastSeenMs ?? null
    const urgency = reviewUrgency(m, lastSeen, nowMs, policy.review)
    if (urgency >= policy.review.dueThreshold) out.push({ slug, urgency })
  }
  return out.sort((a, b) => b.urgency - a.urgency)
}
