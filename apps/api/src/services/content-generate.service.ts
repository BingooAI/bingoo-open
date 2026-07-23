// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Nhà máy nội dung S4b — end-to-end, TÁCH 2 loại:
 *  • content HỌC (phơi bày, measurable=false) — để đọc/hiểu.
 *  • content ĐÁNH GIÁ (quiz, measurable=true) — sinh Candidate/evidence.
 *
 * CẤU TRÚC GIÁO ÁN (kcArcs) LÁI SINH: đi theo từng arc → từng bước, mỗi bước mang brief/mustCover CỤ THỂ,
 * dispatch theo `deliveryKind`. Sinh MỌI bước (mọi nhánh `forStates`) — nội dung của cả novice/gap/
 * proficient đều tồn tại; Decision Engine lọc theo trạng thái người học lúc render. Bài chưa dựng kcArcs
 * → lùi về đường CŨ sinh per-KC (tương thích ngược). explainer → uỷ hệ explainer; reflection → không item.
 */

import type { AuthoredItem } from '@bingoo.ai/authored-item'
import {
  assembleLessonContent,
  type ExpositionPort,
  type FlashcardPort,
  type GeneratorPort,
  type LessonContentBundle,
  type StepBrief,
} from '@bingoo.ai/content-gen'
import {
  lessonStepWork,
  type LessonInstructionPlan,
  type LessonStep,
  type LocalizedText,
} from '@bingoo.ai/plans'
import {
  contentPlan,
  type EngineSnapshot,
  type LearnerPersona,
  type TeacherPersona,
} from '@bingoo.ai/personalization'
import { buildExpositionPort, buildFlashcardPort, buildGeneratorPort } from './content-adapters'
import { saveItems } from '../repos/content-item.repo'
import { computeSnapshot } from './knowledge.service'

/** Một bước (LessonStep) → StepBrief (brief/mustCover đã phân giải theo ngôn ngữ) cho generator bám vào. */
function toStepBrief(step: LessonStep, lang: string): StepBrief {
  const loc = (t?: LocalizedText): string | undefined =>
    t ? (t[lang] ?? t['en'] ?? Object.values(t)[0]) : undefined
  const brief = loc(step.brief)
  const mustCover = (step.mustCover ?? []).map((m) => loc(m)).filter((s): s is string => s !== undefined)
  return {
    slug: step.slug,
    role: step.role,
    ...(brief !== undefined ? { brief } : {}),
    ...(mustCover.length ? { mustCover } : {}),
    ...(step.forStates !== undefined ? { forStates: step.forStates } : {}),
  }
}

export interface ContentPorts {
  readonly exposition: ExpositionPort
  readonly assessor: GeneratorPort
  readonly flashcards: FlashcardPort
}

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
  /** Inject cổng sinh (để test offline không gọi LLM). Mặc định dựng adapter thật từ aiKey. */
  ports?: ContentPorts
}): Promise<LessonContentBundle> {
  const snapshot = input.snapshot ?? (input.userId ? await computeSnapshot(input.userId) : undefined)
  const spec = contentPlan(input.lesson, input.learner, input.teacher, snapshot)
  const aiOpt = input.aiKey !== undefined ? { aiKey: input.aiKey } : undefined
  const exposition = input.ports?.exposition ?? buildExpositionPort(aiOpt)
  const assessor = input.ports?.assessor ?? buildGeneratorPort(aiOpt)
  const flashcards = input.ports?.flashcards ?? buildFlashcardPort(aiOpt)

  const teaching: AuthoredItem[] = []
  const assessmentItems: AuthoredItem[] = []
  const review: AuthoredItem[] = []

  const steps = lessonStepWork(input.lesson)
  if (steps.length > 0) {
    // Đi theo CẤU TRÚC: mỗi bước, đúng loại generator, đúng brief. Sinh mọi bước = mọi nhánh forStates.
    for (const { kc, step } of steps) {
      const sb = toStepBrief(step, spec.language)
      if (step.deliveryKind === 'content') {
        teaching.push(...(await exposition.generate(spec, kc, sb)))
      } else if (step.deliveryKind === 'practice' || step.deliveryKind === 'assessment') {
        assessmentItems.push(...(await assessor.generate(spec, kc, sb)))
      }
      // explainer → hệ explainer (ngoài factory này); reflection → không sinh item.
    }
  } else {
    // Bài chưa dựng kcArcs → đường CŨ per-KC.
    for (const kc of spec.targetKcs) {
      teaching.push(...(await exposition.generate(spec, kc)))
      assessmentItems.push(...(await assessor.generate(spec, kc)))
    }
  }

  // Ôn tập (SRS per-learner) theo KC — không theo step.
  for (const kc of spec.targetKcs) review.push(...(await flashcards.generate(spec, kc)))

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
