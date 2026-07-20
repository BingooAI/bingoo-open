/**
 * ĐỐI CHIẾU khung thứ 2+ vào vốn KC canonical đã có.
 *
 * Thứ tự BẮT BUỘC — rẻ và chắc trước, đắt và mờ sau:
 *   ① CẤU TRÚC (miễn phí, tất định): khác `object` → NEW. `scope` bao nhau → SUBSET/SUPERSET.
 *      Trùng khít → SAME (ứng viên). Lệch trục khác → OVERLAP.
 *   ② LLM (chỉ cho phần dư UNKNOWN): bắt trả BẰNG CHỨNG — một câu hỏi mà học sinh làm đúng cái này
 *      nhưng sai cái kia. Không nêu được câu nào → đúng là CÙNG một KC.
 *   ③ NGƯỜI: mọi phán quyết dẫn tới GỘP (SAME) hoặc còn mờ (UNKNOWN/OVERLAP) đều phải qua người.
 *      Máy chỉ tự đi tiếp với những phán quyết KHÔNG gộp gì (NEW/SUBSET/SUPERSET) — vì chúng an toàn.
 *
 * Gộp sai làm hỏng vĩnh viễn xương sống bằng chứng MÀ KHÔNG PHÁT TÍN HIỆU LỖI NÀO — nên mặc định
 * của hệ thống là KHÔNG GỘP.
 */

import {
  canonicalTitle,
  diceSimilarity,
  mintSlug,
  proposeAlignment,
  runIngest,
  slugify,
  type AlignProposal,
  type AlignVerdict,
  type ExistingKc,
  type NewConcept,
  type RawSource,
} from '@bingoo/authoring'
import type { DomainProfile, Facets } from '@bingoo/facets'
import { getAi } from '../providers'
import { readEnv } from '../providers/core/config'
import { renderPrompt } from '../prompts'
import { loadDomainProfiles, loadKcCandidates } from '../repos/authoring.repo'
import { nearestKcs } from '../repos/competency-embedding.repo'
import { buildAuthoringPorts } from './authoring-adapters'

const AUTHORING_MODEL = readEnv('AUTHORING_MODEL') ?? 'claude-haiku-4-5-20251001'

const VERDICTS: readonly AlignVerdict[] = ['SAME', 'SUBSET', 'SUPERSET', 'OVERLAP', 'NEW', 'UNKNOWN']

export interface AlignmentReport {
  readonly proposals: readonly AlignProposal[]
  readonly summary: Readonly<Record<string, number>>
  /** Số đề xuất BẮT BUỘC người duyệt (gộp / mơ hồ). */
  readonly needsHuman: number
  readonly warnings: readonly string[]
}

/** Ứng viên tốt nhất: ưu tiên cùng `object` (chính xác + rẻ); không có thì rơi về trigram tiêu đề EN. */
async function bestCandidate(c: NewConcept): Promise<ExistingKc | undefined> {
  const object = c.facets?.object

  if (object) {
    const byObject = await loadKcCandidates({
      ...(c.subject ? { subject: c.subject } : {}),
      object,
    })
    if (byObject.length > 0) {
      // Cùng object rồi thì chọn cái gần tiêu đề nhất để đối chiếu chi tiết.
      return byObject.reduce((best, k) =>
        diceSimilarity(c.title, k.title) > diceSimilarity(c.title, best.title) ? k : best,
      )
    }
  }

  // Chưa khai object (hoặc object chưa từng có) → truy hồi thô bằng trigram trên tiêu đề TIẾNG ANH.
  const all = await loadKcCandidates(c.subject ? { subject: c.subject } : {})
  let best: { kc: ExistingKc; sim: number } | undefined
  for (const k of all) {
    const sim = diceSimilarity(c.title, k.title)
    if (sim >= 0.5 && (!best || sim > best.sim)) best = { kc: k, sim }
  }
  if (best) return best.kc

  // Trigram bó tay (diễn đạt khác hẳn, hoặc nguồn khác ngôn ngữ mà bản dịch EN không trùng chữ)
  // → NGỮ NGHĨA. Đây là chỗ DUY NHẤT embedding được phép chen vào: nó chỉ TÌM ỨNG VIÊN để đem đi so
  // CẤU TRÚC. Điểm cosine KHÔNG được dùng làm căn cứ gộp — không có ngưỡng nào ở đây cả. Không có nhà
  // cung cấp embedding thì im lặng bỏ qua, hệ thống vẫn chạy đúng (chỉ tìm ứng viên kém hơn).
  try {
    const near = await nearestKcs(c.title, {
      ...(c.subject ? { subject: c.subject } : {}),
      k: 1,
    })
    const top = near[0]
    if (!top) return undefined
    return all.find((k) => k.slug === top.slug)
  } catch {
    return undefined
  }
}

