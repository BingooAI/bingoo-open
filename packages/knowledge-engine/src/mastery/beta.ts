// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Beta-Binomial cho DISPOSITION (thói quen là tỷ lệ tích luỹ). SPEC §5. */

import type { BetaParams } from '../policy'
import { clamp01 } from './math'

export interface BetaPosterior {
  readonly mean: number
  readonly lo: number
  readonly hi: number
}

/**
 * SPEC §5. Beta(priorA, priorB) mặc định (1,1) đều; dải z=1.96 (95%).
 * mean thay cho pKnown khi kind=DISPOSITION.
 */
export function betaPosterior(successes: number, failures: number, p: BetaParams): BetaPosterior {
  const alpha = p.priorA + Math.max(0, successes)
  const beta = p.priorB + Math.max(0, failures)
  const total = alpha + beta
  const mean = alpha / total
  const variance = (alpha * beta) / (total * total * (total + 1))
  const sd = Math.sqrt(variance)
  return {
    mean,
    lo: clamp01(mean - p.z * sd),
    hi: clamp01(mean + p.z * sd),
  }
}
