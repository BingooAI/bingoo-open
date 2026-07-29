// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Data access vỏ khoá (Course). Lưu CoursePlan skeleton + map frameworkVersionId. */

import { db, type Prisma } from '@bingoo.ai/db'
import type { CoursePlan } from '@bingoo.ai/plans'

export interface SavedCourse {
  readonly slug: string
  readonly frameworkVersionId: string | null
  readonly status: string
  readonly plan: CoursePlan
  /**
   * Lần ghi này ĐÈ LÊN một vỏ khoá đã được duyệt, nên con dấu duyệt bị gỡ.
   *
   * Người soạn phải biết: họ vừa sinh lại một khoá mà ai đó đã duyệt, và bản duyệt cũ không còn.
   * Im lặng thì họ tưởng vẫn còn nguyên.
   */
  readonly resetApproval?: boolean
}

/**
 * Lần ghi này có phải gỡ con dấu duyệt không.
 *
 * Thuần và tách riêng vì đây là chỗ quyết định, và nó phải kiểm được mà không cần kho: bộ test của
 * repo này chạy ngoại tuyến.
 *
 * Hai điều kiện, cả hai đều cần. NỘI DUNG thật sự đổi — bấm sinh lại ra đúng thứ cũ thì không phạt
 * ai. Và bản cũ ĐÃ được duyệt hoặc phát hành — chưa duyệt thì không có gì để gỡ.
 */
export function shouldResetApproval(
  prev: { readonly status: string; readonly plan: unknown } | null,
  nextPlan: unknown,
): boolean {
  if (prev === null) return false
  const changed = JSON.stringify(prev.plan) !== JSON.stringify(nextPlan)
  const wasApproved = prev.status === 'APPROVED' || prev.status === 'PUBLISHED'
  return changed && wasApproved
}

/**
 * Ghi vỏ khoá. Slug do model đặt từ nhan đề, nên hai lần sinh gần giống nhau ra CÙNG một slug và
 * lần sau ĐÈ lên lần trước.
 *
 * Chỗ chết người là con dấu duyệt: bản cũ được duyệt, nội dung bị thay sạch, và trạng thái vẫn đứng
 * nguyên APPROVED. Tức là thứ chưa ai đọc đang mang dấu của người đã đọc thứ khác — đúng điều luật
 * "người duyệt thứ trẻ thấy" tồn tại để chặn. Nên khi nội dung thật sự đổi, con dấu bị gỡ và người
 * soạn được báo, chứ không âm thầm giữ lại.
 */
export async function saveCourse(
  plan: CoursePlan,
  createdBy: string,
  frameworkVersionId?: string,
): Promise<SavedCourse> {
  const title = plan.title as Prisma.InputJsonValue
  const planJson = plan as unknown as Prisma.InputJsonValue

  const prev = await db.course.findUnique({
    where: { slug: plan.slug },
    select: { status: true, plan: true },
  })
  const resetApproval = shouldResetApproval(prev, planJson)

  const row = await db.course.upsert({
    where: { slug: plan.slug },
    create: {
      slug: plan.slug,
      title,
      plan: planJson,
      createdBy,
      ...(frameworkVersionId ? { frameworkVersionId } : {}),
    },
    update: {
      title,
      plan: planJson,
      ...(frameworkVersionId ? { frameworkVersionId } : {}),
      ...(resetApproval ? { status: 'DRAFT' as const } : {}),
    },
  })
  return {
    slug: row.slug,
    frameworkVersionId: row.frameworkVersionId,
    status: row.status,
    plan,
    ...(resetApproval ? { resetApproval } : {}),
  }
}

export async function getCourse(slug: string): Promise<SavedCourse | null> {
  const row = await db.course.findUnique({ where: { slug } })
  return row
    ? {
        slug: row.slug,
        frameworkVersionId: row.frameworkVersionId,
        status: row.status,
        plan: row.plan as unknown as CoursePlan,
      }
    : null
}

export interface CourseListItem {
  readonly slug: string
  readonly title: unknown
  readonly status: string
  readonly frameworkVersionId: string | null
}

export type CourseStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'APPROVED' | 'PUBLISHED'

/** Đổi trạng thái vỏ khoá (duyệt / phát hành). */
export async function setCourseStatus(slug: string, status: CourseStatus): Promise<boolean> {
  const r = await db.course.updateMany({ where: { slug }, data: { status } })
  return r.count > 0
}

export interface CourseDeleteResult {
  readonly deleted: boolean
  readonly plans: number
  readonly documents: number
  readonly traces: number
}

/**
 * Xoá vỏ khoá VÀ mọi thứ khoá theo nó.
 *
 * Kế hoạch biên soạn, tài liệu nguồn và thẻ căn cứ đều trỏ vào khoá bằng SLUG PHẲNG, không khoá
 * ngoại — cố ý, để chúng sống độc lập với việc khoá bị đổi tên. Cái giá là xoá khoá thì chúng ở lại,
 * và hậu quả không phải chỉ là rác:
 *
 * Sinh một khoá MỚI trùng slug là nó thừa hưởng toàn bộ đồ của khoá đã chết — gồm cả trạng thái
 * ĐÃ DUYỆT của những chương không còn tồn tại. Mà chính trạng thái đó là CỔNG cho phép sinh kế
 * hoạch bài. Nên một khoá vừa tạo có thể đi thẳng qua một cánh cổng do người khác mở, cho một thứ
 * khác, từ lâu rồi. Đã đo được: khoá mới thấy đúng kế hoạch của khoá đã xoá.
 */
export async function deleteCourse(slug: string): Promise<CourseDeleteResult> {
  const docs = await db.sourceDocument.findMany({ where: { courseSlug: slug }, select: { id: true } })
  // Thẻ trước, tài liệu sau: ngược lại thì thẻ trỏ vào tài liệu đã chết, đúng loại rác đã phải dọn tay.
  const traces = docs.length
    ? await db.decisionRecord.deleteMany({ where: { sourceDocumentId: { in: docs.map((d) => d.id) } } })
    : { count: 0 }
  const documents = await db.sourceDocument.deleteMany({ where: { courseSlug: slug } })
  const plans = await db.authoringPlan.deleteMany({ where: { courseSlug: slug } })
  const r = await db.course.deleteMany({ where: { slug } })
  return {
    deleted: r.count > 0,
    plans: plans.count,
    documents: documents.count,
    traces: traces.count,
  }
}

export async function listCourses(): Promise<CourseListItem[]> {
  const rows = await db.course.findMany({
    select: { slug: true, title: true, status: true, frameworkVersionId: true },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    status: r.status,
    frameworkVersionId: r.frameworkVersionId,
  }))
}
