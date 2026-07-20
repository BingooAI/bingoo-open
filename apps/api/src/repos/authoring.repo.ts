// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Data access cho authoring — bền hoá kết quả biên soạn (GraphData) xuống đồ thị năng lực.
 * Cầu: @bingoo.ai/authoring compile → db (Competency + CapabilityRelation) → engine đọc lại.
 */

import { db, type Prisma } from '@bingoo.ai/db'
import type { CompiledObjective, ExistingConcept, ExistingKc } from '@bingoo.ai/authoring'
import type { CompetencyKind, FrameworkKind, GraphData, SkillNode } from '@bingoo.ai/knowledge-engine'
import type { DomainProfile, Facets } from '@bingoo.ai/facets'
import { deriveKcStrands } from './strand'

export interface PersistResult {
  readonly nodes: number
  readonly edges: number
}

export interface FrameworkMeta {
  readonly slug: string
  readonly name: Readonly<Record<string, string>>
  readonly kind: FrameworkKind
  readonly locale: string
}

export interface FrameworkPersistResult {
  readonly frameworkVersionId: string
  readonly objectives: number
  readonly mapsTo: number
}

/**
 * Bền hoá Framework + 1 FrameworkVersion (DRAFT) + objectives (Competency kind=OBJECTIVE ghim
 * frameworkVersionId — B4) + cạnh MAPS_TO objective→competency. Idempotent theo slug.
 */
export async function persistFramework(
  fw: FrameworkMeta,
  objectives: readonly CompiledObjective[],
): Promise<FrameworkPersistResult> {
  const name = fw.name as Prisma.InputJsonValue
  const framework = await db.framework.upsert({
    where: { slug: fw.slug },
    create: { slug: fw.slug, name, kind: fw.kind, locale: fw.locale },
    update: { name, kind: fw.kind, locale: fw.locale },
  })

  // Mỗi lần áp = một bản phát hành mới (DRAFT); patch = số bản hiện có (unique major.minor.patch).
  const count = await db.frameworkVersion.count({ where: { frameworkId: framework.id } })
  const version = await db.frameworkVersion.create({
    data: {
      frameworkId: framework.id,
      major: 1,
      minor: 0,
      patch: count,
      releaseType: 'MAJOR',
      status: 'DRAFT',
    },
  })

  for (const o of objectives) {
    const title = o.title as Prisma.InputJsonValue
    const data = {
      kind: 'OBJECTIVE' as CompetencyKind,
      title,
      ...(o.code !== undefined ? { code: o.code } : {}),
      frameworkId: framework.id,
      frameworkVersionId: version.id,
    }
    await db.competency.upsert({
      where: { slug: o.slug },
      create: { slug: o.slug, ...data },
      update: data,
    })
  }

  // MAPS_TO: objective → từng competency đích. Giải slug → id một lượt.
  const slugs = new Set<string>()
  for (const o of objectives) {
    slugs.add(o.slug)
    for (const t of o.mapsTo) slugs.add(t)
  }
  const rows = await db.competency.findMany({
    where: { slug: { in: [...slugs] } },
    select: { id: true, slug: true },
  })
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]))

  let mapsTo = 0
  for (const o of objectives) {
    const fromId = idBySlug.get(o.slug)
    if (!fromId) continue
    for (const t of o.mapsTo) {
      const toId = idBySlug.get(t)
      if (!toId) continue
      // REQUIRED (không phải RECOMMENDED): đạt objective = AND trên mọi KC nó chứng nhận.
      // Nếu để RECOMMENDED, certify sẽ lấy TRUNG BÌNH → "đạt" khi còn thiếu mắt xích (bất biến I4).
      await db.capabilityRelation.upsert({
        where: { fromId_toId_relType: { fromId, toId, relType: 'MAPS_TO' } },
        create: { fromId, toId, relType: 'MAPS_TO', mode: 'REQUIRED' },
        update: { mode: 'REQUIRED' },
      })
      mapsTo++
    }
  }

  return { frameworkVersionId: version.id, objectives: objectives.length, mapsTo }
}

// ── Quản lý Framework (list / detail / graph / version) ──────────────────────

