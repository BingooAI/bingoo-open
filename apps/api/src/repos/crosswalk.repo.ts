// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * CROSSWALK + GAP giữa hai khung — join qua KC NỀN CHUNG, KHÔNG qua cạnh objective↔objective.
 *
 * Repo cấm nối objective của khung này sang objective khung kia (authoring.repo.ts:387): "trùng" là
 * dữ liệu sai. Mô hình đúng: mọi objective của MỌI khung MAPS_TO cùng một vốn KC nền. Nên:
 *   • TRÙNG (overlap)  = KC mà objective CẢ HAI khung cùng trỏ về.
 *   • THIẾU (gap) khi chuyển A→B = objective của B mà KC nó đòi CHƯA nằm trong vốn KC người học có
 *     (nắm được nhờ học theo A). Đây chính là `FrameworkReport` mà contracts đã khai (framework.ts)
 *     nhưng chưa ai hiện thực — "báo cáo tính theo KC nền, không dịch hồ sơ" (profile.ts).
 *
 * Một hàm lõi `frameworkReport(có sẵn KC nào, khung đích)` phục vụ CẢ HAI:
 *   • Người DẠY xem đối chiếu khung A↔B: "có sẵn" = toàn bộ KC khung A phủ (học trọn A).
 *   • Người HỌC chuyển khung: "có sẵn" = KC người học ĐÃ NẮM thật (SkillState ≥ ngưỡng).
 * `achieved` = mọi KC objective đòi đều có (certify dùng AND); `partial` = có vài; `none` = không có.
 */

import { db } from '@bingoo.ai/db'
import { deriveKcStrands } from './strand'

const enTitle = (t: unknown, fallback: string): string => {
  const o = t as Record<string, string> | null
  return o ? (o.vi ?? o.en ?? Object.values(o)[0] ?? fallback) : fallback
}

export type GapStatus = 'achieved' | 'partial' | 'none'

export interface CrosswalkObjective {
  readonly slug: string
  readonly code?: string
  readonly title: string
  /** KC nền objective này chứng nhận. */
  readonly requires: readonly string[]
}

export interface CrosswalkKc {
  readonly slug: string
  readonly title: string
  readonly kind: string
  readonly strand?: string
  readonly facets?: Record<string, unknown>
  /** Khung nào phủ KC này: 'both' (trùng) · 'a' · 'b'. */
  readonly side: 'both' | 'a' | 'b'
}

export interface CrosswalkEdge {
  readonly from: string
  readonly to: string
  readonly relType: string
}

export interface ObjectiveGap {
  readonly slug: string
  readonly code?: string
  readonly title: string
  readonly requires: readonly string[]
  /** KC objective đòi mà NGƯỜI HỌC ĐÃ CÓ. */
  readonly have: readonly string[]
  /** KC còn THIẾU — chính là việc phải học khi chuyển sang khung này. */
  readonly missing: readonly string[]
  readonly status: GapStatus
}

/** Một khung đọc qua vốn KC người học có — projection, tính theo yêu cầu, không lưu (framework.ts). */
export interface FrameworkReport {
  readonly frameworkSlug: string
  readonly frameworkName: string
  readonly objectives: readonly ObjectiveGap[]
  readonly summary: {
    readonly achieved: number
    readonly partial: number
    readonly none: number
    readonly total: number
    /** % objective ĐẠT (mọi KC có) — thước nhanh cho người học. */
    readonly percent: number
  }
}

export interface CrosswalkReport {
  readonly a: {
    readonly slug: string
    readonly name: string
    readonly objectives: readonly CrosswalkObjective[]
  }
  readonly b: {
    readonly slug: string
    readonly name: string
    readonly objectives: readonly CrosswalkObjective[]
  }
  readonly kcs: readonly CrosswalkKc[]
  /** KC cả hai khung cùng phủ (TRÙNG). */
  readonly sharedKcs: readonly string[]
  /** objective→KC (cả hai khung) + KC→KC tiên quyết — cho đồ thị. */
  readonly edges: readonly CrosswalkEdge[]
  /** Chuyển A→B: objective của B đọc qua vốn KC của A (THIẾU gì). */
  readonly aToB: FrameworkReport
  /** Chuyển B→A: objective của A đọc qua vốn KC của B. */
  readonly bToA: FrameworkReport
}

interface FrameworkKcMap {
  readonly slug: string
  readonly name: string
  readonly objectives: readonly CrosswalkObjective[]
  /** KC objectives của khung này phủ (union). */
  readonly kcSet: ReadonlySet<string>
  /** objSlug → KC slugs. */
  readonly requiresByObj: ReadonlyMap<string, readonly string[]>
  /** id KC → slug (dùng để nạp strand/prereq). */
  readonly kcIds: readonly string[]
  readonly kcStrandById: ReadonlyMap<string, string>
}

/** Nạp một khung + objectives + MAPS_TO xuống KC nền. */
async function loadFrameworkKcMap(slug: string): Promise<FrameworkKcMap | null> {
  const fw = await db.framework.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      objectives: { select: { id: true, slug: true, code: true, title: true, strand: true } },
    },
  })
  if (!fw) return null

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
    select: { id: true, slug: true },
  })
  const kcSlugById = new Map(kcRows.map((k) => [k.id, k.slug]))
  const objSlugById = new Map(fw.objectives.map((o) => [o.id, o.slug]))

  const requiresByObj = new Map<string, string[]>()
  for (const m of mapsTo) {
    const o = objSlugById.get(m.fromId)
    const k = kcSlugById.get(m.toId)
    if (o && k) requiresByObj.set(o, [...(requiresByObj.get(o) ?? []), k])
  }

  const kcStrand = deriveKcStrands(
    fw.objectives.map((o) => ({ id: o.id, strand: o.strand })),
    mapsTo,
  )
  const kcStrandById = new Map<string, string>()
  for (const id of kcIds) {
    const s = kcStrand.get(id)
    if (s) kcStrandById.set(id, s)
  }

  return {
    slug: fw.slug,
    name: enTitle(fw.name, fw.slug),
    objectives: fw.objectives.map((o) => ({
      slug: o.slug,
      ...(o.code ? { code: o.code } : {}),
      title: enTitle(o.title, o.slug),
      requires: requiresByObj.get(o.slug) ?? [],
    })),
    kcSet: new Set(kcSlugById.values()),
    requiresByObj,
    kcIds,
    kcStrandById,
  }
}

