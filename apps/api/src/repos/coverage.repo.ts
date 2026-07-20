/**
 * ĐỘ PHỦ 2 CHIỀU — khung ↔ KC ↔ khoá học.
 *
 * KC là XƯƠNG SỐNG ở giữa. Phía trên: objective của khung MAPS_TO xuống KC. Phía dưới: bài học của
 * khoá teaches lên KC. Nhìn đủ hai chiều mới thấy được TÍNH CHẶT CHẼ:
 *   • objective KHÔNG được bài nào dạy   → học xong khoá vẫn KHÔNG đạt chuẩn (lỗ hổng chương trình)
 *   • KC được dạy mà KHÔNG objective nào chứng nhận → dạy thừa, không tính vào chuẩn nào
 *   • objective chỉ được phủ MỘT PHẦN    → nguy hiểm nhất: tưởng đạt mà không đạt (certify dùng AND)
 * Không có bức tranh này thì "khoá bám khung" chỉ là lời nói.
 */

import { db } from '@bingoo/db'
import type { CoursePlan } from '@bingoo/plans'
import { deriveKcStrands } from './strand'

export interface CoverageNode {
  readonly slug: string
  readonly title: string
  readonly kind: string
  readonly code?: string
  readonly stage?: string
  readonly facets?: Record<string, unknown>
  /** MẠCH kiến thức — để gom nhóm/thu gọn đồ thị khi khung lớn. */
  readonly strand?: string
}

export interface CoverageLesson {
  readonly slug: string
  readonly title: string
  readonly unit: string
  readonly teaches: readonly string[]
}

export interface CoverageEdge {
  readonly from: string
  readonly to: string
  readonly relType: string
}

export interface ObjectiveCoverage {
  readonly slug: string
  readonly code?: string
  readonly title: string
  /** KC mà objective này chứng nhận. */
  readonly requires: readonly string[]
  /** KC trong số đó ĐƯỢC khoá dạy. */
  readonly taught: readonly string[]
  /** certify dùng AND (MIN) → thiếu một mắt xích là KHÔNG đạt. */
  readonly status: 'full' | 'partial' | 'none'
}

export interface CoverageReport {
  readonly frameworkSlug: string
  readonly courseSlug: string
  readonly objectives: readonly CoverageNode[]
  readonly kcs: readonly CoverageNode[]
  readonly lessons: readonly CoverageLesson[]
  /** objective --MAPS_TO--> KC, và KC --PREREQUISITE/ENABLES/COMPOSES--> KC. */
  readonly edges: readonly CoverageEdge[]
  readonly objectiveCoverage: readonly ObjectiveCoverage[]
  /** KC được dạy nhưng KHÔNG objective nào chứng nhận. */
  readonly untetheredKcs: readonly string[]
  readonly summary: {
    readonly objectivesFull: number
    readonly objectivesPartial: number
    readonly objectivesNone: number
    readonly kcsTaught: number
    readonly kcsTotal: number
  }
}

const enTitle = (t: unknown, fallback: string): string => {
  const o = t as Record<string, string> | null
  return o ? (o.vi ?? o.en ?? Object.values(o)[0] ?? fallback) : fallback
}