export interface FrameworkListItem {
  readonly slug: string
  readonly name: unknown
  readonly kind: string
  readonly locale: string
  readonly versions: number
  readonly objectives: number
  readonly updatedAt: Date
}

export async function listFrameworks(): Promise<FrameworkListItem[]> {
  const rows = await db.framework.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      slug: true,
      name: true,
      kind: true,
      locale: true,
      updatedAt: true,
      _count: { select: { versions: true, objectives: true } },
    },
  })
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    locale: r.locale,
    versions: r._count.versions,
    objectives: r._count.objectives,
    updatedAt: r.updatedAt,
  }))
}

export interface FrameworkVersionItem {
  readonly id: string
  readonly semver: string
  readonly status: string
  readonly publishedAt: Date | null
  readonly createdAt: Date
  readonly objectives: number
}

export interface FrameworkDetail {
  readonly slug: string
  readonly name: unknown
  readonly kind: string
  readonly locale: string
  readonly versions: readonly FrameworkVersionItem[]
  readonly objectives: readonly {
    slug: string
    title: unknown
    code: string | null
    versionId: string | null
  }[]
}

export async function getFrameworkDetail(slug: string): Promise<FrameworkDetail | null> {
  const fw = await db.framework.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      kind: true,
      locale: true,
      versions: {
        orderBy: [{ major: 'desc' }, { minor: 'desc' }, { patch: 'desc' }],
        select: {
          id: true,
          major: true,
          minor: true,
          patch: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          _count: { select: { objectives: true } },
        },
      },
      objectives: {
        select: { slug: true, title: true, code: true, frameworkVersionId: true },
        orderBy: { slug: 'asc' },
      },
    },
  })
  if (!fw) return null
  return {
    slug: fw.slug,
    name: fw.name,
    kind: fw.kind,
    locale: fw.locale,
    versions: fw.versions.map((v) => ({
      id: v.id,
      semver: `${v.major}.${v.minor}.${v.patch}`,
      status: v.status,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
      objectives: v._count.objectives,
    })),
    objectives: fw.objectives.map((o) => ({
      slug: o.slug,
      title: o.title,
      code: o.code,
      versionId: o.frameworkVersionId,
    })),
  }
}

export interface GraphView {
  readonly nodes: { id: string; slug: string; title: unknown; kind: string }[]
  readonly edges: { from: string; to: string; relType: string; mode: string }[]
}

/**
 * Đồ thị của MỘT framework: objectives + các năng lực chúng MAPS_TO, cùng mọi quan hệ giữa các node đó.
 * Đủ để vẽ: thấy mục tiêu neo vào KC nào và KC nào tiên quyết KC nào.
 */
export async function getFrameworkGraph(slug: string): Promise<GraphView | null> {
  const fw = await db.framework.findUnique({
    where: { slug },
    select: { objectives: { select: { id: true } } },
  })
  if (!fw) return null

  const objIds = fw.objectives.map((o) => o.id)
  const mapsTo = objIds.length
    ? await db.capabilityRelation.findMany({
        where: { fromId: { in: objIds }, relType: 'MAPS_TO' },
        select: { fromId: true, toId: true },
      })
    : []

  const ids = [...new Set([...objIds, ...mapsTo.map((m) => m.toId)])]
  if (ids.length === 0) return { nodes: [], edges: [] }

  const [nodes, rels] = await Promise.all([
    db.competency.findMany({
      where: { id: { in: ids } },
      // `strand` = MẠCH kiến thức. Nó là thứ duy nhất cho phép gom nhóm/thu gọn đồ thị — không có nó
      // thì một khung thật (289 mục tiêu) chỉ hiện ra được dưới dạng một đám chỉ rối.
      select: { id: true, slug: true, title: true, kind: true, strand: true },
    }),
    db.capabilityRelation.findMany({
      where: { fromId: { in: ids }, toId: { in: ids } },
      select: { fromId: true, toId: true, relType: true, mode: true },
    }),
  ])

  const slugById = new Map(nodes.map((n) => [n.id, n.slug]))

  // MẠCH ĐỂ GOM NHÓM: KC lấy strand TỪ objective map vào nó (objective mang strand nguyên văn của
  // chương trình), KHÔNG dùng strand thô mà bộ trích đoán cho KC. Objective giữ strand của chính nó.
  // Không có bước này thì mọi KC dồn về một mạch "number" → thu gọn đồ thị vô nghĩa.
  const objStrands = nodes.filter((n) => n.kind === 'OBJECTIVE').map((n) => ({ id: n.id, strand: n.strand }))
  const kcStrand = deriveKcStrands(objStrands, mapsTo)

  return {
    nodes: nodes.map((n) => {
      const strand = n.kind === 'OBJECTIVE' ? n.strand : (kcStrand.get(n.id) ?? n.strand)
      return {
        id: n.id,
        slug: n.slug,
        title: n.title,
        kind: n.kind,
        ...(strand ? { strand } : {}),
      }
    }),
    edges: rels.flatMap((r) => {
      const from = slugById.get(r.fromId)
      const to = slugById.get(r.toId)
      return from && to ? [{ from, to, relType: r.relType, mode: r.mode }] : []
    }),
  }
}

