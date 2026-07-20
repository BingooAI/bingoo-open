// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Cut-score. SPEC §12. */

export interface CutScoreResult {
  readonly passed: boolean
  readonly mastery: number
  readonly cut: number
}

/** SPEC §12 — đạt nếu mastery ≥ cut. */
export function cutScore(mastery: number, cut: number): CutScoreResult {
  return { passed: mastery >= cut, mastery, cut }
}
