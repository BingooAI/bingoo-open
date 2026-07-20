/** DIF — công bằng đề giữa hai nhóm. SPEC §12. */

export interface DifResult {
  readonly rateA: number
  readonly rateB: number
  readonly delta: number
  readonly flagged: boolean
}

function rate(outcomes: readonly number[]): number {
  if (outcomes.length === 0) return 0
  let pass = 0
  for (const o of outcomes) if (o >= 0.5) pass++
  return pass / outcomes.length
}

/**
 * SPEC §12 — cờ chênh lệch tỷ lệ đúng giữa hai nhóm.
 * flagged = |A| ≥ minN && |B| ≥ minN && |rate(A) − rate(B)| ≥ threshold.
 */
export function flagDIF(
  groupA: readonly number[],
  groupB: readonly number[],
  threshold: number,
  minN: number,
): DifResult {
  const rateA = rate(groupA)
  const rateB = rate(groupB)
  const delta = Math.abs(rateA - rateB)
  const flagged = groupA.length >= minN && groupB.length >= minN && delta >= threshold
  return { rateA, rateB, delta, flagged }
}
