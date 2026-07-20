/** Fold thuần một bằng chứng LEARNER vào SkillState. SPEC §2 + §5 (DISPOSITION). */

import type { BktParams, BetaParams, EloParams } from '../policy'
import type { EvidenceInput } from '../contracts'
import { betaPosterior } from '../mastery/beta'
import { observe, type Observation, type SkillMastery } from '../mastery/observe'

export interface FoldParams {
  readonly bkt: BktParams
  readonly elo: EloParams
  readonly beta: BetaParams
}

/**
 * SPEC §2. outcome = ev.outcome ?? (ev.correct?1:0); correct = outcome ≥ 0.5 (partial coi là đúng
 * cho BKT/Elo). weight = ev.confidence. DISPOSITION → thay pKnown bằng betaPosterior.mean (§5).
 * Thuần: transaction/retry Serializable là việc host bọc quanh hàm này (SPEC §2).
 */
export function foldEvidence(
  prior: SkillMastery | undefined,
  ev: EvidenceInput,
  params: FoldParams,
): SkillMastery {
  const outcome = ev.outcome ?? (ev.correct ? 1 : 0)
  const correct = outcome >= 0.5

  const obs: Observation = {
    skill: ev.skill,
    correct,
    weight: ev.confidence ?? 1,
    ...(ev.difficulty !== undefined ? { difficulty: ev.difficulty } : {}),
    ...(ev.atMs !== undefined ? { atMs: ev.atMs } : {}),
    ...(ev.kind !== undefined ? { kind: ev.kind } : {}),
  }

  const folded = observe(prior, obs, { bkt: params.bkt, elo: params.elo })

  if (ev.kind === 'DISPOSITION') {
    const mean = betaPosterior(folded.correct, folded.attempts - folded.correct, params.beta).mean
    return { ...folded, pKnown: mean }
  }
  return folded
}

/** SPEC §2 — lấy mẫu snapshot: lần đầu (attempts ≤ 1) rồi mỗi `sampleEvery` lần. */
export function shouldSnapshot(attempts: number, sampleEvery: number): boolean {
  return attempts <= 1 || attempts % sampleEvery === 0
}
