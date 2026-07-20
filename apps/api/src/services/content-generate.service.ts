/**
 * Nhà máy nội dung S4b — end-to-end, TÁCH 2 loại:
 *  • content HỌC (phơi bày, measurable=false) — để đọc/hiểu.
 *  • content ĐÁNH GIÁ (quiz, measurable=true) — sinh Candidate/evidence.
 * Instruction Plan + persona → GenerationSpec → sinh cả 2 → ráp LessonContentBundle → persist (NEEDS_REVIEW).
 */

import type { AuthoredItem } from '@bingoo.ai/authored-item'
import { assembleLessonContent, type LessonContentBundle } from '@bingoo.ai/content-gen'
import type { LessonInstructionPlan } from '@bingoo.ai/plans'
import {
  contentPlan,
  type EngineSnapshot,
  type LearnerPersona,
  type TeacherPersona,
} from '@bingoo.ai/personalization'
import { buildExpositionPort, buildFlashcardPort, buildGeneratorPort } from './content-adapters'
import { saveItems } from '../repos/content-item.repo'
import { computeSnapshot } from './knowledge.service'

export async function generateLessonContent(input: {
  lesson: LessonInstructionPlan
  learner: LearnerPersona
  teacher?: TeacherPersona
  snapshot?: EngineSnapshot
  /** Nếu có + KHÔNG truyền snapshot → tự chụp ảnh engine của học viên (fading → review-insert). */
  userId?: string
  aiKey?: string
  /** Lưu item sinh ra vào ngân hàng (NEEDS_REVIEW) để duyệt sau. Mặc định true. */
  persist?: boolean
}): Promise<LessonContentBundle> {
  const snapshot = input.snapshot ?? (input.userId ? await computeSnapshot(input.userId) : undefined)
  const spec = contentPlan(input.lesson, input.learner, input.teacher, snapshot)
  const aiOpt = input.aiKey !== undefined ? { aiKey: input.aiKey } : undefined
  const exposition = buildExpositionPort(aiOpt)
  const assessor = buildGeneratorPort(aiOpt)
  const flashcards = buildFlashcardPort(aiOpt)

  const teaching: AuthoredItem[] = []
  const assessmentItems: AuthoredItem[] = []
  const review: AuthoredItem[] = []
  for (const kc of spec.targetKcs) {
    teaching.push(...(await exposition.generate(spec, kc)))
    assessmentItems.push(...(await assessor.generate(spec, kc)))
    review.push(...(await flashcards.generate(spec, kc)))
  }
  const bundle = assembleLessonContent(spec, teaching, assessmentItems, review)

  if (input.persist !== false) {
    if (teaching.length > 0) await saveItems(teaching, 'NEEDS_REVIEW') // học (measurable=false)
    if (review.length > 0) await saveItems(review, 'NEEDS_REVIEW') // ôn tập (measurable=false)
    if (bundle.assessment.approvable && assessmentItems.length > 0) {
      await saveItems(assessmentItems, 'NEEDS_REVIEW') // đánh giá (measurable=true)
    }
  }
  return bundle
}
