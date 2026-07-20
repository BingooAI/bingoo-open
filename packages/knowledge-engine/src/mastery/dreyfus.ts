// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Tín hiệu Dreyfus & xếp bậc trình độ. SPEC §4. */

import type { DreyfusLevel } from '../domain'
import type { Elo } from '../contracts'
import type { DreyfusParams } from '../policy'
import { clamp, clamp01, mean, shrink } from './math'

/** Một quan sát cho tính tín hiệu (đủ trường để suy fluency/independence/transfer). */
export interface DreyfusObservation {
  readonly outcome: number
  readonly latencyMs?: number
  readonly hintsUsed?: number
  readonly difficulty?: Elo
}

export interface DreyfusSignals {
  readonly fluency: number
  readonly transfer: number
  readonly independence: number
}

/**
 * SPEC §4.1 — tính ba tín hiệu trên cửa sổ `window` quan sát gần nhất.
 * - fluency: chỉ câu ĐÚNG (outcome≥0.5, latency>0); ngân sách thời gian co giãn theo độ khó.
 * - independence: nghịch đảo phụ thuộc gợi ý, trên MỌI quan sát.
 * - transfer: tỷ lệ đúng trên câu KHÓ HƠN ability; KHÔNG shrink, =0 nếu không có câu khó.
 */
export function dreyfusSignals(
  observations: readonly DreyfusObservation[],
  ability: Elo,
  p: DreyfusParams,
): DreyfusSignals {
  const window = observations.slice(-p.window)
  const n = window.length

  // fluency
  const speeds: number[] = []
  for (const o of window) {
    if (o.outcome >= 0.5 && o.latencyMs != null && o.latencyMs > 0) {
      const d = o.difficulty ?? ability
      const scale = 2 ** (clamp(d - 1000, -400, 400) / 200)
      speeds.push(clamp01((p.expectedMs * scale) / o.latencyMs))
    }
  }
  const fluency = speeds.length > 0 ? shrink(mean(speeds), speeds.length, p.shrinkK, p.neutral) : 0

  // independence
  const hints = window.map((o) => o.hintsUsed ?? 0)
  const rawIndependence = clamp01(1 - mean(hints) / p.maxHints)
  const independence = n > 0 ? shrink(rawIndependence, n, p.shrinkK, p.neutral) : 0

  // transfer
  const harder = window.filter((o) => (o.difficulty ?? ability) > ability)
  const transfer = harder.length > 0 ? harder.filter((o) => o.outcome >= 0.5).length / harder.length : 0

  return { fluency, transfer, independence }
}

/** Đầu vào xếp bậc — mặc định khi thiếu: ability=1000, transfer/fluency/independence=0. */
export interface LevelInput {
  readonly pKnown: number
  readonly ability?: Elo
  readonly transfer?: number
  readonly fluency?: number
  readonly independence?: number
}

/**
 * SPEC §4.2 — xếp bậc Dreyfus. Thứ tự kiểm BẮT BUỘC: expert → proficient → competent → novice.
 * expert cần ability+fluency+independence (KHÔNG cần transfer); proficient cần ability+transfer.
 */
export function deriveLevel(sig: LevelInput, p: DreyfusParams): DreyfusLevel | null {
  if (sig.pKnown < p.acquired) return null // chưa tiếp thu

  const ability = sig.ability ?? 1000
  const transfer = sig.transfer ?? 0
  const fluency = sig.fluency ?? 0
  const independence = sig.independence ?? 0

  if (ability >= p.expertAbility && fluency >= p.expertFluency && independence >= p.expertIndependence) {
    return 'expert'
  }
  if (ability >= p.proficientAbility && transfer >= p.proficientTransfer) {
    return 'proficient'
  }
  if (ability >= p.competentAbility) {
    return 'competent'
  }
  return 'novice'
}
