// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Ưu tiên ôn theo mức nắm + đường cong quên. SPEC §8.1. */

import type { Millis, Slug } from '../contracts'
import type { EnginePolicy } from '../policy'
import type { SkillMastery } from '../mastery/observe'
import { reviewUrgency } from '../mastery/review-urgency'
import { compositeMastery } from '../graph/composite'
import type { SkillGraph } from '../graph/build'

/**
 * SPEC §8.1 — chỉ slug ∈ relevant ∩ encountered.
 * yếu (m < threshold): priority = weakBase + (1 − m) ∈ (1, 2].
 * đã nắm: priority = masteredBase + reviewUrgency ∈ [0.3, 1.3], leo khi phai.
 * Dùng compositeMastery prior 0.25 (sequencing).
 */
export function buildPriority(
  graph: SkillGraph,
  states: ReadonlyMap<Slug, SkillMastery>,
  relevant: Iterable<Slug>,
  encountered: ReadonlySet<Slug>,
  nowMs: Millis,
  policy: EnginePolicy,
): Map<Slug, number> {
  const memo = new Map<Slug, number>()
  const out = new Map<Slug, number>()
  for (const slug of relevant) {
    if (!encountered.has(slug)) continue
    const m = compositeMastery(graph, states, slug, { memo })
    if (m < policy.mastery.threshold) {
      out.set(slug, policy.review.weakPriorityBase + (1 - m))
    } else {
      const lastSeen = states.get(slug)?.lastSeenMs ?? null
      const kind = graph.node(slug)?.kind
      out.set(
        slug,
        policy.review.masteredPriorityBase + reviewUrgency(m, lastSeen, nowMs, policy.review, kind),
      )
    }
  }
  return out
}
