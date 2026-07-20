/**
 * Lưu KẾ HOẠCH PHÂN CẤP (Khoá/Unit/Bài) + trạng thái DUYỆT. Bảng `authoring_plan`, khoá
 * (courseSlug, level, refSlug). Đây là nơi giữ CỔNG: cấp con chỉ sinh khi cấp cha đã APPROVED.
 */

import { db, type Prisma } from '@bingoo/db';

export type PlanLevel = 'course' | 'unit' | 'lesson';

export interface StoredPlan {
  readonly level: PlanLevel;
  readonly refSlug: string;
  readonly doc: unknown;
  readonly status: string; // DRAFT | APPROVED | …
  readonly version: number;
  readonly quality: unknown;
  readonly approvedBy: string | null;
}

const toStored = (r: {
  level: string;
  refSlug: string;
  doc: unknown;
  status: string;
  version: number;
  quality: unknown;
  approvedBy: string | null;
}): StoredPlan => ({
  level: r.level as PlanLevel,
  refSlug: r.refSlug,
  doc: r.doc,
  status: r.status,
  version: r.version,
  quality: r.quality ?? null,
  approvedBy: r.approvedBy,
});

/** Lưu/ghi đè một kế hoạch (bump version, reset về DRAFT — sinh lại thì phải duyệt lại). */
export async function savePlan(input: {
  courseSlug: string;
  level: PlanLevel;
  refSlug: string;
  doc: unknown;
  quality: unknown;
  createdBy: string;
}): Promise<StoredPlan> {
  const prev = await db.authoringPlan.findUnique({
    where: {
      courseSlug_level_refSlug: {
        courseSlug: input.courseSlug,
        level: input.level,
        refSlug: input.refSlug,
      },
    },
    select: { version: true },
  });
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
    },
    update: {
      doc: input.doc as Prisma.InputJsonValue,
      quality: input.quality as Prisma.InputJsonValue,
      version: (prev?.version ?? 0) + 1,
      status: 'DRAFT', // sinh lại → phải duyệt lại (context cấp dưới có thể đã đổi)
      approvedBy: null,
      approvedAt: null,
    },
    select: {
      level: true,
      refSlug: true,
      doc: true,
      status: true,
      version: true,
      quality: true,
      approvedBy: true,
    },
  });
  return toStored(r);
}

export async function getPlan(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
): Promise<StoredPlan | null> {
  const r = await db.authoringPlan.findUnique({
    where: { courseSlug_level_refSlug: { courseSlug, level, refSlug } },
    select: {
      level: true,
      refSlug: true,
      doc: true,
      status: true,
      version: true,
      quality: true,
      approvedBy: true,
    },
  });
  return r ? toStored(r) : null;
}

/** Mọi kế hoạch của một khoá (để UI dựng cây trạng thái). */
export async function listPlans(courseSlug: string): Promise<readonly StoredPlan[]> {
  const rows = await db.authoringPlan.findMany({
    where: { courseSlug },
    select: {
      level: true,
      refSlug: true,
      doc: true,
      status: true,
      version: true,
      quality: true,
      approvedBy: true,
    },
  });
  return rows.map(toStored);
}

/** DUYỆT một kế hoạch. Trả null nếu chưa có bản nháp để duyệt. */
export async function approvePlan(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
  approvedBy: string,
): Promise<StoredPlan | null> {
  const existing = await getPlan(courseSlug, level, refSlug);
  if (!existing) return null;
  const r = await db.authoringPlan.update({
    where: { courseSlug_level_refSlug: { courseSlug, level, refSlug } },
    data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    select: {
      level: true,
      refSlug: true,
      doc: true,
      status: true,
      version: true,
      quality: true,
      approvedBy: true,
    },
  });
  return toStored(r);
}

/** Cấp cha đã duyệt chưa — cổng chặn sinh cấp con. */
export async function isApproved(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
): Promise<boolean> {
  const p = await getPlan(courseSlug, level, refSlug);
  return p?.status === 'APPROVED';
}
