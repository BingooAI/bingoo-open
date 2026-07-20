/**
 * Segment rule DSL (§3.8) — a small TYPED criteria language, never raw SQL, so a
 * segment definition can't inject queries. The server derives each user's facts
 * from the DB and evaluates the rule here (pure, platform-agnostic — R2).
 */

export type SegmentCriterion =
  | { field: 'accountType'; op: 'in'; value: string[] }
  | { field: 'country'; op: 'in'; value: string[] }
  | { field: 'role'; op: 'has'; value: string }
  | { field: 'status'; op: 'eq'; value: string }
  | { field: 'childrenCount'; op: 'gte'; value: number }
  | { field: 'activeWithinDays'; op: 'lte'; value: number }

/** A rule matches when ALL `all` criteria AND (no `any`, or SOME `any`) hold. */
export interface SegmentRule {
  all?: SegmentCriterion[]
  any?: SegmentCriterion[]
}

/** The per-user facts the evaluator needs (assembled from the DB by the server). */
export interface UserFacts {
  accountType?: string | null
  country?: string | null
  role?: string | null
  status?: string | null
  childrenCount: number
  lastActive: Date | null
}

const DAY_MS = 24 * 60 * 60 * 1000

export function evalCriterion(c: SegmentCriterion, f: UserFacts, now: number): boolean {
  switch (c.field) {
    case 'accountType':
      return f.accountType != null && c.value.includes(f.accountType)
    case 'country':
      return f.country != null && c.value.includes(f.country)
    case 'role':
      return (f.role ?? '')
        .split(',')
        .map((r) => r.trim())
        .includes(c.value)
    case 'status':
      return f.status === c.value
    case 'childrenCount':
      return f.childrenCount >= c.value
    case 'activeWithinDays':
      return f.lastActive != null && now - f.lastActive.getTime() <= c.value * DAY_MS
  }
}

export function evalRule(rule: SegmentRule, f: UserFacts, now: number): boolean {
  const all = rule.all ?? []
  const any = rule.any ?? []
  const allOk = all.every((c) => evalCriterion(c, f, now))
  const anyOk = any.length === 0 || any.some((c) => evalCriterion(c, f, now))
  return allOk && anyOk
}
