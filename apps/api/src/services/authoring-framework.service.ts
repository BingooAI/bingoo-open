// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Sinh FRAMEWORK cho admin — 2 nguồn:
 *  • from-prompt: LLM SINH thẳng cấu trúc (concepts + edges + objectives) từ chủ đề.
 *  • from-text / from-pdf: TRÍCH khái niệm + cạnh (pipeline) VÀ trích OBJECTIVES có mã (vd "1Nc.01"),
 *    rồi dựng FrameworkDraft. Không có bước objectives thì /apply sẽ không ghi Framework/MAPS_TO.
 * Cả hai → compileDraft/validateDraft (lõi thuần) → DỪNG ở review; admin duyệt rồi /apply mới ghi.
 */

import {
  applyCollisionDecisions,
  checkInvariants,
  compileDraft,
  explainClaim,
  hasBlockingIssue,
  hasBlockingViolation,
  runIngest,
  validateDraft,
  verifyEvidence,
  type ClaimExplanation,
  type CollisionDecision,
  type CompiledObjective,
  type ConceptDraft,
  type EdgeDraft,
  type EvidenceRef,
  type FrameworkDraft,
  type IngestDraft,
  type LocalizedText,
  type ObjectiveDraft,
  type RawSource,
  type RejectedDecision,
} from '@bingoo.ai/authoring'
import type {
  CompetencyKind,
  FrameworkKind,
  GraphData,
  PrereqMode,
  RelType,
  SkillNode,
} from '@bingoo.ai/knowledge-engine'
import { getAi, getVision } from '../providers'
import { renderPrompt } from '../prompts'
import { loadDomainProfiles, loadExistingConcepts, loadExistingNodes } from '../repos/authoring.repo'
import { buildAuthoringPorts } from './authoring-adapters'
import type { IngestResult } from './authoring-ingest.service'
import { modelFor } from '../config/models'

// Model RẺ cho trích xuất có cấu trúc (xem authoring-adapters). Đổi bằng env, không đụng code.

const KINDS: readonly CompetencyKind[] = [
  'OBJECTIVE',
  'OUTCOME',
  'SKILL',
  'KNOWLEDGE',
  'PROCEDURE',
  'BEHAVIOR',
  'ATTITUDE',
  'DISPOSITION',
]
const RELS: readonly RelType[] = ['PREREQUISITE', 'ENABLES', 'COMPOSES']
const MODES: readonly PrereqMode[] = ['REQUIRED', 'RECOMMENDED']
const FKINDS: readonly FrameworkKind[] = ['CURRICULUM', 'CREDENTIAL', 'JOB_PROFILE']

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const strArr = (v: unknown): string[] =>
  arr(v)
    .map(str)
    .filter((s): s is string => s !== undefined)

function loc(v: unknown): LocalizedText {
  const o = rec(v)
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(o)) if (typeof val === 'string' && val.trim()) out[k] = val.trim()
  return Object.keys(out).length ? out : { en: '', vi: '' }
}

function firstJson(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return {}
  try {
    return rec(JSON.parse(m[0]))
  } catch {
    return {}
  }
}