export async function getCoverage(frameworkSlug: string, courseSlug: string): Promise<CoverageReport | null> {
  const [fw, course] = await Promise.all([
    db.framework.findUnique({
      where: { slug: frameworkSlug },
      select: {
        objectives: {
          select: {
            id: true,
            slug: true,
            title: true,
            code: true,
            stage: true,
            kind: true,
            strand: true,
          },
        },
      },
    }),
    db.course.findUnique({ where: { slug: courseSlug }, select: { plan: true } }),
  ])
  if (!fw || !course) return null

  const plan = course.plan as unknown as CoursePlan
  const lessons: CoverageLesson[] = plan.units.flatMap((u) =>
    u.lessons.map((l) => ({
      slug: l.slug,
      title: enTitle(l.title, l.slug),
      unit: enTitle(u.title, u.slug),
      teaches: [...l.teaches],
    })),
  )
  const taughtSet = new Set(lessons.flatMap((l) => l.teaches))

  // objective --MAPS_TO--> KC
  const objIds = fw.objectives.map((o) => o.id)
  const mapsTo = objIds.length
    ? await db.capabilityRelation.findMany({
        where: { fromId: { in: objIds }, relType: 'MAPS_TO' },
        select: { fromId: true, toId: true },
      })
    : []

  const kcIds = [...new Set(mapsTo.map((m) => m.toId))]
  const kcRows = await db.competency.findMany({
    where: { id: { in: kcIds.length ? kcIds : ['-'] } },
    select: { id: true, slug: true, title: true, kind: true, facets: true, strand: true },
  })
  const kcSlugById = new Map(kcRows.map((k) => [k.id, k.slug]))
  const objSlugById = new Map(fw.objectives.map((o) => [o.id, o.slug]))

  // Mạch của KC suy từ objective map vào nó (xem strand.ts) — dùng để gom nhóm/thu gọn đồ thị độ phủ.
  const kcStrand = deriveKcStrands(
    fw.objectives.map((o) => ({ id: o.id, strand: o.strand })),
    mapsTo,
  )

  // Quan hệ thứ tự giữa các KC (để thấy trình tự dạy có tôn trọng tiên quyết không).
  const ordering = kcIds.length
    ? await db.capabilityRelation.findMany({
        where: { fromId: { in: kcIds }, toId: { in: kcIds }, relType: { not: 'MAPS_TO' } },
        select: { fromId: true, toId: true, relType: true },
      })
    : []

  const edges: CoverageEdge[] = [
    ...mapsTo.flatMap((m) => {
      const from = objSlugById.get(m.fromId)
      const to = kcSlugById.get(m.toId)
      return from && to ? [{ from, to, relType: 'MAPS_TO' }] : []
    }),
    ...ordering.flatMap((e) => {
      const from = kcSlugById.get(e.fromId)
      const to = kcSlugById.get(e.toId)
      return from && to ? [{ from, to, relType: e.relType }] : []
    }),
  ]

  // Độ phủ từng objective — certify dùng AND, nên PARTIAL là nguy hiểm nhất.
  const requiresByObj = new Map<string, string[]>()
  for (const m of mapsTo) {
    const o = objSlugById.get(m.fromId)
    const k = kcSlugById.get(m.toId)
    if (o && k) requiresByObj.set(o, [...(requiresByObj.get(o) ?? []), k])
  }

  const objectiveCoverage: ObjectiveCoverage[] = fw.objectives.map((o) => {
    const requires = requiresByObj.get(o.slug) ?? []
    const taught = requires.filter((k) => taughtSet.has(k))
    const status: ObjectiveCoverage['status'] =
      requires.length > 0 && taught.length === requires.length
        ? 'full'
        : taught.length > 0
          ? 'partial'
          : 'none'
    return {
      slug: o.slug,
      ...(o.code ? { code: o.code } : {}),
      title: enTitle(o.title, o.slug),
      requires,
      taught,
      status,
    }
  })

  const certifiedKcs = new Set(mapsTo.map((m) => kcSlugById.get(m.toId)).filter(Boolean) as string[])
  const untetheredKcs = [...taughtSet].filter((k) => !certifiedKcs.has(k))

  return {
    frameworkSlug,
    courseSlug,
    objectives: fw.objectives.map((o) => ({
      slug: o.slug,
      title: enTitle(o.title, o.slug),
      kind: o.kind,
      ...(o.code ? { code: o.code } : {}),
      ...(o.stage ? { stage: o.stage } : {}),
      ...(o.strand ? { strand: o.strand } : {}),
    })),
    kcs: kcRows.map((k) => {
      // Mạch để gom nhóm: lấy TỪ objective map vào KC (nguyên văn chương trình), không dùng strand
      // thô của chính KC. Đồng bộ với đồ thị khung — cùng một KC phải cùng một mạch ở mọi màn.
      const strand = kcStrand.get(k.id) ?? k.strand ?? undefined
      return {
        slug: k.slug,
        title: enTitle(k.title, k.slug),
        kind: k.kind,
        ...(k.facets ? { facets: k.facets as Record<string, unknown> } : {}),
        ...(strand ? { strand } : {}),
      }
    }),
    lessons,
    edges,
    objectiveCoverage,
    untetheredKcs,
    summary: {
      objectivesFull: objectiveCoverage.filter((o) => o.status === 'full').length,
      objectivesPartial: objectiveCoverage.filter((o) => o.status === 'partial').length,
      objectivesNone: objectiveCoverage.filter((o) => o.status === 'none').length,
      kcsTaught: [...taughtSet].filter((k) => certifiedKcs.has(k)).length,
      kcsTotal: certifiedKcs.size,
    },
  }
}
