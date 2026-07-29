// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Sắp trình tự thích ứng — SPEC §8. Một bộ chọn cho mọi chế độ (§8.6). */

export { fnv1a32, dayRank } from './hash'
export { abilityFromStates, isEligible, scoreItem, type AbilityOf } from './score'
export { buildPriority } from './priority'
export { dueForReview, type DueItem } from './review'
export {
  selectAdaptiveSession,
  selectAdaptiveSessionTraced,
  declumpByKind,
  type SessionContext,
  type SessionOpts,
  type TracedSession,
} from './session'
export { policyFingerprint, type ConsideredCandidate, type SelectionTrace } from './trace'
export { selectNextItem, type NextItemContext, type NextItemOpts } from './next-item'