/** LLM output → IngestDraft (evidence rỗng vì sinh từ chủ đề, không từ nguồn trích). */
function sanitizeDraft(o: Record<string, unknown>, locale: string): IngestDraft {
  const concepts: ConceptDraft[] = arr(o.concepts).map((c, i) => {
    const co = rec(c)
    return {
      tempId: str(co.tempId) ?? `c${i}`,
      title: loc(co.title),
      kind: KINDS.includes(co.kind as CompetencyKind) ? (co.kind as CompetencyKind) : 'KNOWLEDGE',
      evidence: [],
      ...(co.description ? { description: loc(co.description) } : {}),
    }
  })
  const tempIds = new Set(concepts.map((c) => c.tempId))

  const edges: EdgeDraft[] = arr(o.edges)
    .map((e): EdgeDraft | undefined => {
      const eo = rec(e)
      const from = str(eo.fromTempId)
      const to = str(eo.toTempId)
      if (!from || !to || from === to || !tempIds.has(from) || !tempIds.has(to)) return undefined
      return {
        fromTempId: from,
        toTempId: to,
        relType: RELS.includes(eo.relType as RelType) ? (eo.relType as RelType) : 'PREREQUISITE',
        mode: MODES.includes(eo.mode as PrereqMode) ? (eo.mode as PrereqMode) : 'REQUIRED',
      }
    })
    .filter((e): e is EdgeDraft => e !== undefined)

  const objectives: ObjectiveDraft[] = arr(o.objectives).map((ob, i) => {
    const oo = rec(ob)
    return {
      tempId: str(oo.tempId) ?? `o${i}`,
      title: loc(oo.title),
      ...(str(oo.code) ? { code: str(oo.code) } : {}),
      mapsToTempIds: strArr(oo.mapsToTempIds).filter((t) => tempIds.has(t)),
    }
  })

  const fo = rec(o.framework)
  const framework: FrameworkDraft = {
    slug: str(fo.slug) ?? 'framework',
    name: loc(fo.name),
    kind: FKINDS.includes(fo.kind as FrameworkKind) ? (fo.kind as FrameworkKind) : 'CURRICULUM',
    locale,
    objectives,
  }

  return { concepts, edges, framework, warnings: [] }
}

/** Sinh framework TỪ CHỦ ĐỀ/PROMPT (generative). */
export async function frameworkFromPrompt(
  topic: string,
  locale: string,
  aiKey?: string,
): Promise<IngestResult> {
  const res = await getAi(aiKey).generateText({
    system: await renderPrompt('authoring.framework.generate', { topic, locale }),
    messages: [{ role: 'user', content: topic }],
    model: modelFor('extraction'),
    maxTokens: 4000,
  })
  const draft = sanitizeDraft(firstJson(res.text), locale)
  const existing = await loadExistingConcepts()
  const compiled = compileDraft(draft, existing)
  const issues = validateDraft(compiled)
  const [profiles, existingNodes] = await Promise.all([loadDomainProfiles(), loadExistingNodes()])
  const violations = checkInvariants(compiled.graph, { profiles, existing: existingNodes })
  return {
    compiled,
    issues,
    warnings: draft.warnings,
    violations: violations.map((v) => ({
      code: v.code,
      severity: v.severity,
      message: v.message,
      slugs: [...v.slugs],
    })),
    collisions: describeCollisions(compiled.graph, violations),
    cycles: describeCycles(compiled.graph, violations),
    blocking: hasBlockingIssue(issues) || hasBlockingViolation(violations),
  }
}

/** Nhãn hiển thị của một khái niệm (khoá để objective trỏ vào). */
function titleKey(t: LocalizedText): string {
  return t.en ?? t.vi ?? Object.values(t)[0] ?? ''
}

// Câu nguồn của một mục tiêu, ĐÃ KIỂM tại chỗ — qua đúng hàm mà đường trích kiến thức dùng. Trước
// đây đây là một bản sao riêng, và bản sao là lý do hai đường lệch nhau: mục tiêu được kiểm, kiến
// thức thì không, suốt một thời gian dài mà không có gì báo.
const objectiveEvidence = (chunkId: string, quote: string, chunkText: string): EvidenceRef =>
  verifyEvidence({ chunkId, quote }, chunkText)

/**
 * Trích OBJECTIVES (outcome CÓ MÃ, vd "1Nc.01") từ nguồn chuẩn + map vào khái niệm đã trích.
 * BẮT BUỘC cho nguồn là khung chương trình: nếu bỏ, /apply sẽ KHÔNG ghi Framework/MAPS_TO.
 */
