/**
 * ItemBrief — BRIEF SƯ PHẠM CẤP ITEM (Lớp 2 hợp đồng nội dung). Bộ sinh bank vốn chỉ nhận `brief` string
 * thô (role+brief+mustCover đã gộp ở client) + representation + band. Còn THIẾU: điểm SAI THƯỜNG GẶP
 * (misconception) của KC — thứ để distractor NHẮM đúng chỗ hổng và item chẩn đoán soi được hiểu-sai.
 *
 * Misconception sống trên KnowledgePoint của KẾ HOẠCH BÀI (đã sinh + lưu). Ở đây rút đúng KC + render
 * thành khối text nạp vào prompt. Rỗng (plan chưa có) → generator chạy như cũ (tương thích ngược).
 *
 * Nguồn: `LessonInstructionPlan.knowledgePoints[].misconceptions` (mỗi misconception ghim `targetsKc`).
 */

import type { KnowledgePoint, LessonInstructionPlan, Misconception } from '@bingoo/plans'

/** Hợp đồng grounding cấp item — dữ liệu tường minh cho bộ sinh (không chôn trong một string thô). */
export interface ItemBrief {
  readonly kc: string
  /** Ý đồ step (đã gộp role/brief/mustCover) — vẫn dạng text vì client soạn. */
  readonly brief?: string
  readonly representation?: string
  readonly band?: string
  /** Điểm sai thường gặp của KC — seed distractor + item chẩn đoán. */
  readonly misconceptions?: readonly Misconception[]
}

/**
 * Misconceptions của một plan bài NHẮM đúng `kc`: ưu tiên `misconception.targetsKc === kc`, nới sang
 * "KP.targets chứa kc" (KP đa-KC mà misconception chưa ghim targetsKc). DEDUP theo id.
 */
export function misconceptionsForKc(doc: unknown, kc: string): Misconception[] {
  const plan = doc as Partial<LessonInstructionPlan> | null | undefined
  const kps = (plan?.knowledgePoints ?? []) as readonly KnowledgePoint[]
  const out: Misconception[] = []
  const seen = new Set<string>()
  for (const kp of kps) {
    for (const m of kp.misconceptions ?? []) {
      // Misconception GHIM targetsKc → tôn trọng CHẶT (không lấy nhầm KC khác cùng KP đa-KC). Chưa ghim →
      // nới theo KP.targets (KP đơn/đa KC mà misconception chưa pin).
      const hit = m.targetsKc ? m.targetsKc === kc : (kp.targets ?? []).includes(kc as never)
      if (hit && m.id && !seen.has(m.id)) {
        seen.add(m.id)
        out.push(m)
      }
    }
  }
  return out
}

/** Các GIAI ĐOẠN biểu diễn (concrete/pictorial/abstract) mà KP dạy KC — cho chính sách độ dày rich-bank. */
export function representationsForKc(doc: unknown, kc: string): ('concrete' | 'pictorial' | 'abstract')[] {
  const plan = doc as Partial<LessonInstructionPlan> | null | undefined
  const kps = (plan?.knowledgePoints ?? []) as readonly KnowledgePoint[]
  const out = new Set<'concrete' | 'pictorial' | 'abstract'>()
  for (const kp of kps) {
    if (!(kp.targets ?? []).includes(kc as never)) continue
    for (const r of kp.representations ?? []) if (r.stage) out.add(r.stage)
  }
  return [...out]
}

const pickLoc = (t: Record<string, string> | undefined, locale: string): string =>
  t ? (t[locale] ?? t.en ?? Object.values(t)[0] ?? '') : ''

/**
 * Render misconceptions thành khối text cho prompt: mỗi dòng = loại + ý SAI + (chẩn đoán). Bộ sinh dùng
 * để đặt distractor NHẮM đúng hiểu-sai (không bịa distractor ngẫu nhiên) và soạn item chẩn đoán. Rỗng → ''.
 */
export function renderMisconceptions(mcs: readonly Misconception[] | undefined, locale = 'vi'): string {
  if (!mcs?.length) return ''
  return mcs
    .map((m, i) => {
      const wrong = pickLoc(m.wrong, locale)
      const diag = m.diagnostic ? pickLoc(m.diagnostic, locale) : ''
      return `${i + 1}. [${m.type}] WRONG BELIEF: ${wrong}${diag ? ` — PROBE: ${diag}` : ''}`
    })
    .join('\n')
}
