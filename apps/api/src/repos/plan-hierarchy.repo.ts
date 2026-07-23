// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Lưu KẾ HOẠCH PHÂN CẤP (Khoá/Unit/Bài) + trạng thái DUYỆT. Bảng `authoring_plan`, khoá
 * (courseSlug, level, refSlug). Đây là nơi giữ CỔNG: cấp con chỉ sinh khi cấp cha đã APPROVED.
 */

import { db, type Prisma } from '@bingoo.ai/db'

export type PlanLevel = 'course' | 'unit' | 'lesson'

export interface StoredPlan {
  readonly level: PlanLevel
  readonly refSlug: string
  readonly doc: unknown
  readonly status: string // DRAFT | APPROVED | …
  readonly version: number
  readonly quality: unknown
  readonly approvedBy: string | null
  /** PROVENANCE: model + prompt (id + hash) đã sinh bản này (null nếu không do AI / bản cũ). */
  readonly aiModel: string | null
  readonly promptId: string | null
  readonly promptHash: string | null
}

const PLAN_SELECT = {
  level: true,
  refSlug: true,
  doc: true,
  status: true,
  version: true,
  quality: true,
  approvedBy: true,
  aiModel: true,
  promptId: true,
  promptHash: true,
} as const

const toStored = (r: {
  level: string
  refSlug: string
  doc: unknown
  status: string
  version: number
  quality: unknown
  approvedBy: string | null
  aiModel: string | null
  promptId: string | null
  promptHash: string | null
}): StoredPlan => ({
  level: r.level as PlanLevel,
  refSlug: r.refSlug,
  doc: r.doc,
  status: r.status,
  version: r.version,
  quality: r.quality ?? null,
  approvedBy: r.approvedBy,
  aiModel: r.aiModel,
  promptId: r.promptId,
  promptHash: r.promptHash,
})

/** Lưu/ghi đè một kế hoạch (bump version, reset về DRAFT — sinh lại thì phải duyệt lại). */
export async function savePlan(input: {
  courseSlug: string
  level: PlanLevel
  refSlug: string
  doc: unknown
  quality: unknown
  createdBy: string
  /** PROVENANCE: model + prompt (id + hash template hiệu lực) đã sinh bản doc này. */
  provenance?: { aiModel?: string; promptId?: string; promptHash?: string }
}): Promise<StoredPlan> {
  const prov = {
    ...(input.provenance?.aiModel !== undefined ? { aiModel: input.provenance.aiModel } : {}),
    ...(input.provenance?.promptId !== undefined ? { promptId: input.provenance.promptId } : {}),
    ...(input.provenance?.promptHash !== undefined ? { promptHash: input.provenance.promptHash } : {}),
  }
  const prev = await db.authoringPlan.findUnique({
    where: {
      courseSlug_level_refSlug: {
        courseSlug: input.courseSlug,
        level: input.level,
        refSlug: input.refSlug,
      },
    },
    select: { version: true },
  })
  const r = await db.authoringPlan.upsert({
    where: {
      courseSlug_level_refSlug: {
        courseSlug: input.courseSlug,
        level: input.level,
        refSlug: input.refSlug,
      },
    },
    create: {
      courseSlug: input.courseSlug,
      level: input.level,
      refSlug: input.refSlug,
      doc: input.doc as Prisma.InputJsonValue,
      quality: input.quality as Prisma.InputJsonValue,
      createdBy: input.createdBy,
      ...prov,
    },
    update: {
      doc: input.doc as Prisma.InputJsonValue,
      quality: input.quality as Prisma.InputJsonValue,
      version: (prev?.version ?? 0) + 1,
      status: 'DRAFT', // sinh lại → phải duyệt lại (context cấp dưới có thể đã đổi)
      approvedBy: null,
      approvedAt: null,
      ...prov, // sinh lại = model/prompt mới → cập nhật provenance
    },
    select: PLAN_SELECT,
  })
  return toStored(r)
}

export async function getPlan(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
): Promise<StoredPlan | null> {
  const r = await db.authoringPlan.findUnique({
    where: { courseSlug_level_refSlug: { courseSlug, level, refSlug } },
    select: PLAN_SELECT,
  })
  return r ? toStored(r) : null
}

/** Mọi kế hoạch của một khoá (để UI dựng cây trạng thái). */
export async function listPlans(courseSlug: string): Promise<readonly StoredPlan[]> {
  const rows = await db.authoringPlan.findMany({
    where: { courseSlug },
    select: PLAN_SELECT,
  })
  return rows.map(toStored)
}

/** DUYỆT một kế hoạch. Trả null nếu chưa có bản nháp để duyệt. */
export async function approvePlan(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
  approvedBy: string,
): Promise<StoredPlan | null> {
  const existing = await getPlan(courseSlug, level, refSlug)
  if (!existing) return null
  const r = await db.authoringPlan.update({
    where: { courseSlug_level_refSlug: { courseSlug, level, refSlug } },
    data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    select: PLAN_SELECT,
  })
  return toStored(r)
}

/** Cấp cha đã duyệt chưa — cổng chặn sinh cấp con. */
export async function isApproved(courseSlug: string, level: PlanLevel, refSlug: string): Promise<boolean> {
  const p = await getPlan(courseSlug, level, refSlug)
  return p?.status === 'APPROVED'
}