async function extractObjectives(
  chunks: readonly { id: string; text: string }[],
  concepts: readonly ConceptDraft[],
  aiKey?: string,
): Promise<ObjectiveDraft[]> {
  if (concepts.length === 0) return []
  // Danh sách khái niệm là TOÀN CỤC (objective ở chunk này có thể neo vào KC trích từ chunk khác).
  const byTitle = new Map(concepts.map((c) => [titleKey(c.title), c.tempId]))
  const system = await renderPrompt('authoring.objective.extract', {
    concepts: JSON.stringify([...byTitle.keys()]),
  })

  const out: ObjectiveDraft[] = []
  let n = 0

  // TỰ CHIA ĐÔI khi bị cắt — cùng luật với trích khái niệm: output tỉ lệ với MẬT ĐỘ kiến thức,
  // không phải với độ dài input, nên chunk theo ký tự không bao giờ đủ.
  const askObjectives = async (
    text: string,
    tag: string,
    depth: number,
  ): Promise<Record<string, unknown>[]> => {
    const res = await getAi(aiKey).generateText({
      system,
      messages: [{ role: 'user', content: text }],
      model: modelFor('extraction'),
      maxTokens: 8000,
    })
    if (res.finishReason !== 'max_tokens') return arr(firstJson(res.text).objectives).map(rec)

    const lines = text.split('\n')
    if (depth >= 4 || lines.length < 2) {
      throw new Error(`Trích objective bị CẮT dù đã chia tới đáy (${tag}, ${text.length} ký tự).`)
    }
    const mid = Math.floor(lines.length / 2)
    const [a, b] = await Promise.all([
      askObjectives(lines.slice(0, mid).join('\n'), `${tag}·a`, depth + 1),
      askObjectives(lines.slice(mid).join('\n'), `${tag}·b`, depth + 1),
    ])
    return [...a, ...b]
  }

  for (const [ci, chunk] of chunks.entries()) {
    for (const raw of await askObjectives(chunk.text, `chunk${ci}`, 0)) {
      const ob = rec(raw)
      const mapsToTempIds = strArr(ob.mapsToTitles)
        .map((tt) => byTitle.get(tt))
        .filter((id): id is string => id !== undefined)
      if (mapsToTempIds.length === 0) continue // không neo được → bỏ (tránh mục tiêu mồ côi, I5)
      const quote = str(ob.sourceQuote)
      const evidence = quote ? [objectiveEvidence(chunk.id, quote, chunk.text)] : undefined
      out.push({
        tempId: `o${n++}`,
        title: loc(ob.title),
        ...(str(ob.code) ? { code: str(ob.code) } : {}),
        ...(str(ob.stage) ? { stage: str(ob.stage) } : {}),
        ...(str(ob.strand) ? { strand: str(ob.strand) } : {}),
        mapsToTempIds,
        ...(evidence ? { evidence } : {}),
      })
    }
  }

  /**
   * LỌC TẤT ĐỊNH — không tin prompt một mình.
   *
   * Cambridge có mục "Prior experience for Stage 1" toàn gạch đầu dòng KHÔNG mã; LLM vơ luôn thành
   * objective → slug dài, rác, và làm bẩn khung. Luật chắc chắn: nếu tài liệu CÓ dùng mã thì mục
   * KHÔNG mã là văn xuôi, không phải objective → loại. (Tài liệu không dùng mã thì giữ nguyên.)
   */
  const coded = out.filter((o) => o.code !== undefined)
  if (coded.length > 0 && coded.length < out.length) {
    return coded.map((o, i) => ({ ...o, tempId: `o${i}` }))
  }
  return out
}

export interface SourceFrameworkOpts {
  readonly slug?: string
  readonly name?: LocalizedText
  readonly kind?: FrameworkKind
  readonly aiKey?: string
}

