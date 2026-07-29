// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Lưu KẾ HOẠCH PHÂN CẤP (Khoá/Unit/Bài) + trạng thái DUYỆT. Bảng `authoring_plan`, khoá
 * (courseSlug, level, refSlug). Đây là nơi giữ CỔNG: cấp con chỉ sinh khi cấp cha đã APPROVED.
 */

import { db, type Prisma } from '@bingoo.ai/db'

export type PlanLevel = 'course' | 'unit' | 'lesson'

/**
 * Những cấp NẰM DƯỚI một cấp — thuần, để kiểm được mà không cần kho.
 *
 * Sinh lại khoá làm mất hiệu lực mọi chương và mọi bài. Sinh lại một chương chỉ chạm các bài CỦA
 * CHÍNH nó — hạ luôn bài của chương khác là phạt oan việc người ta chưa hề đụng tới.
 */
export function descendantsOf(
  tree: readonly { unit: string; lessons: readonly string[] }[],
  level: PlanLevel,
  refSlug: string,
): { level: PlanLevel; refSlug: string }[] {
  if (level === 'lesson') return [] // bài là cấp cuối
  if (level === 'course') {
    return [
      ...tree.map((u) => ({ level: 'unit' as const, refSlug: u.unit })),
      ...tree.flatMap((u) => u.lessons.map((l) => ({ level: 'lesson' as const, refSlug: l }))),
    ]
  }
  const own = tree.find((u) => u.unit === refSlug)?.lessons ?? []
  return own.map((l) => ({ level: 'lesson' as const, refSlug: l }))
}

/**
 * Bài nào thuộc chương nào — đọc từ chính vỏ khoá, vì bảng kế hoạch không giữ quan hệ cha-con.
 *
 * Kế hoạch được khoá bằng (khoá, cấp, slug) và ba cấp nằm phẳng cạnh nhau; cấu trúc cây chỉ tồn tại
 * trong vỏ khoá. Nên mọi câu hỏi về cha-con đều phải hỏi vỏ khoá, không suy từ bảng này ra được.
 */
async function courseTree(courseSlug: string): Promise<{ unit: string; lessons: string[] }[]> {
  const row = await db.course.findUnique({ where: { slug: courseSlug }, select: { plan: true } })
  const plan = row?.plan as { units?: { slug?: string; lessons?: { slug?: string }[] }[] } | null
  return (plan?.units ?? []).map((u) => ({
    unit: u.slug ?? '',
    lessons: (u.lessons ?? []).map((l) => l.slug ?? '').filter(Boolean),
  }))
}

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

/**
 * Lưu/ghi đè một kế hoạch. Sinh lại → bump version, về DRAFT, VÀ gỡ dấu duyệt của MỌI CẤP DƯỚI.
 *
 * Phần cuối là chỗ trước đây thiếu, dù chính chú thích cũ đã nêu lý do: "sinh lại thì phải duyệt
 * lại (context cấp dưới có thể đã đổi)". Nó chỉ hạ đúng bản ghi đang ghi, còn cấp dưới đứng nguyên.
 *
 * Đo được trên kho: duyệt đủ ba cấp, rồi sinh lại kế hoạch KHOÁ với nội dung khác hẳn — khoá về
 * bản nháp, còn chương và bài vẫn "đã duyệt", cho một ngữ cảnh không còn tồn tại. Tệ hơn: trạng
 * thái đã-duyệt của chương chính là CỔNG cho phép sinh kế hoạch bài, nên bài mới tiếp tục được
 * sinh ra từ một cánh cổng mở bằng thứ vừa bị thay.
 */
export async function savePlan(input: {
  courseSlug: string
  level: PlanLevel
  refSlug: string
  doc: unknown
  quality: unknown
  createdBy: string
  /** PROVENANCE: model + prompt (id + hash template hiệu lực) đã sinh bản doc này. */
  provenance?: { aiModel?: string; promptId?: string; promptHash?: string }
}): Promise<StoredPlan & { readonly invalidated: readonly string[] }> {
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

  // Cấp dưới được duyệt DỰA TRÊN bản vừa bị thay — nên con dấu của chúng không còn mô tả gì.
  // Chỉ gỡ khi thật sự có ghi đè: lần tạo đầu tiên không có gì bên dưới để làm mất hiệu lực.
  const invalidated = prev === null ? [] : await invalidateBelow(input.courseSlug, input.level, input.refSlug)
  return { ...toStored(r), invalidated }
}

/**
 * Hạ mọi kế hoạch CẤP DƯỚI về bản nháp. Trả về danh sách đã hạ, để chỗ gọi còn nói cho người soạn.
 *
 * Chỉ chạm bản ghi đang APPROVED — hạ một bản đã là nháp thì không có gì thay đổi mà lại đếm lên,
 * và một con số phồng lên là một con số không tin được.
 */
async function invalidateBelow(courseSlug: string, level: PlanLevel, refSlug: string): Promise<string[]> {
  const targets = descendantsOf(await courseTree(courseSlug), level, refSlug)
  if (targets.length === 0) return []

  const hit = await db.authoringPlan.findMany({
    where: { courseSlug, status: 'APPROVED', OR: targets },
    select: { level: true, refSlug: true },
  })
  if (hit.length === 0) return []
  await db.authoringPlan.updateMany({
    where: { courseSlug, status: 'APPROVED', OR: targets },
    data: { status: 'DRAFT', approvedBy: null, approvedAt: null },
  })
  return hit.map((h) => `${h.level}:${h.refSlug}`)
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

export type ApproveFailure = 'not-found' | 'parent-not-approved'

/**
 * DUYỆT một kế hoạch — và CẤP CHA phải đã duyệt trước.
 *
 * Cổng cha-trước-con vốn chỉ chặn lúc SINH, không chặn lúc DUYỆT. Đo được: khi kế hoạch khoá còn là
 * bản nháp, vẫn duyệt được kế hoạch chương bình thường. Nghĩa là thứ tự duyệt đảo được, và một
 * chương "đã duyệt" có thể đứng trên một khoá chưa ai đọc — trong khi chính con dấu của chương ấy
 * là thứ mở cổng cho các bài bên dưới.
 */
export async function approvePlan(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
  approvedBy: string,
): Promise<StoredPlan | ApproveFailure> {
  const existing = await getPlan(courseSlug, level, refSlug)
  if (!existing) return 'not-found'

  if (level !== 'course') {
    const parent =
      level === 'unit'
        ? { level: 'course' as const, refSlug: courseSlug }
        : {
            level: 'unit' as const,
            refSlug: (await courseTree(courseSlug)).find((u) => u.lessons.includes(refSlug))?.unit ?? '',
          }
    if (!(await isApproved(courseSlug, parent.level, parent.refSlug))) return 'parent-not-approved'
  }
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
