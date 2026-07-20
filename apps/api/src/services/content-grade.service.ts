// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Khép vòng: học viên trả lời item trong ngân hàng → chấm (grader quiz core) → Verdict →
 * fold thành Observation/evidence cho từng skill item neo → cập nhật mức nắm. Idempotent qua attemptId.
 */

import { gradeItem } from '@bingoo.ai/authored-item'
import type { EvidenceInput, RecordResult, Verdict } from '@bingoo.ai/knowledge-engine'
import { loadItem } from '../repos/content-item.repo'
import { recordLearnerEvidence } from './knowledge.service'
import { graderFor } from './graders'
import { AppError } from '../lib/errors'

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

export interface GradeInput {
  readonly itemKey: string
  readonly attemptId: string
  readonly response: unknown
  readonly latencyMs?: number
  readonly hintsUsed?: number
  readonly lang?: string
  readonly atMs?: number
  /** Với primitive không tự chấm (rubric/peer/observation): điểm do rater/LLM cấp. */
  readonly outcome?: number
  readonly confidence?: number
}

export interface GradeResult {
  readonly verdict: Verdict
  readonly folds: readonly RecordResult[]
}

export async function gradeAndFold(userId: string, input: GradeInput): Promise<GradeResult> {
  const item = await loadItem(input.itemKey)
  if (!item) throw AppError.notFound(`Item "${input.itemKey}" không có trong ngân hàng.`)

  const grader = graderFor(item.primitiveKind)
  let verdict: Verdict
  if (grader) {
    verdict = gradeItem(item, input.response, grader) // auto-key / coverage
  } else if (input.outcome !== undefined) {
    // rubric/peer/observation: rater/LLM cấp điểm.
    verdict = { outcome: clamp01(input.outcome), confidence: clamp01(input.confidence ?? 0.6) }
  } else {
    throw AppError.validation([
      {
        path: 'outcome',
        message: `Primitive "${item.primitiveKind}" cần điểm do rater cấp (outcome).`,
        code: 'needs_external_verdict',
      },
    ])
  }

  const multi = item.skills.length > 1
  const folds: RecordResult[] = []
  for (const skill of item.skills) {
    // attemptId phải duy nhất mỗi lần fold (Observation.attemptId @unique) → gắn hậu tố skill khi >1.
    const attemptId = multi ? `${input.attemptId}::${skill}` : input.attemptId
    const ev: EvidenceInput = {
      skill,
      outcome: verdict.outcome,
      confidence: verdict.confidence,
      difficulty: item.difficulty,
      itemKey: item.itemKey,
      attemptId,
      mode: item.mode ?? 'LEARN',
      source: 'QUIZ',
      actor: 'LEARNER_SELF',
      ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
      ...(input.hintsUsed !== undefined ? { hintsUsed: input.hintsUsed } : {}),
      ...(input.lang !== undefined ? { lang: input.lang } : {}),
      ...(input.atMs !== undefined ? { atMs: input.atMs } : {}),
    }
    folds.push(await recordLearnerEvidence(userId, ev))
  }
  return { verdict, folds }
}