/** Nguồn (text/PDF) → khái niệm + cạnh (pipeline) + OBJECTIVES → FrameworkDraft → compile/validate. */
async function frameworkFromSource(
  source: RawSource,
  locale: string,
  opts?: SourceFrameworkOpts,
): Promise<IngestResult> {
  const ports = buildAuthoringPorts(opts?.aiKey !== undefined ? { aiKey: opts.aiKey } : undefined)
  const base = await runIngest(source, ports)

  const objectives = await extractObjectives(
    source.chunks.filter((c) => (c.text ?? '').length > 0).map((c) => ({ id: c.id, text: c.text as string })),
    base.concepts,
    opts?.aiKey,
  )

  const framework: FrameworkDraft = {
    slug: opts?.slug ?? 'framework',
    name: opts?.name ?? { en: opts?.slug ?? 'Framework', vi: opts?.slug ?? 'Khung' },
    kind: opts?.kind ?? 'CURRICULUM',
    locale,
    objectives,
  }

  const draft: IngestDraft = { ...base, framework }
  const existing = await loadExistingConcepts()
  const compiled = compileDraft(draft, existing)
  const issues = validateDraft(compiled)
  const [profiles, existingNodes] = await Promise.all([loadDomainProfiles(), loadExistingNodes()])
  const violations = checkInvariants(compiled.graph, { profiles, existing: existingNodes })
  return {
    compiled,
    issues,
    warnings: draft.warnings,
    violations: violations.map((v) => ({
      code: v.code,
      severity: v.severity,
      message: v.message,
      slugs: [...v.slugs],
    })),
    collisions: describeCollisions(compiled.graph, violations),
    cycles: describeCycles(compiled.graph, violations),
    blocking: hasBlockingIssue(issues) || hasBlockingViolation(violations),
  }
}

/**
 * Sinh framework TỪ PDF: OCR trước → đi CHUNG đường text.
 * (Phải OCR trước vì bước trích objectives cần chính văn bản nguồn — chunk ảnh không mang text.)
 */
export async function frameworkFromPdf(
  pdf: string,
  locale: string,
  opts?: SourceFrameworkOpts,
): Promise<IngestResult> {
  const { text } = await extractSourceText(pdf)
  return frameworkFromText(text, locale, opts)
}

/** BƯỚC RIÊNG (để UI thấy tiến trình): PDF/ảnh → văn bản. Người soạn xem/sửa trước khi trích khái niệm. */
export async function extractSourceText(pdf: string): Promise<{ text: string; chars: number }> {
  const res = await getVision().extractText({ image: pdf })
  return { text: res.text, chars: res.text.length }
}

/**
 * Chia nguồn thành CHUNK — bắt buộc, không phải tối ưu.
 *
 * Tống cả tài liệu vào một lượt gọi thì output JSON vượt trần token → bị cắt giữa chừng → parse hỏng
 * → 0 khái niệm. Nới maxTokens chỉ đẩy lùi ngưỡng vỡ (35 trang, rồi cuốn sách 92MB thì sao?).
 * Pipeline vốn ĐƯỢC THIẾT KẾ để chạy theo chunk — dùng đúng nó.
 *
 * Cắt ưu tiên ranh giới đoạn/tiêu đề để không xé một mục giữa chừng (mất ngữ cảnh trích).
 */
const CHUNK_CHARS = 1500

export function chunkText(text: string, target = CHUNK_CHARS): string[] {
  const blocks = text.split(/\n\s*\n/) // ranh giới đoạn
  const out: string[] = []
  let cur = ''
  for (const b of blocks) {
    const piece = b.trim()
    if (!piece) continue
    if (cur && cur.length + piece.length + 2 > target) {
      out.push(cur)
      cur = piece
    } else {
      cur = cur ? `${cur}\n\n${piece}` : piece
    }
  }
  if (cur) out.push(cur)

  // Đoạn đơn lẻ vẫn quá dài → cắt cứng theo dòng (không để một chunk vượt trần).
  const safe: string[] = []
  for (const c of out) {
    if (c.length <= target * 1.6) {
      safe.push(c)
      continue
    }
    const lines = c.split('\n')
    let acc = ''
    for (const ln of lines) {
      if (acc && acc.length + ln.length + 1 > target) {
        safe.push(acc)
        acc = ln
      } else {
        acc = acc ? `${acc}\n${ln}` : ln
      }
    }
    if (acc) safe.push(acc)
  }
  return safe
}

/** BƯỚC RIÊNG: văn bản (đã xem/sửa) → khái niệm + cạnh + OBJECTIVES → compile/validate. */
export async function frameworkFromText(
  text: string,
  locale: string,
  opts?: SourceFrameworkOpts,
): Promise<IngestResult> {
  const chunks = chunkText(text).map((t, i) => ({ id: `c${i}`, order: i, text: t }))
  return frameworkFromSource({ id: 'text-source', kind: 'text', locale, chunks }, locale, opts)
}

