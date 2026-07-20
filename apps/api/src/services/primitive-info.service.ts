/**
 * MÔ TẢ PRIMITIVE cho NGƯỜI SOẠN (author-facing) — TÊN + "học sinh làm gì", SONG NGỮ (UI hiện tiếng
 * Việt). Nhóm B (hiển thị) nên VI; KIT_DOCS/AnswerDoc (Nhóm A, cho LLM) vẫn English riêng.
 *
 * FAMILY: quiz = câu hỏi chấm tự động (~55) · kit = vật thao tác kéo/chạm (67) · block = khối tĩnh.
 */

import { KIT_DOCS, kitAnswerDoc } from '@bingoo.ai/manipulatives'
import {
  BLOCK_PREFIX,
  MANIP_PREFIX,
  QUIZ_PRIMITIVE_KINDS,
  isKnownPrimitive,
  manipKind,
  primitiveDisplay,
} from '@bingoo.ai/authored-item'
import { getAi } from '../providers'
import { readEnv } from '../providers/core/config'
import { renderPrompt } from '../prompts'

export type PrimitiveFamily = 'quiz' | 'kit' | 'block'
interface Loc {
  readonly vi: string
  readonly en: string
}

export interface PrimitiveInfo {
  readonly kind: string
  readonly family: PrimitiveFamily
  readonly canPreview: boolean
  /** SINH item chấm được ngay? quiz = luôn (auto-key); kit = đã khai hợp đồng đáp án. */
  readonly answerReady: boolean
  /** Tên ngắn hiện trên nút (song ngữ). */
  readonly label: Loc
  /** Mô tả "học sinh làm gì" (song ngữ). */
  readonly desc: Loc | null
}

export function primitiveInfo(kind: string): PrimitiveInfo {
  // Nhãn/mô tả song ngữ lấy TỪ NGUỒN co-located (kit→KIT_META manipulatives, quiz→authored-item),
  // service chỉ thêm phân họ (quiz/kit/block) + cờ preview/chấm-được (việc của tầng app).
  const { label, desc } = primitiveDisplay(kind)
  if (kind.startsWith(MANIP_PREFIX)) {
    const b = kind.slice(MANIP_PREFIX.length)
    return {
      kind,
      family: 'kit',
      canPreview: true,
      answerReady: kitAnswerDoc(b) != null,
      label,
      desc,
    }
  }
  if (kind.startsWith(BLOCK_PREFIX)) {
    return { kind, family: 'block', canPreview: false, answerReady: false, label, desc }
  }
  // quiz = auto-key, luôn chấm được
  return { kind, family: 'quiz', canPreview: false, answerReady: true, label, desc }
}

export function primitiveInfos(kinds: readonly string[]): PrimitiveInfo[] {
  return kinds.map(primitiveInfo)
}

/**
 * TOÀN BỘ palette — quiz (~55) + kit (67, tiền tố manip:). Kit trước (render tương tác thật).
 */
export function allPrimitives(): PrimitiveInfo[] {
  const kits = Object.keys(KIT_DOCS)
    .sort()
    .map((k) => primitiveInfo(manipKind(k)))
  const quiz = [...QUIZ_PRIMITIVE_KINDS].sort().map((k) => primitiveInfo(k))
  return [...kits, ...quiz]
}

/** Chỉ loại SINH ĐƯỢC item chấm được ngay (quiz + kit đã khai đáp án) — dùng cho plan gợi ý + recommend. */
export function contentReadyPrimitives(): PrimitiveInfo[] {
  return allPrimitives().filter((p) => p.answerReady)
}

export interface PrimitiveRecommendation {
  readonly kind: string
  readonly reason: string
  readonly info: PrimitiveInfo
}

/**
 * GỢI Ý loại phù hợp cho MỘT step — hệ chọn hộ (LLM đọc brief + TOÀN catalogue), người soạn khỏi dò 122
 * loại. Trả 2–3 loại hợp nhất kèm lý do; lọc bỏ kind LLM bịa (chỉ giữ kind có thật trong registry).
 */
export async function recommendPrimitives(input: {
  brief: string
  kc: string
  representation?: string
  band?: string
  language?: string
  aiKey?: string
}): Promise<PrimitiveRecommendation[]> {
  const catalogue = contentReadyPrimitives()
    .map((p) => `${p.kind} — ${p.family} — ${p.desc?.en ?? p.label.en}`)
    .join('\n')
  const res = await getAi(input.aiKey).generateText({
    system: await renderPrompt('content.primitive.recommend', {
      brief: input.brief,
      kc: input.kc,
      representation: input.representation ?? 'pictorial',
      band: input.band ?? 'core',
      catalogue,
      language: input.language ?? 'vi',
    }),
    messages: [{ role: 'user', content: `KC=${input.kc}` }],
    model: readEnv('CONTENT_MODEL') ?? 'claude-sonnet-5',
    maxTokens: 1200,
  })
  const m = res.text.match(/\{[\s\S]*\}/)
  if (!m) return []
  let parsed: { recommendations?: { kind?: unknown; reason?: unknown }[] }
  try {
    parsed = JSON.parse(m[0])
  } catch {
    return []
  }
  const out: PrimitiveRecommendation[] = []
  const seen = new Set<string>()
  for (const r of parsed.recommendations ?? []) {
    const kind = typeof r.kind === 'string' ? r.kind.trim() : ''
    if (!kind || seen.has(kind) || !isKnownPrimitive(kind)) continue // chỉ kind có THẬT
    seen.add(kind)
    out.push({
      kind,
      reason: typeof r.reason === 'string' ? r.reason : '',
      info: primitiveInfo(kind),
    })
  }
  return out
}
