// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * S4 — sinh Instruction Plan cho MỘT BÀI (kcArcs), grounding bằng context KHOÁ+UNIT đã duyệt, kèm
 * chấm chất lượng sư phạm (planQuality). Lưu lại (DRAFT) để người DUYỆT trước khi sinh nội dung.
 *
 * CỔNG: kế hoạch UNIT của bài phải APPROVED trước (unit approved ⇒ course cũng đã approved). Không có
 * context tổng thể thì LLM bịa — nên gate ở đây, không cho tắt.
 */

import { planQuality, type CoursePlan, type LessonInstructionPlan, type PlanQuality } from '@bingoo.ai/plans'
import type { Slug } from '@bingoo.ai/knowledge-engine'
import { generateLessonPlan } from './plan-adapters'
import { getSkillGraph } from './knowledge.service'
import { getCourse } from '../repos/course.repo'
import { getPlan, isApproved, savePlan, type StoredPlan } from '../repos/plan-hierarchy.repo'
import { promptFingerprint } from '../prompts'
import { modelFor } from '../config/models'
import { AppError } from '../lib/errors'

export interface LessonPlanResult {
  readonly plan: LessonInstructionPlan
  readonly quality: PlanQuality
  readonly stored?: StoredPlan
}

/** Đường CŨ (không khoá/context) — giữ cho gọi trực tiếp theo KCs; KHÔNG lưu, KHÔNG grounding. */
export async function generateLessonPlanFor(input: {
  kcs: readonly Slug[]
  language: string
  level?: string
  aiKey?: string
}): Promise<LessonPlanResult> {
  const plan = await generateLessonPlan(input)
  return { plan, quality: qualityOf(await getSkillGraph(), plan) }
}

/**
 * Đường CHUẨN — sinh kế hoạch bài TRONG một khoá: gate unit đã duyệt, bơm context khoá+unit, LƯU lại.
 * KCs lấy TỪ vỏ khoá (không tin client), nên bài luôn dạy đúng KC đã map.
 */
export async function generateLessonPlanInCourse(input: {
  courseSlug: string
  lessonSlug: string
  language: string
  level?: string
  userId: string
  aiKey?: string
  /** Cho phép HỦY job nền — luồn xuống LLM call. */
  signal?: AbortSignal
}): Promise<LessonPlanResult> {
  const course = await getCourse(input.courseSlug)
  if (!course) throw AppError.notFound('Không có khoá này.')
  const unit = course.plan.units.find((u) => u.lessons.some((l) => l.slug === input.lessonSlug))
  const lesson = unit?.lessons.find((l) => l.slug === input.lessonSlug)
  if (!unit || !lesson) throw AppError.notFound('Không có bài này trong khoá.')

  // CỔNG: kế hoạch UNIT phải DUYỆT trước (để bài có context tổng thể).
  if (!(await isApproved(input.courseSlug, 'unit', unit.slug)))
    throw AppError.validation([
      {
        path: 'unit',
        message: `Chưa DUYỆT kế hoạch UNIT "${unit.slug}" — duyệt nó trước khi sinh kế hoạch bài (để có context).`,
        code: 'parent_not_approved',
      },
    ])

  if (lesson.teaches.length === 0)
    throw AppError.validation([
      {
        path: 'lesson',
        message: 'Bài chưa neo KC nào — đối chiếu bổ sung hoặc đổi stage.',
        code: 'unmapped',
      },
    ])

  const [coursePlan, unitPlan] = await Promise.all([
    getPlan(input.courseSlug, 'course', input.courseSlug),
    getPlan(input.courseSlug, 'unit', unit.slug),
  ])

  /**
   * Thiếu ngữ cảnh cha thì DỪNG, không thay bằng một vật rỗng.
   *
   * Trước đây thiếu kế hoạch khoá là `?? {}` — model nhận một đối tượng rỗng làm ngữ cảnh và vẫn
   * soạn ra một kế hoạch trông y hệt kế hoạch có ngữ cảnh đầy đủ. Không gì trong bản lưu phân biệt
   * được hai thứ đó, nên "bám vào khung và khoá học" thành một lời khai không kiểm được.
   *
   * Cổng cho UNIT đã có sẵn ngay phía trên; khoá thì không, dù chính chú thích đầu file nói kế hoạch
   * bài được neo bằng "context KHOÁ+UNIT đã duyệt".
   */
  if (!coursePlan)
    throw AppError.validation([
      {
        path: 'course',
        message: `Chưa có kế hoạch KHOÁ cho "${input.courseSlug}" — sinh và duyệt nó trước, vì kế hoạch bài neo vào nó.`,
        code: 'parent_missing',
      },
    ])

  const plan = await generateLessonPlan({
    kcs: lesson.teaches,
    language: input.language,
    ...(input.level ? { level: input.level } : {}),
    courseContext: JSON.stringify(coursePlan.doc),
    unitContext: JSON.stringify(unitPlan?.doc ?? {}),
    ...(input.aiKey ? { aiKey: input.aiKey } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  })
  // Giữ slug bài theo vỏ khoá để ăn khớp khi duyệt/lấy lại.
  const withSlug: LessonInstructionPlan = { ...plan, slug: input.lessonSlug }
  const quality = qualityOf(await getSkillGraph(), withSlug)

  const stored = await savePlan({
    courseSlug: input.courseSlug,
    level: 'lesson',
    refSlug: input.lessonSlug,
    doc: withSlug,
    quality,
    createdBy: input.userId,
    provenance: { aiModel: modelFor('content'), ...(await promptFingerprint('plan.lesson.generate')) },
  })
  return { plan: withSlug, quality, stored }
}

function qualityOf(
  graph: Awaited<ReturnType<typeof getSkillGraph>>,
  plan: LessonInstructionPlan,
): PlanQuality {
  // Bọc lesson vào 1 CoursePlan tối thiểu để chạy planQuality (anchor/coverage/prereq/steps).
  const course: CoursePlan = {
    slug: 'preview',
    title: plan.title,
    objectives: plan.teaches,
    units: [{ slug: 'unit-1', version: 1, title: plan.title, concepts: plan.teaches, lessons: [plan] }],
  }
  return planQuality(course, graph)
}