// ── CỔNG NGƯỜI DUYỆT: chốt khi máy không phân biệt được hai kiến thức ──────────────────────────────

/**
 * Một chỗ máy bí, kèm ĐỦ thứ để người duyệt chốt.
 *
 * Không phải một dòng cảnh báo. Người duyệt cần thấy hai kiến thức đó là gì và TRỤC NÀO trùng —
 * vì "trùng khít mọi trục" mới là lý do máy bí, và cũng chính là chỗ họ phải bổ sung nếu chúng khác.
 */
export interface CollisionView {
  readonly slugs: readonly [string, string]
  readonly titles: readonly [LocalizedText, LocalizedText]
  /** Từ engine giải thích dùng chung — cùng thứ mọi mặt khác của hệ dùng, không phải bản riêng. */
  readonly explanation: ClaimExplanation
}

const facetsOf = (n: SkillNode | undefined): Record<string, unknown> =>
  (n?.facets ?? {}) as Record<string, unknown>

/**
 * Dịch vi phạm I1 thành thứ hiện được cho người duyệt.
 *
 * Vi phạm chỉ mang hai slug; câu chữ của nó dành cho log. Chỗ này tra lại node để lấy nhan đề và
 * chạy engine giải thích để có so-từng-trục — người duyệt đọc "trục nào trùng", không phải một mã lỗi.
 */
export function describeCollisions(
  graph: GraphData,
  violations: readonly { code: string; slugs: readonly string[] }[],
): CollisionView[] {
  const bySlug = new Map(graph.nodes.map((n) => [n.slug as string, n]))
  const out: CollisionView[] = []
  for (const v of violations) {
    if (v.code !== 'I1_IDENTITY_COLLISION') continue
    const [a, b] = v.slugs
    if (a === undefined || b === undefined) continue
    const na = bySlug.get(a)
    const nb = bySlug.get(b)
    out.push({
      slugs: [a, b],
      titles: [na?.title ?? { en: a }, nb?.title ?? { en: b }],
      explanation: explainClaim({
        claimKind: 'CONCEPT_IDENTITY',
        fromFacets: facetsOf(na),
        toFacets: facetsOf(nb),
      }),
    })
  }
  return out
}

/**
 * MỘT MẮT của chuỗi quay vòng, kèm bậc trung thực của chính nó.
 *
 * Máy phát hiện được vòng nhưng KHÔNG biết mắt nào sai — cả n mắt đều "hợp lệ" xét riêng. Điều nó
 * biết được là mắt nào có căn cứ và mắt nào chỉ là phán đoán, nên chỗ này chạy engine giải thích
 * cho từng mắt: người duyệt gỡ mắt yếu nhất chứ không gỡ bừa.
 */
export interface CycleLinkView {
  readonly from: string
  readonly to: string
  readonly relType: string
  readonly titles: readonly [LocalizedText, LocalizedText]
  readonly explanation: ClaimExplanation
}

export interface CycleView {
  /** Đường đi của vòng, mắt cuối quay về mắt đầu. */
  readonly path: readonly string[]
  readonly links: readonly CycleLinkView[]
}

/**
 * Dịch vi phạm I6 thành thứ chốt được.
 *
 * Vi phạm chỉ mang đường đi dạng slug. Chỗ này tra lại nhan đề và giải thích từng mắt, vì "gỡ mắt
 * nào" là câu hỏi phải trả lời bằng căn cứ chứ không bằng thứ tự xuất hiện.
 */
