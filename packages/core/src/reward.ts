// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Rewards: league tiers, badge unlocking, mission progress, countdown breakdown —
 * shared gamification logic (§R2: pure TS, no UI/copy). Tier names are ids, not
 * display text; the UI localizes them.
 */

import { clamp } from './utils'

/* --------------------------------- Leagues -------------------------------- */

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface LeagueDef {
  tier: LeagueTier
  /** Minimum points to enter this tier. */
  min: number
}

/** Default weekly-points ladder (override via remote config later, §R6). */
export const LEAGUES: readonly LeagueDef[] = [
  { tier: 'bronze', min: 0 },
  { tier: 'silver', min: 500 },
  { tier: 'gold', min: 1500 },
  { tier: 'platinum', min: 3500 },
  { tier: 'diamond', min: 7000 },
]

export interface LeagueInfo {
  tier: LeagueTier
  index: number
  points: number
  /** Points at which the current tier starts. */
  floor: number
  /** Points to reach the next tier, or null at the top. */
  next: number | null
  /** 0–1 progress toward the next tier (1 at the top). */
  progress: number
}

/** Resolve points to a league tier + progress toward the next. */
export function leagueFromPoints(points: number, ladder: readonly LeagueDef[] = LEAGUES): LeagueInfo {
  const pts = Math.max(0, Math.floor(points))
  let index = 0
  for (let i = 0; i < ladder.length; i++) {
    if (pts >= ladder[i]!.min) index = i
  }
  const floor = ladder[index]!.min
  const nextDef = ladder[index + 1]
  const next = nextDef ? nextDef.min : null
  const progress = next == null ? 1 : clamp((pts - floor) / (next - floor), 0, 1)
  return { tier: ladder[index]!.tier, index, points: pts, floor, next, progress }
}

/* --------------------------------- Badges --------------------------------- */

export interface BadgeRequirement {
  id: string
  /** Stat key this badge tracks, e.g. "lessons", "streak", "perfectQuizzes". */
  metric: string
  /** Value of `metric` at which it unlocks. */
  threshold: number
}

/** Whether a badge is unlocked given the player's stats. */
export function badgeUnlocked(req: BadgeRequirement, stats: Record<string, number>): boolean {
  return (stats[req.metric] ?? 0) >= req.threshold
}

/** 0–1 progress toward unlocking a badge (1 = unlocked). */
export function badgeProgress(req: BadgeRequirement, stats: Record<string, number>): number {
  if (req.threshold <= 0) return 1
  return clamp((stats[req.metric] ?? 0) / req.threshold, 0, 1)
}

/* -------------------------------- Missions -------------------------------- */

export interface MissionProgress {
  current: number
  goal: number
  complete: boolean
  /** 0–1. */
  ratio: number
}

export function missionProgress(current: number, goal: number): MissionProgress {
  const ratio = goal > 0 ? clamp(current / goal, 0, 1) : 0
  return { current, goal, complete: goal > 0 && current >= goal, ratio }
}

/* ------------------------------- Countdown -------------------------------- */

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** Total whole seconds remaining. */
  totalSeconds: number
  done: boolean
}

/** Break a remaining-milliseconds value into d/h/m/s for a countdown timer. */
export function countdownParts(ms: number): CountdownParts {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
    done: totalSeconds === 0,
  }
}
