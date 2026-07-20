// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** measuredStates — chỉ bằng chứng MEASURE, đúng ngôn ngữ. SPEC §12. */

import type { AssessmentMode } from '../domain'
import type { Elo, Slug } from '../contracts'

/** Bản ghi Observation tối thiểu cho chứng chỉ. */
export interface MeasureObservation {
  readonly skillSlug: Slug
  readonly outcome: number
  readonly confidence: number
  readonly mode: AssessmentMode
  readonly lang?: string
}

export interface MeasuredState {
  readonly pKnown: number
  readonly ability: Elo
}

/**
 * SPEC §12 — gộp Observation mode=MEASURE ĐÚNG ngôn ngữ:
 * pKnown = Σ(outcome·confidence)/Σ(confidence), ability = base (1000).
 * Bằng chứng LEARN hoặc khác ngôn ngữ KHÔNG BAO GIỜ tính vào chứng chỉ.
 */
export function measuredStates(
  observations: readonly MeasureObservation[],
  lang: string,
  base: Elo,
): Map<Slug, MeasuredState> {
  const acc = new Map<Slug, { weighted: number; weight: number }>()
  for (const o of observations) {
    if (o.mode !== 'MEASURE') continue // chỉ MEASURE
    if (o.lang !== lang) continue // đúng ngôn ngữ
    const cur = acc.get(o.skillSlug) ?? { weighted: 0, weight: 0 }
    cur.weighted += o.outcome * o.confidence
    cur.weight += o.confidence
    acc.set(o.skillSlug, cur)
  }

  const out = new Map<Slug, MeasuredState>()
  for (const [slug, { weighted, weight }] of acc) {
    out.set(slug, { pKnown: weight > 0 ? weighted / weight : 0, ability: base })
  }
  return out
}