/** Tạo bản phát hành MỚI (DRAFT) cho framework — bump theo `release`. */
export async function createFrameworkVersion(
  slug: string,
  release: 'MAJOR' | 'MINOR' | 'PATCH',
): Promise<FrameworkVersionItem | null> {
  const fw = await db.framework.findUnique({ where: { slug }, select: { id: true } })
  if (!fw) return null

  const latest = await db.frameworkVersion.findFirst({
    where: { frameworkId: fw.id },
    orderBy: [{ major: 'desc' }, { minor: 'desc' }, { patch: 'desc' }],
    select: { major: true, minor: true, patch: true },
  })
  const base = latest ?? { major: 1, minor: 0, patch: -1 }
  const next =
    release === 'MAJOR'
      ? { major: base.major + 1, minor: 0, patch: 0 }
      : release === 'MINOR'
        ? { major: base.major, minor: base.minor + 1, patch: 0 }
        : { major: base.major, minor: base.minor, patch: base.patch + 1 }

  const v = await db.frameworkVersion.create({
    data: { frameworkId: fw.id, ...next, releaseType: release, status: 'DRAFT' },
    select: {
      id: true,
      major: true,
      minor: true,
      patch: true,
      status: true,
      publishedAt: true,
      createdAt: true,
    },
  })
  return {
    id: v.id,
    semver: `${v.major}.${v.minor}.${v.patch}`,
    status: v.status,
    publishedAt: v.publishedAt,
    createdAt: v.createdAt,
    objectives: 0,
  }
}