/** LLM phân xử phần dư UNKNOWN. Bắt buộc trả bằng chứng (discriminator), không phải điểm số. */
async function adjudicate(
  c: NewConcept,
  target: ExistingKc,
): Promise<{ verdict: AlignVerdict; reason: string; discriminator?: string }> {
  const brief = (t: string, f?: Facets): string => JSON.stringify({ title: t, facets: f ?? {} })

  const res = await getAi().generateText({
    system: await renderPrompt('authoring.align.adjudicate', {
      newConcept: brief(c.title, c.facets),
      existing: brief(target.title, target.facets),
    }),
    messages: [{ role: 'user', content: `NEW: ${c.title}\nEXISTING: ${target.title}` }],
    model: AUTHORING_MODEL,
    maxTokens: 600,
  })

  const m = res.text.match(/\{[\s\S]*\}/)
  if (!m) return { verdict: 'UNKNOWN', reason: 'LLM không trả JSON hợp lệ → người duyệt quyết.' }
  try {
    const o = JSON.parse(m[0]) as Record<string, unknown>
    const v = VERDICTS.includes(o.verdict as AlignVerdict) ? (o.verdict as AlignVerdict) : 'UNKNOWN'
    const disc =
      typeof o.discriminator === 'string' && o.discriminator.trim() ? o.discriminator.trim() : undefined
    const reason = typeof o.reason === 'string' && o.reason.trim() ? o.reason.trim() : 'không nêu lý do'

    // BẰNG CHỨNG BẮT BUỘC: nói "khác nhau" mà không nêu nổi câu hỏi phân biệt thì lời nói suông.
    if (v !== 'SAME' && v !== 'UNKNOWN' && !disc) {
      return {
        verdict: 'UNKNOWN',
        reason: `LLM phán "${v}" nhưng KHÔNG nêu được câu hỏi phân biệt → không đủ căn cứ, người duyệt quyết.`,
      }
    }
    return { verdict: v, reason, ...(disc ? { discriminator: disc } : {}) }
  } catch {
    return { verdict: 'UNKNOWN', reason: 'LLM trả JSON hỏng → người duyệt quyết.' }
  }
}

/**
 * Đối chiếu một nguồn (khung #2) vào đồ thị KC hiện có.
 * KHÔNG ghi gì — chỉ trả ĐỀ XUẤT để người duyệt chốt.
 */
export async function alignSource(
  source: RawSource,
  opts?: { subject?: string; aiKey?: string },
): Promise<AlignmentReport> {
  const ports = buildAuthoringPorts(opts?.aiKey !== undefined ? { aiKey: opts.aiKey } : undefined)
  const draft = await runIngest(source, ports)
  const profiles: Record<string, DomainProfile> = await loadDomainProfiles()

  // Slug do SERVER mint, chống trùng với TOÀN BỘ đồ thị hiện có. Không được để client tự chế.
  const taken = new Set((await loadKcCandidates({})).map((k) => k.slug))

  const proposals: AlignProposal[] = []
  for (const c of draft.concepts) {
    const next: NewConcept = {
      tempId: c.tempId,
      title: canonicalTitle(c.title), // TIẾNG ANH LÀ GỐC
      kind: c.kind,
      ...((c.subject ?? opts?.subject) ? { subject: c.subject ?? opts?.subject } : {}),
      ...(c.facets ? { facets: c.facets } : {}),
    }

    const target = await bestCandidate(next)
    const profile = next.subject ? profiles[next.subject] : undefined
    const slug = mintSlug(slugify(next.title), taken)

    // ① Cấu trúc trước — miễn phí, tất định.
    let p = proposeAlignment(next, target, slug, profile)

    // ② Chỉ khi cấu trúc bó tay mới gọi LLM (và LLM phải đưa bằng chứng).
    if (p.decision.verdict === 'UNKNOWN' && target) {
      const a = await adjudicate(next, target)
      p = {
        ...p,
        decision: {
          verdict: a.verdict,
          axes: [],
          reason: a.discriminator ? `${a.reason} — câu hỏi phân biệt: "${a.discriminator}"` : a.reason,
          decidedBy: 'llm',
        },
        // ③ LLM nói gì đi nữa, phán quyết dẫn tới GỘP vẫn phải qua người.
        needsHuman: a.verdict === 'SAME' || a.verdict === 'UNKNOWN' || a.verdict === 'OVERLAP',
      }
    }
    proposals.push(p)
  }

  const summary: Record<string, number> = {}
  for (const p of proposals) summary[p.decision.verdict] = (summary[p.decision.verdict] ?? 0) + 1

  return {
    proposals,
    summary,
    needsHuman: proposals.filter((p) => p.needsHuman).length,
    warnings: draft.warnings,
  }
}
