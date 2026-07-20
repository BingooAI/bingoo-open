/**
 * XP + leveling math — the shared, platform-agnostic core of the gamification
 * layer (§R2: no UI, no next/rn). Web and native compute levels identically.
 *
 * Curve: XP to advance from level L to L+1 grows linearly (`base + step·(L-1)`),
 * so early levels are quick and later ones ramp up. Tune per audience via a curve.
 */

export interface LevelCurve {
  /** XP to advance from level 1 → 2. */
  base: number
  /** Extra XP added to each subsequent level's requirement (linear ramp). */
  step: number
}

export const DEFAULT_LEVEL_CURVE: LevelCurve = { base: 100, step: 50 }

/** XP required to advance FROM `level` to `level + 1` (level ≥ 1). */
export function xpToAdvance(level: number, curve: LevelCurve = DEFAULT_LEVEL_CURVE): number {
  return curve.base + curve.step * Math.max(0, level - 1)
}

/** Total XP needed to REACH `level` from zero (level 1 = 0 XP). */
export function totalXpForLevel(level: number, curve: LevelCurve = DEFAULT_LEVEL_CURVE): number {
  let sum = 0
  for (let l = 1; l < level; l++) sum += xpToAdvance(l, curve)
  return sum
}

export interface LevelInfo {
  level: number
  /** XP accumulated within the current level. */
  xpIntoLevel: number
  /** XP span of the current level (to reach the next). */
  levelSpan: number
  /** 0–1 progress through the current level. */
  progress: number
  totalXp: number
}

/** Resolve a total-XP amount to its level + in-level progress. */
export function levelFromXp(totalXp: number, curve: LevelCurve = DEFAULT_LEVEL_CURVE): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp))
  let level = 1
  let remaining = xp
  while (remaining >= xpToAdvance(level, curve)) {
    remaining -= xpToAdvance(level, curve)
    level++
  }
  const span = xpToAdvance(level, curve)
  return {
    level,
    xpIntoLevel: remaining,
    levelSpan: span,
    progress: span > 0 ? remaining / span : 0,
    totalXp: xp,
  }
}

export interface LevelGain {
  before: LevelInfo
  after: LevelInfo
  leveledUp: boolean
  levelsGained: number
}

/** Compute the before/after levels when `gained` XP is added — drives LevelUpModal. */
export function levelUpFromGain(
  beforeXp: number,
  gained: number,
  curve: LevelCurve = DEFAULT_LEVEL_CURVE,
): LevelGain {
  const before = levelFromXp(beforeXp, curve)
  const after = levelFromXp(beforeXp + Math.max(0, gained), curve)
  return {
    before,
    after,
    leveledUp: after.level > before.level,
    levelsGained: after.level - before.level,
  }
}
