/**
 * Data access cho knowledge-engine (server-only). Map bảng Prisma ↔ kiểu engine.
 * Repo THUẦN data — logic đo lường ở @bingoo/knowledge-engine (service gọi).
 */

import { db } from '@bingoo/db'
import type {
  EvidenceInput,
  GraphData,
  SkillEdge,
  SkillMastery,
  SkillNode,
  Slug,
} from '@bingoo/knowledge-engine'

/** Đọc toàn bộ Competency + CapabilityRelation → GraphData (slug-keyed). */
export async function loadGraphData(): Promise<GraphData> {
  const [nodes, edges] = await Promise.all([
    db.competency.findMany({
      select: {
        slug: true,
        title: true,
        kind: true,
        level: true,
        parent: { select: { slug: true } },
      },
    }),
    db.capabilityRelation.findMany({
      select: {
        mode: true,
        relType: true,
        weight: true,
        from: { select: { slug: true } },
        to: { select: { slug: true } },
      },
    }),
  ])

  const skillNodes: SkillNode[] = nodes.map((n) => ({
    slug: n.slug,
    title: (n.title ?? {}) as Record<string, string>,
    kind: n.kind,
    ...(n.parent ? { parent: n.parent.slug } : {}),
    ...(n.level != null ? { level: n.level } : {}),
  }))

  const skillEdges: SkillEdge[] = edges.map((e) => ({
    from: e.from.slug,
    to: e.to.slug,
    mode: e.mode,
    relType: e.relType,
    ...(e.weight != null ? { weight: e.weight } : {}),
  }))

  return { nodes: skillNodes, edges: skillEdges }
}

/** SkillState của một học viên trên một KC → SkillMastery (hoặc undefined nếu chưa có). */
export async function getSkillState(userId: string, skillSlug: Slug): Promise<SkillMastery | undefined> {
  const row = await db.skillState.findUnique({
    where: { userId_skillSlug: { userId, skillSlug } },
  })
  if (!row) return undefined
  return {
    skill: row.skillSlug,
    pKnown: row.pKnown,
    ability: row.ability,
    attempts: row.attempts,
    correct: row.correct,
    lastSeenMs: row.lastSeenAt ? row.lastSeenAt.getTime() : null,
  }
}

/** Mọi SkillState của học viên → Map<slug,{pKnown}> cho rollup/frontier. */
export async function loadLearnerStates(userId: string): Promise<Map<Slug, { pKnown: number }>> {
  const rows = await db.skillState.findMany({
    where: { userId },
    select: { skillSlug: true, pKnown: true },
  })
  const out = new Map<Slug, { pKnown: number }>()
  for (const r of rows) out.set(r.skillSlug, { pKnown: r.pKnown })
  return out
}

/** Mọi SkillState (đầy đủ) → Map<slug, SkillMastery> cho sequencer (buildPriority/selectAdaptiveSession). */
export async function loadLearnerMastery(userId: string): Promise<Map<Slug, SkillMastery>> {
  const rows = await db.skillState.findMany({ where: { userId } })
  const out = new Map<Slug, SkillMastery>()
  for (const r of rows) {
    out.set(r.skillSlug, {
      skill: r.skillSlug,
      pKnown: r.pKnown,
      ability: r.ability,
      attempts: r.attempts,
      correct: r.correct,
      lastSeenMs: r.lastSeenAt ? r.lastSeenAt.getTime() : null,
    })
  }
  return out
}

/** Đã có Observation với attemptId này chưa (idempotency §9.1). */
export async function attemptExists(attemptId: string): Promise<boolean> {
  const row = await db.observation.findUnique({ where: { attemptId }, select: { id: true } })
  return row != null
}

/**
 * Bền hoá kết quả fold: upsert SkillState + ghi-thêm Observation (+ SkillSnapshot nếu lấy mẫu).
 * (Slice đầu: tuần tự; bản production bọc transaction Serializable + retry — SPEC §2.)
 */
export async function saveFold(
  userId: string,
  ev: EvidenceInput,
  state: SkillMastery,
  snapshot: boolean,
): Promise<void> {
  const lastSeenAt = state.lastSeenMs != null ? new Date(state.lastSeenMs) : null

  await db.skillState.upsert({
    where: { userId_skillSlug: { userId, skillSlug: state.skill } },
    create: {
      userId,
      skillSlug: state.skill,
      pKnown: state.pKnown,
      ability: state.ability,
      attempts: state.attempts,
      correct: state.correct,
      lastSeenAt,
    },
    update: {
      pKnown: state.pKnown,
      ability: state.ability,
      attempts: state.attempts,
      correct: state.correct,
      lastSeenAt,
    },
  })

  const outcome = ev.outcome ?? (ev.correct ? 1 : 0)
  await db.observation.create({
    data: {
      subjectType: 'LEARNER',
      subjectId: userId,
      userId,
      skillSlug: ev.skill,
      source: ev.source ?? 'QUIZ',
      outcome,
      confidence: ev.confidence ?? 1,
      mode: ev.mode ?? 'LEARN',
      itemKey: ev.itemKey ?? null,
      lang: ev.lang ?? null,
      latencyMs: ev.latencyMs ?? null,
      hintsUsed: ev.hintsUsed ?? null,
      retry: ev.retry ?? null,
      knowledgePointId: ev.knowledgePointId ?? null,
      attemptId: ev.attemptId ?? null,
    },
  })

  if (snapshot) {
    await db.skillSnapshot.create({
      data: { userId, skillSlug: state.skill, pKnown: state.pKnown, ability: state.ability },
    })
  }
}
