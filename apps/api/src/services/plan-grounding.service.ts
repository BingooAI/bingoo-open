// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * VÌ SAO GIÁO ÁN NÀY Ở ĐÂY — soạn lại từ những vết đã có, không đúc thêm một loại thẻ nữa.
 *
 * Kế hoạch bài được sinh từ ba thứ: kiến thức mà vỏ khoá gán cho bài, ngữ cảnh khoá và chương đã
 * duyệt, và (khi vỏ khoá sinh từ sách) chính cuốn sách. Cả ba đều ĐÃ để lại vết riêng — kiến thức có
 * thẻ "vì sao có nó", mục tiêu có thẻ của nó, ánh xạ bài↔kiến thức có thẻ kèm câu trong sách.
 *
 * Nên chỗ này KHÔNG ghi gì. Ghi thêm một thẻ "kế hoạch này bám vào X" là chép lại ba khẳng định đã
 * có, và bản chép sẽ lệch khỏi bản gốc ngay lần đầu ai đó sửa một trong ba. Nó chỉ nối lại: bài dạy
 * kiến thức nào → kiến thức đó chứng nhận mục tiêu nào → bài đến từ chỗ nào trong sách.
 *
 * Chỗ nào KHÔNG nối được thì nói ra là không nối được. Một kế hoạch bài không truy ngược tới mục
 * tiêu nào là chuyện có thật và người duyệt phải biết, chứ không phải chỗ để trống cho đẹp.
 */

import { db } from '@bingoo.ai/db'
import { getCourse } from '../repos/course.repo'
import { getPlan } from '../repos/plan-hierarchy.repo'
import { AppError } from '../lib/errors'

export interface GroundedConcept {
  readonly slug: string
  readonly title: unknown
  /** Có thẻ "vì sao có kiến thức này" không — tấm thẻ mở được thì người duyệt tự soi tiếp. */
  readonly hasTrace: boolean
}

export interface GroundedObjective {
  readonly slug: string
  readonly code: string | null
  readonly title: unknown
  readonly frameworkSlug: string | null
  /** Kiến thức của bài này nằm trong số những mảnh mục tiêu đó đòi. */
  readonly viaConcepts: readonly string[]
  readonly hasTrace: boolean
}

export interface PlanGrounding {
  readonly courseSlug: string
  readonly lessonSlug: string
  readonly lessonTitle: unknown
  readonly unitSlug: string
  /** Kế hoạch bài đã sinh chưa, và đã duyệt chưa. */
  readonly planStatus: string | null
  /** Cổng ngữ cảnh: kế hoạch khoá và chương — thiếu thì bài được sinh mà không có gì neo. */
  readonly courseePlanApproved: boolean
  readonly unitPlanApproved: boolean
  readonly concepts: readonly GroundedConcept[]
  readonly objectives: readonly GroundedObjective[]
  /** Bài này lấy từ chỗ nào trong sách — có khi vỏ khoá sinh từ sách. */
  readonly fromBook: readonly { readonly conceptSlug: string | null; readonly hasQuote: boolean }[]
}

export async function getPlanGrounding(courseSlug: string, lessonSlug: string): Promise<PlanGrounding> {
  const course = await getCourse(courseSlug)
  if (!course) throw AppError.notFound('Không có khoá này.')
  const unit = course.plan.units.find((u) => u.lessons.some((l) => l.slug === lessonSlug))
  const lesson = unit?.lessons.find((l) => l.slug === lessonSlug)
  if (!unit || !lesson) throw AppError.notFound('Không có bài này trong khoá.')

  const conceptSlugs = [...lesson.teaches] as string[]

  const [rows, lessonPlan, coursePlan, unitPlan, bookCards] = await Promise.all([
    conceptSlugs.length
      ? db.competency.findMany({
          where: { slug: { in: conceptSlugs } },
          select: { id: true, slug: true, title: true },
        })
      : Promise.resolve([]),
    getPlan(courseSlug, 'lesson', lessonSlug),
    getPlan(courseSlug, 'course', courseSlug),
    getPlan(courseSlug, 'unit', unit.slug),
    db.decisionRecord.findMany({
      where: { artifact: 'LESSON_MAPPING', subjectSlug: lessonSlug },
      select: { objectSlug: true, evidence: { select: { quoteVerified: true } } },
    }),
  ])

  // Mục tiêu nào ĐÒI những kiến thức này — đi ngược cạnh đo, không đoán theo tên.
  const ids = rows.map((r) => r.id)
  const mapsTo = ids.length
    ? await db.capabilityRelation.findMany({
        where: { toId: { in: ids }, relType: 'MAPS_TO' },
        select: { fromId: true, toId: true },
      })
    : []
  const objIds = [...new Set(mapsTo.map((m) => m.fromId))]
  const objRows = objIds.length
    ? await db.competency.findMany({
        where: { id: { in: objIds }, kind: 'OBJECTIVE' },
        select: { id: true, slug: true, code: true, title: true, framework: { select: { slug: true } } },
      })
    : []

  const tracedSubjects = new Set(
    (
      await db.decisionRecord.findMany({
        where: {
          artifact: { in: ['CONCEPT_EXISTS', 'OBJECTIVE_EXISTS'] },
          subjectSlug: { in: [...conceptSlugs, ...objRows.map((o) => o.slug)] },
        },
        select: { subjectSlug: true },
      })
    ).map((r) => r.subjectSlug),
  )

  const slugById = new Map(rows.map((r) => [r.id, r.slug]))
  return {
    courseSlug,
    lessonSlug,
    lessonTitle: lesson.title,
    unitSlug: unit.slug,
    planStatus: lessonPlan?.status ?? null,
    courseePlanApproved: coursePlan?.status === 'APPROVED',
    unitPlanApproved: unitPlan?.status === 'APPROVED',
    concepts: rows.map((r) => ({ slug: r.slug, title: r.title, hasTrace: tracedSubjects.has(r.slug) })),
    objectives: objRows.map((o) => ({
      slug: o.slug,
      code: o.code,
      title: o.title,
      frameworkSlug: o.framework?.slug ?? null,
      viaConcepts: mapsTo
        .filter((m) => m.fromId === o.id)
        .map((m) => slugById.get(m.toId))
        .filter((s): s is string => s !== undefined),
      hasTrace: tracedSubjects.has(o.slug),
    })),
    fromBook: bookCards.map((b) => ({
      conceptSlug: b.objectSlug,
      hasQuote: b.evidence.some((e) => e.quoteVerified === true),
    })),
  }
}
