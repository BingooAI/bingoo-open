// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Knowledge engine service — nối @bingoo.ai/knowledge-engine với repo (db).
 * Đường nóng: ghi bằng chứng (fold) + đọc biên học (frontier). Cache graph 60s (SPEC §D).
 */

import {
  DEFAULT_POLICY,
  buildGraph,
  buildPriority,
  certifyFramework,
  compositeMastery,
  dueForReview,
  frontierComposite,
  freshMastery,
  gapReport,
  recordEvidence,
  selectAdaptiveSessionTraced,
  type Candidate,
  type CertifyObjective,
  type CertifyReport,
  type EvidenceInput,
  type FrontierNode,
  type GapReport,
  type RecordResult,
  type SessionContext,
  type SessionOpts,
  type SkillGraph,
  type Slug,
} from '@bingoo.ai/knowledge-engine'
import {
  attemptExists,
  getSkillState,
  loadFrameworkObjectiveSlugs,
  loadFrameworkStages,
  loadGraphData,
  loadLearnerMastery,
  loadLearnerStates,
  saveFold,
  saveSelectionTrace,
} from '../repos/knowledge.repo'
import { loadCandidates } from '../repos/content-item.repo'

// ── Cache đồ thị (SPEC §D.2) — dựng 1 lần, TTL ngắn ──────────────────────────
let graphCache: { graph: SkillGraph; at: number } | null = null
const GRAPH_TTL_MS = 60_000

async function getGraph(): Promise<SkillGraph> {
  const now = Date.now()
  if (graphCache && now - graphCache.at < GRAPH_TTL_MS) return graphCache.graph
  const graph = buildGraph(await loadGraphData())
  graphCache = { graph, at: now }
  return graph
}

/** Gọi sau publish/di-trú đồ thị để cache tươi lại. */
export function invalidateGraphCache(): void {
  graphCache = null
}

/** Đồ thị năng lực (cache) — cho các service khác (planQuality…). */
export function getSkillGraph(): Promise<SkillGraph> {
  return getGraph()
}

/**
 * Ghi một bằng chứng học viên. Idempotency qua attemptId (kiểm db); fold bằng engine rồi bền hoá.
 * Bản production: bọc transaction Serializable + retry, log/snapshot best-effort NGOÀI tx (SPEC §2).
 */
export async function recordLearnerEvidence(userId: string, ev: EvidenceInput): Promise<RecordResult> {
  if (ev.attemptId && (await attemptExists(ev.attemptId))) {
    const prior = await getSkillState(userId, ev.skill)
    return {
      status: 'duplicate',
      state: prior ?? freshMastery(ev.skill, DEFAULT_POLICY.bkt.pInit),
    }
  }

  const prior = await getSkillState(userId, ev.skill)
  const result = recordEvidence(prior, ev, DEFAULT_POLICY)
  if (result.status === 'folded') {
    await saveFold(userId, ev, result.state, result.snapshot)
  }
  return result
}

/** Biên học của một học viên (nên học tiếp gì). */
export async function getLearnerFrontier(userId: string): Promise<FrontierNode[]> {
  const [graph, states] = await Promise.all([getGraph(), loadLearnerStates(userId)])
  return frontierComposite(graph, states, DEFAULT_POLICY.mastery.threshold)
}

/**
 * Phiên học thích ứng: chọn item KẾ TIẾP từ ngân hàng (đã duyệt) theo ưu tiên + độ khó khớp năng lực.
 * Ưu tiên dựng bằng buildPriority (frontier + lãng quên), rồi selectAdaptiveSession (ε-explore).
 */
