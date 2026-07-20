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
  checkInvariants,
  compileDraft,
  hasBlockingIssue,
  hasBlockingViolation,
  runIngest,
  validateDraft,
  type ConceptDraft,
  type EdgeDraft,
  type FrameworkDraft,
  type IngestDraft,
  type LocalizedText,
  type ObjectiveDraft,
  type RawSource,
} from '@bingoo.ai/authoring'
import type { CompetencyKind, FrameworkKind, PrereqMode, RelType } from '@bingoo.ai/knowledge-engine'
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
    blocking: hasBlockingIssue(issues) || hasBlockingViolation(violations),
  }
}

/** Nhãn hiển thị của một khái niệm (khoá để objective trỏ vào). */
function titleKey(t: LocalizedText): string {
  return t.en ?? t.vi ?? Object.values(t)[0] ?? ''
}

/**
 * Trích OBJECTIVES (outcome CÓ MÃ, vd "1Nc.01") từ nguồn chuẩn + map vào khái niệm đã trích.
 * BẮT BUỘC cho nguồn là khung chương trình: nếu bỏ, /apply sẽ KHÔNG ghi Framework/MAPS_TO.
 */
async function extractObjectives(
  chunks: readonly string[],
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

  for (const [ci, text] of chunks.entries()) {
    for (const raw of await askObjectives(text, `chunk${ci}`, 0)) {
      const ob = rec(raw)
      const mapsToTempIds = strArr(ob.mapsToTitles)
        .map((tt) => byTitle.get(tt))
        .filter((id): id is string => id !== undefined)
      if (mapsToTempIds.length === 0) continue // không neo được → bỏ (tránh mục tiêu mồ côi, I5)
      out.push({
        tempId: `o${n++}`,
        title: loc(ob.title),
        ...(str(ob.code) ? { code: str(ob.code) } : {}),
        ...(str(ob.stage) ? { stage: str(ob.stage) } : {}),
        ...(str(ob.strand) ? { strand: str(ob.strand) } : {}),
        mapsToTempIds,
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
    source.chunks.map((c) => c.text ?? '').filter((t) => t.length > 0),
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
