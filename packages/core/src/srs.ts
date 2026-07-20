/**
 * Spaced-repetition scheduling (SM-2 lite) — shared, pure TS (§R2). Drives
 * FlashcardDeck review on both web and native identically. Dates are passed in
 * so the module stays pure (no clock dependency).
 */

import { clamp } from './utils'

export type SrsGrade = 'again' | 'hard' | 'good' | 'easy'

export interface SrsState {
  /** Ease factor (SM-2), 1.3–3.0. */
  ease: number
  /** Current interval in days. */
  intervalDays: number
  /** Consecutive successful reviews. */
  reps: number
  /** Epoch-day index when the card is next due. */
  dueDay: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole-day index for a date (used as the SRS due marker). */
export function epochDay(date: Date = new Date()): number {
  return Math.floor(date.getTime() / DAY_MS)
}

export function initSrsState(today: Date = new Date()): SrsState {
  return { ease: 2.5, intervalDays: 0, reps: 0, dueDay: epochDay(today) }
}

/** Review a card with a grade → next SRS state (SM-2 lite). */
export function reviewCard(state: SrsState, grade: SrsGrade, today: Date = new Date()): SrsState {
  const day = epochDay(today)
  let { ease, intervalDays, reps } = state

  if (grade === 'again') {
    reps = 0
    intervalDays = 1
    ease = clamp(ease - 0.2, 1.3, 3.0)
  } else {
    reps += 1
    const delta = grade === 'hard' ? -0.15 : grade === 'easy' ? 0.15 : 0
    ease = clamp(ease + delta, 1.3, 3.0)
    if (reps === 1) intervalDays = grade === 'easy' ? 4 : 1
    else if (reps === 2) intervalDays = 6
    else intervalDays = Math.max(1, Math.round(intervalDays * ease))
    if (grade === 'hard') intervalDays = Math.max(1, Math.round(intervalDays * 0.7))
  }

  return { ease: Math.round(ease * 100) / 100, intervalDays, reps, dueDay: day + intervalDays }
}

/** Is this card due for review today? */
export function isDue(state: SrsState, today: Date = new Date()): boolean {
  return epochDay(today) >= state.dueDay
}

/** Filter a set of cards down to those due now (cards with no state are due). */
export function dueCards<T extends { srs?: SrsState }>(cards: T[], today: Date = new Date()): T[] {
  return cards.filter((c) => !c.srs || isDue(c.srs, today))
}