export async function getNextSession(
  userId: string,
  opts: { size?: number; focus?: readonly string[] },
): Promise<Candidate[]> {
  const [graph, states, candidates] = await Promise.all([
    getGraph(),
    loadLearnerMastery(userId),
    loadCandidates(),
  ])
  if (candidates.length === 0) return []

  const nowMs = Date.now()
  const encountered = new Set(states.keys())
  const started = new Set([...states.values()].filter((s) => s.attempts > 0).map((s) => s.skill))
  const relevant = new Set(candidates.flatMap((c) => [...c.skills]))
  const priority = buildPriority(graph, states, relevant, encountered, nowMs, DEFAULT_POLICY)

  const ctx: SessionContext = { states, priority, started, encountered }
  const sopts: SessionOpts = {
    ...(opts.size !== undefined ? { size: opts.size } : {}),
    ...(opts.focus && opts.focus.length ? { focus: new Set(opts.focus) } : {}),
  }
  const { session, trace } = selectAdaptiveSessionTraced(ctx, candidates, sopts, DEFAULT_POLICY)

  // Nhật ký ghi hụt thì mất dữ liệu; nhật ký làm hỏng request thì mất buổi học của một đứa
  // trẻ. Nên lỗi ghi được nuốt — nhưng nuốt KÈM log, vì một đường ghi hỏng im lặng đúng bằng
  // không có đường ghi nào, và ta chỉ phát hiện ra sau một năm không có gì để phân tích.
  try {
    await saveSelectionTrace(userId, trace)
  } catch (err) {
    console.error('[knowledge] không ghi được nhật ký chọn bài', { userId, err })
  }

  return session
}

/**
 * Lỗ hổng của một học viên so với một khung chương trình.
 *
 * Ba việc engine làm mà bản đọc cũ (`getLearnerFrameworkReport`) không làm: tách "đã đo mà
 * chưa tới" khỏi "chưa ai đo", chặn không cho mục tiêu kiểu thái độ mang điểm số, và trả kèm
 * khoảng tin cậy cho phần được phép mang điểm.
 *
 * `stage` là tuỳ chọn và không được diễn giải — bỏ trống thì đọc cả khung.
 */
export async function getLearnerGapReport(
  userId: string,
  frameworkSlug: string,
  stage?: string,
): Promise<GapReport | null> {
  const objectiveSlugs = await loadFrameworkObjectiveSlugs(frameworkSlug, stage)
  if (objectiveSlugs === null) return null

  const [graph, states] = await Promise.all([getGraph(), loadLearnerMastery(userId)])
  return gapReport({ graph, states, objectives: objectiveSlugs.map((slug) => ({ slug })) }, DEFAULT_POLICY)
}

/** Các nhãn bậc một khung thực sự dùng — giao diện dựng bộ lọc từ dữ liệu, không đoán. */
export function listFrameworkStages(frameworkSlug: string): Promise<string[]> {
  return loadFrameworkStages(frameworkSlug)
}

/** Chứng nhận: đo mức nắm học viên với tập objective (slug) → CertifyReport (đạt/không, %). */
export async function certifyLearner(
  userId: string,
  objectiveSlugs: readonly string[],
): Promise<CertifyReport> {
  const [graph, measured] = await Promise.all([getGraph(), loadLearnerStates(userId)])
  const objectives: CertifyObjective[] = objectiveSlugs.map((slug) => ({ slug }))
  return certifyFramework(graph, measured, objectives, DEFAULT_POLICY)
}

export interface LearnerSnapshot {
  readonly mastered: readonly Slug[]
  readonly fading: readonly Slug[]
  readonly frontier: readonly Slug[]
}

/** Ảnh chụp engine của học viên (đã nắm / đang mờ dần / biên học) — dẫn cá nhân hoá content. */
export async function computeSnapshot(userId: string): Promise<LearnerSnapshot> {
  const [graph, mastery] = await Promise.all([getGraph(), loadLearnerMastery(userId)])
  const pknown = new Map<Slug, { pKnown: number }>([...mastery].map(([k, v]) => [k, { pKnown: v.pKnown }]))
  const encountered = new Set(mastery.keys())
  const threshold = DEFAULT_POLICY.mastery.threshold
  const nowMs = Date.now()

  const mastered = [...encountered].filter((s) => compositeMastery(graph, pknown, s) >= threshold)
  const fading = dueForReview(graph, mastery, encountered, encountered, nowMs, DEFAULT_POLICY).map(
    (d) => d.slug,
  )
  const frontier = frontierComposite(graph, pknown, threshold).map((f) => f.slug)
  return { mastered, fading, frontier }
}
