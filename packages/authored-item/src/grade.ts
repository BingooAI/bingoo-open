/** Cầu grading: @bingoo/core `Grade` → engine `Verdict` → Submission. */

import type { Submission, Verdict } from '@bingoo/knowledge-engine'
import { gradeQuestion, type QuizQuestion, type QuizResponse } from '@bingoo/core'
import { checkAnswer } from '@bingoo/manipulatives'
import type { AuthoredItem, Grade, Grader } from './model'
import { primitiveMeta } from './registry'

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/** Grade{score} → Verdict{outcome}. Độ tin cậy lấy theo cách chấm (registry). */
export function toVerdict(item: AuthoredItem, grade: Grade): Verdict {
  const confidence = primitiveMeta(item.primitiveKind)?.baseConfidence ?? 1
  return { outcome: clamp01(grade.score), confidence }
}

/** Chấm một item bằng grader host cấp → Verdict. */
export function gradeItem(item: AuthoredItem, response: unknown, grader: Grader): Verdict {
  return toVerdict(item, grader(item.payload, response))
}

/**
 * Grader sẵn cho primitive quiz — bọc `gradeQuestion` thật của @bingoo/core.
 * payload là một `QuizQuestion`, response là `QuizResponse`.
 */
export const quizGrader: Grader = (payload, response) =>
  gradeQuestion(payload as QuizQuestion, response as QuizResponse | undefined)

/**
 * Grader cho MANIPULATIVE kit (mọi kind, ĐỘNG). `payload` mang `{ kind, target }` (đáp án của item);
 * `response` là TRẠNG THÁI cuối của học viên trên kit (params). `checkAnswer` tự chọn `check` riêng của
 * kit, hoặc so khớp trường chung — nên kit mới KHÔNG cần thêm code grader nào.
 *
 * Đây là mắt xích khép vòng bằng chứng cho 67 kit: học viên thao tác ten-frame/number-line… → Verdict →
 * Observation → mastery. Trước đây `graderFor` trả null cho kit nên hệ mù với mọi tương tác kit.
 */
export const manipGrader: Grader = (payload, response): Grade => {
  const p = (payload ?? {}) as { kind?: unknown; target?: unknown }
  const kind = typeof p.kind === 'string' ? p.kind : undefined
  if (!kind) return { correct: false, score: 0 }
  const ok = checkAnswer(kind, response, p.target)
  return { correct: ok, score: ok ? 1 : 0 }
}

/**
 * Dựng Submission cho engine. `attemptId` do host sinh (idempotency); `atMs` là thời gian
 * tương tác. Kết hợp với `toObservations` + `recordEvidence` của engine.
 */
export function itemSubmission(
  item: AuthoredItem,
  response: unknown,
  attemptId: string,
  opts: {
    readonly atMs?: number
    readonly latencyMs?: number
    readonly hintsUsed?: number
    readonly lang?: string
  } = {},
): Submission {
  return {
    attemptId,
    skills: item.skills,
    payload: response,
    itemKey: item.itemKey,
    ...(opts.atMs !== undefined ? { atMs: opts.atMs } : {}),
    ...(opts.latencyMs !== undefined ? { latencyMs: opts.latencyMs } : {}),
    ...(opts.hintsUsed !== undefined ? { hintsUsed: opts.hintsUsed } : {}),
    ...(opts.lang !== undefined ? { lang: opts.lang } : {}),
  }
}
