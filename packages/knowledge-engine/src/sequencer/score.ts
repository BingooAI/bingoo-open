// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Chấm điểm ứng viên & tính đủ điều kiện. SPEC §8.2. */

import type { Candidate, Elo, Slug } from '../contracts'
import type { SequencingParams } from '../policy'
import type { SkillMastery } from '../mastery/observe'

export type AbilityOf = (slug: Slug) => Elo

/** ability người học trên một kỹ năng; chưa có state → base Elo. */
export function abilityFromStates(states: ReadonlyMap<Slug, SkillMastery>, base: Elo): AbilityOf {
  return (slug) => states.get(slug)?.ability ?? base
}

/** SPEC §8.2 — "luyện tập không dạy mới": bài đã bắt đầu, HOẶC mọi skill đã gặp. */
export function isEligible(
  cand: Candidate,
  started: ReadonlySet<Slug>,
  encountered: ReadonlySet<Slug>,
): boolean {
  if (cand.lessonSlug !== undefined && started.has(cand.lessonSlug)) return true
  return cand.skills.every((s) => encountered.has(s))
}

/**
 * SPEC §8.2. best = max qua các skill: priority × (floor + (1−floor)·match), match theo
 * khoảng cách |ability − difficulty| / window. Bài đã dạy → ×startedBonus.
 */
export function scoreItem(
  cand: Candidate,
  priority: ReadonlyMap<Slug, number>,
  abilityOf: AbilityOf,
  started: ReadonlySet<Slug>,
  seq: SequencingParams,
): number {
  let best = 0
  for (const t of cand.skills) {
    const pr = priority.get(t)
    if (pr == null) continue
    const match = 1 - Math.min(1, Math.abs(abilityOf(t) - cand.difficulty) / seq.matchWindow)
    best = Math.max(best, pr * (seq.matchFloor + (1 - seq.matchFloor) * match))
  }
  if (cand.lessonSlug !== undefined && started.has(cand.lessonSlug)) best *= seq.startedBonus
  return best
}
