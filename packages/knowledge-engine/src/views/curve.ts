/** Đường cong học từ snapshot. BỔ SUNG §3.4. */

import type { DreyfusLevel } from '../domain'
import type { Elo, Millis, SkillSnapshot, Slug } from '../contracts'

export interface CurvePoint {
  readonly atMs: Millis
  readonly pKnown: number
  readonly ability: Elo
  readonly level?: DreyfusLevel
}

/** Gom snapshot theo skill, sắp tăng theo thời gian. */
export function learningCurve(snapshots: readonly SkillSnapshot[]): Map<Slug, CurvePoint[]> {
  const out = new Map<Slug, CurvePoint[]>()
  for (const s of snapshots) {
    const point: CurvePoint = {
      atMs: s.atMs,
      pKnown: s.pKnown,
      ability: s.ability,
      ...(s.level !== undefined ? { level: s.level } : {}),
    }
    const list = out.get(s.skillSlug)
    if (list) list.push(point)
    else out.set(s.skillSlug, [point])
  }
  for (const list of out.values()) list.sort((a, b) => a.atMs - b.atMs)
  return out
}
