// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Data access cho knowledge-engine (server-only). Map bảng Prisma ↔ kiểu engine.
 * Repo THUẦN data — logic đo lường ở @bingoo.ai/knowledge-engine (service gọi).
 */

import { db } from '@bingoo.ai/db'
import type {
  EvidenceInput,
  GraphData,
  SelectionTrace,
  SkillEdge,
  SkillMastery,
  SkillNode,
  Slug,
} from '@bingoo.ai/knowledge-engine'

/** Đọc toàn bộ Competency + CapabilityRelation → GraphData (slug-keyed). */
export async function loadGraphData(): Promise<GraphData> {
  const [nodes, edges] = await Promise.all([
    db.competency.findMany({
      select: {
        slug: true,
        title: true,
        kind: true,
        level: true,
        // Nhãn báo cáo. Engine KHÔNG quyết định gì theo hai trường này — nhưng các mặt đọc
        // (gapReport) mang chúng ra cho người dùng, và bỏ khỏi select thì chúng lặng lẽ thành
        // null suốt: kiểu vẫn hợp lệ, test engine vẫn xanh, chỉ màn hình là trống.
        stage: true,
        strand: true,
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
    ...(n.stage != null ? { stage: n.stage } : {}),
    ...(n.strand != null ? { strand: n.strand } : {}),
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

/**
 * Slug các objective của một khung, tuỳ chọn lọc theo bậc.
 *
 * Lọc theo bậc là một TRUY VẤN, không phải một nhánh trong engine. `stage` là nhãn riêng của
 * từng khung ("Lớp 3", "A2", "buổi-7"), so bằng chuỗi và không được diễn giải ở đâu cả — đó
 * là điều giữ cho cùng một đường mã chạy được với khung chia theo lớp lẫn khung chia theo bậc.
 */
export async function loadFrameworkObjectiveSlugs(
  frameworkSlug: string,
  stage?: string,
): Promise<Slug[] | null> {
  const fw = await db.framework.findUnique({ where: { slug: frameworkSlug }, select: { id: true } })
  if (!fw) return null
  const rows = await db.competency.findMany({
    where: {
      frameworkId: fw.id,
      kind: 'OBJECTIVE',
      ...(stage === undefined ? {} : { stage }),
    },
    select: { slug: true },
    orderBy: { slug: 'asc' },
  })
  return rows.map((r) => r.slug)
}

/** Các nhãn bậc một khung thực sự dùng — để giao diện dựng bộ lọc mà không đoán. */
export async function loadFrameworkStages(frameworkSlug: string): Promise<string[]> {
  const fw = await db.framework.findUnique({ where: { slug: frameworkSlug }, select: { id: true } })
  if (!fw) return []
  const rows = await db.competency.findMany({
    where: { frameworkId: fw.id, kind: 'OBJECTIVE', stage: { not: null } },
    select: { stage: true },
    distinct: ['stage'],
    orderBy: { stage: 'asc' },
  })
  return rows.flatMap((r) => (r.stage == null ? [] : [r.stage]))
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

/**
 * Ghi nhật ký một lượt chọn phiên.
 *
 * `origin` mặc định LEARNER và người gọi phải nói khác đi nếu muốn khác — dữ liệu mô phỏng
 * lẫn vào lane người thật là hỏng cả về sau, nên mặc định phải là cái an toàn khi ai đó quên.
 */
export async function saveSelectionTrace(
  userId: string,
  trace: SelectionTrace,
  origin: 'LEARNER' | 'SIMULATION' = 'LEARNER',
): Promise<void> {
  await db.selectionTrace.create({
    data: {
      userId,
      origin,
      policy: trace.policy,
      size: trace.size,
      exploreN: trace.exploreN,
      daySeed: trace.daySeed,
      offered: trace.offered,
      eligible: trace.eligible,
      // Trải thành object thuần: kiểu Json của Prisma không nhận thuộc tính readonly.
      considered: trace.considered.map((c) => ({
        key: c.key,
        score: c.score,
        bucket: c.bucket,
        rank: c.rank,
        picked: c.picked,
      })),
      picked: [...trace.picked],
    },
  })
}
