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
}

export async function saveCourse(
  plan: CoursePlan,
  createdBy: string,
  frameworkVersionId?: string,
): Promise<SavedCourse> {
  const title = plan.title as Prisma.InputJsonValue
  const planJson = plan as unknown as Prisma.InputJsonValue
  const row = await db.course.upsert({
    where: { slug: plan.slug },
    create: {
      slug: plan.slug,
      title,
      plan: planJson,
      createdBy,
      ...(frameworkVersionId ? { frameworkVersionId } : {}),
    },
    update: { title, plan: planJson, ...(frameworkVersionId ? { frameworkVersionId } : {}) },
  })
  return { slug: row.slug, frameworkVersionId: row.frameworkVersionId, status: row.status, plan }
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

export async function deleteCourse(slug: string): Promise<boolean> {
  const r = await db.course.deleteMany({ where: { slug } })
  return r.count > 0
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
