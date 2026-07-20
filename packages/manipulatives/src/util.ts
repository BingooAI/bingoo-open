/**
 * manipulative/util.ts — tiny pure helpers shared by the math kits. Colours are
 * referenced as design-token IDs (resolved by the renderer), collected here so a
 * kit reads consistently and a palette change is one edit.
 */
import { clamp01 } from './easing'

/** Linear interpolation. Kept local so this package stands alone (the explainer
 *  engine has its own `lerp` in interpolate.ts — identical). */
export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p
}

export { clamp01 }

/** Default token ids the kits draw with (renderer maps to theme colours). */
export const TOK = {
  ink: 'ink',
  soft: 'inkSoft',
  accent: 'accent',
  accent2: 'accent2',
  good: 'good',
  warn: 'warn',
  faint: 'faint',
  paper: 'paper',
} as const

/** Map value v in [a,b] to [lo,hi]. */
export function mapRange(v: number, a: number, b: number, lo: number, hi: number): number {
  if (b === a) return lo
  return lo + ((v - a) / (b - a)) * (hi - lo)
}

/** Set difference to-from (which items are newly present in `to`). */
export function addedItems<T>(from: T[], to: T[]): T[] {
  const seen = new Map<string, number>()
  for (const x of from) {
    const k = String(x)
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  const out: T[] = []
  for (const x of to) {
    const k = String(x)
    const n = seen.get(k) ?? 0
    if (n > 0) seen.set(k, n - 1)
    else out.push(x)
  }
  return out
}

/** Trim trailing zeros for tick labels. */
export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}