/**
 * Đọc một khung qua vốn KC người học ĐÃ CÓ → mỗi objective đạt/thiếu gì.
 * `achieved` chỉ khi CÓ ĐỦ mọi KC nó đòi (certify dùng AND — thiếu một mắt xích là chưa đạt).
 */
export function frameworkReport(mastered: ReadonlySet<string>, target: FrameworkKcMap): FrameworkReport {
  const objectives: ObjectiveGap[] = target.objectives.map((o) => {
    const requires = o.requires
    const have = requires.filter((k) => mastered.has(k))
    const missing = requires.filter((k) => !mastered.has(k))
    const status: GapStatus =
      requires.length > 0 && have.length === requires.length
        ? 'achieved'
        : have.length > 0
          ? 'partial'
          : 'none'
    return {
      slug: o.slug,
      ...(o.code ? { code: o.code } : {}),
      title: o.title,
      requires,
      have,
      missing,
      status,
    }
  })
  const achieved = objectives.filter((o) => o.status === 'achieved').length
  const partial = objectives.filter((o) => o.status === 'partial').length
  const none = objectives.filter((o) => o.status === 'none').length
  const total = objectives.length
  return {
    frameworkSlug: target.slug,
    frameworkName: target.name,
    objectives,
    summary: {
      achieved,
      partial,
      none,
      total,
      percent: total > 0 ? Math.round((achieved / total) * 100) : 0,
    },
  }
}

/** Đối chiếu HAI khung: KC trùng, và THIẾU gì khi chuyển mỗi chiều (người DẠY xem). */
export async function getCrosswalk(aSlug: string, bSlug: string): Promise<CrosswalkReport | null> {
  const [a, b] = await Promise.all([loadFrameworkKcMap(aSlug), loadFrameworkKcMap(bSlug)])
  if (!a || !b) return null

  const shared = [...a.kcSet].filter((k) => b.kcSet.has(k))
  const allKcIds = [...new Set([...a.kcIds, ...b.kcIds])]
  const kcRows = await db.competency.findMany({
    where: { id: { in: allKcIds.length ? allKcIds : ['-'] } },
    select: { id: true, slug: true, title: true, kind: true, facets: true, strand: true },
  })
  const sharedSet = new Set(shared)
  const kcs: CrosswalkKc[] = kcRows.map((k) => {
    const side: CrosswalkKc['side'] = sharedSet.has(k.slug) ? 'both' : a.kcSet.has(k.slug) ? 'a' : 'b'
    const strand = a.kcStrandById.get(k.id) ?? b.kcStrandById.get(k.id) ?? k.strand ?? undefined
    return {
      slug: k.slug,
      title: enTitle(k.title, k.slug),
      kind: k.kind,
      side,
      ...(strand ? { strand } : {}),
      ...(k.facets ? { facets: k.facets as Record<string, unknown> } : {}),
    }
  })

  // Cạnh: objective→KC (cả hai khung) + KC→KC tiên quyết trong union (để đồ thị thấy lộ trình).
  const slugById = new Map(kcRows.map((k) => [k.id, k.slug]))
  const ordering = allKcIds.length
    ? await db.capabilityRelation.findMany({
        where: { fromId: { in: allKcIds }, toId: { in: allKcIds }, relType: { not: 'MAPS_TO' } },
        select: { fromId: true, toId: true, relType: true },
      })
    : []
  const edges: CrosswalkEdge[] = [
    ...[...a.requiresByObj].flatMap(([o, ks]) => ks.map((k) => ({ from: o, to: k, relType: 'MAPS_TO' }))),
    ...[...b.requiresByObj].flatMap(([o, ks]) => ks.map((k) => ({ from: o, to: k, relType: 'MAPS_TO' }))),
    ...ordering.flatMap((e) => {
      const from = slugById.get(e.fromId)
      const to = slugById.get(e.toId)
      return from && to ? [{ from, to, relType: e.relType }] : []
    }),
  ]

  return {
    a: { slug: a.slug, name: a.name, objectives: a.objectives },
    b: { slug: b.slug, name: b.name, objectives: b.objectives },
    kcs,
    sharedKcs: shared,
    edges,
    aToB: frameworkReport(a.kcSet, b),
    bToA: frameworkReport(b.kcSet, a),
  }
}

/** Người HỌC chuyển sang một khung: đọc khung đó qua KC người học ĐÃ NẮM (SkillState ≥ ngưỡng). */
export async function getLearnerFrameworkReport(
  userId: string,
  targetSlug: string,
  threshold = 0.7,
): Promise<FrameworkReport | null> {
  const target = await loadFrameworkKcMap(targetSlug)
  if (!target) return null
  const states = await db.skillState.findMany({
    where: { userId, skillSlug: { in: [...target.kcSet] }, pKnown: { gte: threshold } },
    select: { skillSlug: true },
  })
  return frameworkReport(new Set(states.map((s) => s.skillSlug)), target)
}
