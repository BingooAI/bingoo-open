/**
 * Streak + combo math — shared gamification logic (§R2: pure TS). Both platforms
 * derive the same streak state and heatmap grid so the UI never drifts.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Local ISO `yyyy-mm-dd` for a date (calendar day, no time). */
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Whole calendar days between two dates (ignores time-of-day). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / DAY_MS)
}

export type StreakState = 'active' | 'at-risk' | 'broken'

/**
 * Streak state from the last active day:
 *  - `active`  — did something today
 *  - `at-risk` — last active yesterday; today still open (keep it alive!)
 *  - `broken`  — 2+ days since last active, or never
 */
export function streakState(lastActive: Date | null, today: Date = new Date()): StreakState {
  if (!lastActive) return 'broken'
  const d = calendarDaysBetween(lastActive, today)
  if (d <= 0) return 'active'
  if (d === 1) return 'at-risk'
  return 'broken'
}

export interface StreakCell {
  date: string
  active: boolean
  isToday: boolean
}

/** Build the last `days` calendar cells for a streak heatmap (oldest → newest). */
export function streakCalendar(
  activeDates: Iterable<string>,
  days: number,
  today: Date = new Date(),
): StreakCell[] {
  const set = activeDates instanceof Set ? activeDates : new Set(activeDates)
  const cells: StreakCell[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const iso = isoDate(d)
    cells.push({ date: iso, active: set.has(iso), isToday: i === 0 })
  }
  return cells
}

/**
 * Combo multiplier from a run of consecutive correct answers. Each step adds
 * `step` up to `max` (e.g. streak 3 → 1 + 3·0.5 = 2.5×, capped at 4×).
 */
export function comboMultiplier(streak: number, step = 0.5, max = 4): number {
  return Math.min(max, 1 + Math.max(0, streak) * step)
}