/** Phát hành: DRAFT → PUBLISHED; các bản PUBLISHED cũ của cùng framework → DEPRECATED. */
export async function publishFrameworkVersion(
  versionId: string,
): Promise<{ published: string; deprecated: number } | null> {
  const v = await db.frameworkVersion.findUnique({
    where: { id: versionId },
    select: { id: true, frameworkId: true },
  })
  if (!v) return null

  const dep = await db.frameworkVersion.updateMany({
    where: { frameworkId: v.frameworkId, status: 'PUBLISHED', id: { not: v.id } },
    data: { status: 'DEPRECATED' },
  })
  await db.frameworkVersion.update({
    where: { id: v.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  })
  return { published: v.id, deprecated: dep.count }
}

// ── Truy hồi ứng viên cho ĐỐI CHIẾU khung ────────────────────────────────────

/**
 * Ứng viên KC để đối chiếu. Truy hồi CHÍNH bằng `facets.object` — vì `object` là thuật ngữ đã chuẩn
 * hoá, nó vừa CHÍNH XÁC vừa RẺ (không cần embedding): "addition" chỉ khớp "addition".
 * Khi khái niệm mới chưa khai object thì mới cần fallback (trigram/embedding) — xử ở service.
 */
export async function loadKcCandidates(scope: { subject?: string; object?: string }): Promise<ExistingKc[]> {
  const rows = await db.competency.findMany({
    where: {
      kind: { not: 'OBJECTIVE' },
      ...(scope.subject ? { subject: scope.subject } : {}),
      ...(scope.object ? { facets: { path: ['object'], equals: scope.object } } : {}),
    },
    select: { slug: true, title: true, subject: true, facets: true },
    take: 200,
  })
  return rows.map((r) => {
    const t = r.title as Record<string, string> | null
    return {
      slug: r.slug,
      title: t ? (t.en ?? Object.values(t)[0] ?? r.slug) : r.slug, // TIẾNG ANH LÀ GỐC
      ...(r.subject !== null ? { subject: r.subject } : {}),
      ...(r.facets !== null ? { facets: r.facets as Facets } : {}),
    }
  })
}

// ── Đầu vào cho CỔNG BẤT BIẾN ────────────────────────────────────────────────

/** Hồ sơ môn/ngành — DỮ LIỆU. Bất biến I8 đọc cái này; thêm môn không cần deploy. */
export async function loadDomainProfiles(): Promise<Record<string, DomainProfile>> {
  const rows = await db.domainProfile.findMany({
    select: { domain: true, requiredAxes: true, identityAxes: true, aliases: true },
  })
  const out: Record<string, DomainProfile> = {}
  for (const r of rows) {
    out[r.domain] = {
      domain: r.domain,
      requiredAxes: r.requiredAxes as DomainProfile['requiredAxes'],
      identityAxes: r.identityAxes as DomainProfile['identityAxes'],
      ...(r.aliases ? { aliases: r.aliases as DomainProfile['aliases'] } : {}),
    }
  }
  return out
}

/** Node đã có trong đồ thị — để I1 bắt TRÙNG ĐỊNH DANH với KC cũ, không chỉ trong lô đang ghi. */
export async function loadExistingNodes(): Promise<SkillNode[]> {
  const rows = await db.competency.findMany({
    select: {
      slug: true,
      title: true,
      kind: true,
      stage: true,
      strand: true,
      subject: true,
      facets: true,
    },
  })
  return rows.map((r) => ({
    slug: r.slug,
    title: (r.title ?? {}) as Record<string, string>,
    kind: r.kind as CompetencyKind,
    ...(r.stage !== null ? { stage: r.stage } : {}),
    ...(r.strand !== null ? { strand: r.strand } : {}),
    ...(r.subject !== null ? { subject: r.subject } : {}),
    ...(r.facets !== null ? { facets: r.facets as Record<string, unknown> } : {}),
  }))
}

/** Khái niệm đã có trong đồ thị — để bước biên soạn mới dedup, tránh tạo trùng (B5). */
export async function loadExistingConcepts(): Promise<ExistingConcept[]> {
  const rows = await db.competency.findMany({ select: { slug: true, title: true, kind: true } })
  return rows.map((r) => {
    const t = r.title as Record<string, string> | null
    const title = t ? (t.en ?? t.vi ?? Object.values(t)[0] ?? r.slug) : r.slug
    return { slug: r.slug, title, ...(r.kind ? { kind: r.kind as CompetencyKind } : {}) }
  })
}

export interface ConceptVocabItem {
  readonly slug: string
  readonly title: string
  readonly kind: string
  readonly stage: string | null
  readonly strand: string | null
}

/**
 * Vốn từ KC cho khâu sinh vỏ khoá.
 *
 * STAGE THUỘC VỀ OBJECTIVE, KHÔNG THUỘC KC. Cùng một KC ("add within 20") nằm ở Cambridge Stage 1
 * VÀ Lớp 1 Việt Nam — KC là canonical, trung lập với khung. Nên "KC của Stage 1" phải resolve qua:
 *     objective(framework, stage) --MAPS_TO--> KC
 * Lọc thẳng `Competency.stage` là sai khi có nhiều khung cùng trỏ vào một KC.
 */
export async function loadConceptVocab(scope?: {
  stage?: string
  frameworkSlug?: string
  strand?: string
}): Promise<ConceptVocabItem[]> {
  let slugFilter: string[] | undefined

  if (scope?.stage || scope?.frameworkSlug) {
    const objectives = await db.competency.findMany({
      where: {
        kind: 'OBJECTIVE',
        ...(scope.stage ? { stage: scope.stage } : {}),
        ...(scope.strand ? { strand: scope.strand } : {}),
        ...(scope.frameworkSlug ? { framework: { slug: scope.frameworkSlug } } : {}),
      },
      select: { id: true },
    })
    if (objectives.length === 0) return []

    const maps = await db.capabilityRelation.findMany({
      where: { fromId: { in: objectives.map((o) => o.id) }, relType: 'MAPS_TO' },
      select: { toId: true },
    })
    if (maps.length === 0) return []

    const targets = await db.competency.findMany({
      where: { id: { in: [...new Set(maps.map((m) => m.toId))] } },
      select: { slug: true },
    })
    slugFilter = targets.map((t) => t.slug)
    if (slugFilter.length === 0) return []
  }

  const rows = await db.competency.findMany({
    where: {
      kind: { not: 'OBJECTIVE' }, // vỏ khoá dạy KC, không "dạy" mục tiêu
      ...(slugFilter ? { slug: { in: slugFilter } } : {}),
    },
    select: { slug: true, title: true, kind: true, stage: true, strand: true },
    orderBy: { slug: 'asc' },
  })
  return rows.map((r) => {
    const t = r.title as Record<string, string> | null
    return {
      slug: r.slug,
      // TIẾNG ANH LÀ GỐC — hiển thị mới dịch.
      title: t ? (t.en ?? Object.values(t)[0] ?? r.slug) : r.slug,
      kind: r.kind,
      stage: r.stage,
      strand: r.strand,
    }
  })
}

/** Các stage đang có — đọc từ OBJECTIVE (nơi stage là thẩm quyền), để admin chọn khi tạo khoá. */
export async function listStages(): Promise<{ stage: string; objectives: number }[]> {
  const rows = await db.competency.groupBy({
    by: ['stage'],
    where: { stage: { not: null }, kind: 'OBJECTIVE' },
    _count: { _all: true },
  })
  return rows
    .filter((r): r is typeof r & { stage: string } => r.stage !== null)
    .map((r) => ({ stage: r.stage, objectives: r._count._all }))
    .sort((a, b) => a.stage.localeCompare(b.stage))
}

/**
 * Upsert nodes (theo slug) → nối parent → upsert cạnh (theo fromId,toId,relType).
 * Idempotent: chạy lại không tạo trùng. Slug là khoá bền (B5).
 */
export async function persistGraph(graph: GraphData): Promise<PersistResult> {
  // 1) upsert node (chưa nối parent)
  for (const n of graph.nodes) {
    const title = n.title as Prisma.InputJsonValue
    // stage/strand: KHÔNG phải trang trí — nhờ nó mới map được sách Stage 1 vào đúng phần khung Stage 1.
    const meta = {
      kind: n.kind,
      title,
      ...(n.level != null ? { level: n.level } : {}),
      ...(n.stage != null ? { stage: n.stage } : {}),
      ...(n.strand != null ? { strand: n.strand } : {}),
      ...(n.subject != null ? { subject: n.subject } : {}),
      ...(n.facets != null ? { facets: n.facets as Prisma.InputJsonValue } : {}),
    }
    await db.competency.upsert({
      where: { slug: n.slug },
      create: { slug: n.slug, ...meta },
      update: meta,
    })
  }

  // 2) slug → id
  const rows = await db.competency.findMany({
    where: { slug: { in: graph.nodes.map((n) => n.slug) } },
    select: { id: true, slug: true },
  })
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]))

  // 3) nối parent (taxonomy)
  for (const n of graph.nodes) {
    if (!n.parent) continue
    const parentId = idBySlug.get(n.parent)
    if (parentId) await db.competency.update({ where: { slug: n.slug }, data: { parentId } })
  }

  // 4) upsert cạnh
  let edges = 0
  for (const e of graph.edges) {
    const fromId = idBySlug.get(e.from)
    const toId = idBySlug.get(e.to)
    if (!fromId || !toId) continue
    const relType = e.relType ?? 'PREREQUISITE'
    await db.capabilityRelation.upsert({
      where: { fromId_toId_relType: { fromId, toId, relType } },
      create: {
        fromId,
        toId,
        relType,
        mode: e.mode,
        ...(e.weight != null ? { weight: e.weight } : {}),
      },
      update: { mode: e.mode, ...(e.weight != null ? { weight: e.weight } : {}) },
    })
    edges++
  }

  return { nodes: graph.nodes.length, edges }
}