export function describeCycles(
  graph: GraphData,
  violations: readonly { code: string; slugs: readonly string[] }[],
): CycleView[] {
  const bySlug = new Map(graph.nodes.map((n) => [n.slug as string, n]))
  const out: CycleView[] = []
  for (const v of violations) {
    if (v.code !== 'I6_ORDERING_CYCLE') continue
    const path = [...v.slugs]
    const links: CycleLinkView[] = []
    for (let i = 0; i + 1 < path.length; i += 1) {
      const from = path[i]
      const to = path[i + 1]
      if (from === undefined || to === undefined) continue
      const edge = graph.edges.find((e) => e.from === from && e.to === to)
      const nf = bySlug.get(from)
      const nt = bySlug.get(to)
      links.push({
        from,
        to,
        relType: edge?.relType ?? 'PREREQUISITE',
        titles: [nf?.title ?? { en: from }, nt?.title ?? { en: to }],
        explanation: explainClaim({
          claimKind: 'ORDERING_EDGE',
          relType: edge?.relType ?? 'PREREQUISITE',
          fromFacets: facetsOf(nf),
          toFacets: facetsOf(nt),
        }),
      })
    }
    out.push({ path, links })
  }
  return out
}

export interface ResolveCollisionsResult {
  readonly graph: GraphData
  readonly objectives: readonly CompiledObjective[]
  readonly applied: number
  readonly rejected: readonly RejectedDecision[]
  readonly issues: readonly { code: string; severity: string; message: string }[]
  readonly violations: readonly { code: string; severity: string; message: string; slugs: string[] }[]
  readonly collisions: readonly CollisionView[]
  /** Chuỗi học quay vòng — cũng chặn ghi, và cũng chỉ người mới gỡ được. */
  readonly cycles: readonly CycleView[]
  readonly blocking: boolean
}

/**
 * Thi hành quyết định của người duyệt rồi KIỂM LẠI — kiểm ở đây, không ở trình duyệt.
 *
 * Bất biến cần `profiles` (trục bắt buộc từng môn) và ĐỒ THỊ ĐANG CÓ để bắt trùng với KC cũ, chứ
 * không chỉ trong lô. Trình duyệt không có hai thứ đó, nên nếu để nó tự tuyên "hết vi phạm" thì
 * người duyệt bấm Ghi và bị server chặn — hoặc tệ hơn, lọt một trùng định danh với KC đã có.
 *
 * Hàm KHÔNG ghi gì. Người duyệt còn phải bấm Ghi.
 */
export async function resolveFrameworkCollisions(input: {
  readonly graph: GraphData
  readonly objectives: readonly CompiledObjective[]
  readonly decisions: readonly CollisionDecision[]
}): Promise<ResolveCollisionsResult> {
  const resolved = applyCollisionDecisions(
    { graph: input.graph, objectives: input.objectives },
    input.decisions,
  )

  const [profiles, existing] = await Promise.all([loadDomainProfiles(), loadExistingNodes()])
  const violations = checkInvariants(resolved.graph, { profiles, existing })
  const issues = validateDraft({
    graph: resolved.graph,
    objectives: resolved.objectives,
    // Bản nháp đi vòng qua trình duyệt nên bằng chứng của kiến thức không còn ở đây — khai rỗng thay
    // vì bịa. `validateDraft` chỉ đọc `graph`, nên không mất gì; nhưng khai rỗng là nói thật về việc
    // đường này không mang bằng chứng, chứ không giả vờ có.
    concepts: [],
    dedup: EMPTY_DEDUP,
  })

  return {
    graph: resolved.graph,
    objectives: resolved.objectives,
    applied: resolved.applied.length,
    rejected: resolved.rejected,
    issues: issues.map((i) => ({ code: i.code, severity: i.severity, message: i.message })),
    violations: violations.map((v) => ({
      code: v.code,
      severity: v.severity,
      message: v.message,
      slugs: [...v.slugs],
    })),
    collisions: describeCollisions(resolved.graph, violations),
    cycles: describeCycles(resolved.graph, violations),
    blocking: hasBlockingIssue(issues) || hasBlockingViolation(violations),
  }
}

/**
 * `validateDraft` nhận cả bản nháp đã compile, nhưng chỉ đọc `graph`. Ở đây bản nháp đến từ trình
 * duyệt nên không còn dấu vết dedup — dựng một cái rỗng thay vì bịa số liệu gộp.
 */
const EMPTY_DEDUP = { concepts: [], alias: new Map<string, never>(), merges: [] } as never
