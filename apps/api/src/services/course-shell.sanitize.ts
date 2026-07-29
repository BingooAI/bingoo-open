// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * LÕI THUẦN của sinh vỏ khoá — biến output LLM (đầy rác, thiếu trường, slug bịa) thành CoursePlan neo
 * vào đồ thị thật. Không I/O, không provider, không db → test được offline (đúng R2: lõi thuần tách
 * khỏi lớp vỏ I/O trong course-shell.service.ts).
 *
 * Đây là chỗ giữ hai lời hứa với người dùng khi nguồn là SÁCH:
 *   ① THỨ TỰ của sách được giữ nguyên (mảng units/lessons theo đúng model trả về, không sắp lại).
 *   ② Bài không map được KC nào VẪN giữ đúng chỗ (bỏ đi là nói dối về cấu trúc sách).
 */

import type { Slug } from '@bingoo.ai/knowledge-engine'
import type { CoursePlan, LessonInstructionPlan, LocalizedText, UnitPlan } from '@bingoo.ai/plans'

export const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const strArr = (v: unknown): string[] =>
  arr(v)
    .map(str)
    .filter((s): s is string => s !== undefined)

function loc(v: unknown, fallback = ''): LocalizedText {
  const o = rec(v)
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(o)) if (typeof val === 'string' && val.trim()) out[k] = val.trim()
  return Object.keys(out).length ? out : { en: fallback, vi: fallback }
}

/** Lấy khối JSON đầu tiên trong text LLM; hỏng → {} (lớp gọi phải tự bắt trường hợp rỗng, không nuốt). */

/** Một bài trong sách dạy một kiến thức — kèm CÂU TRONG SÁCH làm căn cứ, nếu model có đưa. */
export interface LessonMappingClaim {
  readonly lessonSlug: string
  readonly lessonTitle: LocalizedText
  readonly conceptSlug: Slug
  readonly quote?: string
}

/**
 * Kiến thức sách DẠY mà khung KHÔNG có.
 *
 * Trước đây thứ này không tồn tại: model chỉ được phép chọn trong vốn từ của khung, nên mọi thứ sách
 * dạy thêm đều bị vứt ngay tại chỗ lọc, không dấu vết. Đó vừa là chỗ "làm dày" chết, vừa là chỗ
 * "lọc" chết — cùng một dòng mã.
 */
export interface ProposedKnowledge {
  readonly title: string
  readonly lessonSlug: string
  readonly quote?: string
}

/** Một slug model đề xuất nhưng bị loại — kèm LÝ DO, để "vì sao khung không có cái này" còn trả lời được. */
export interface DroppedMapping {
  readonly lessonSlug: string
  readonly proposed: string
  readonly reason: 'not-in-vocabulary'
}

export interface SanitizedCourse {
  readonly plan: CoursePlan
  /** Bài GIỮ LẠI đúng vị trí nhưng chưa neo vào KC nào (ôn tập, kiểm tra, kiến thức ngoài stage…). */
  readonly unmappedLessons: readonly string[]
  /** Bài ↔ kiến thức, kèm câu trong sách — nguyên liệu cho thẻ "vì sao bài này dạy kiến thức đó". */
  readonly mappings: readonly LessonMappingClaim[]
  /** Kiến thức sách dạy mà khung chưa có — đề xuất, chờ người duyệt. */
  readonly proposed: readonly ProposedKnowledge[]
  /** Những slug bị loại và VÌ SAO. Loại âm thầm thì không ai trả lời được "sao khung không có cái này". */
  readonly dropped: readonly DroppedMapping[]
}

export interface SanitizeOpts {
  /** GIỮ NGUYÊN thứ tự & mọi bài, kể cả bài teaches rỗng (dùng khi nguồn là SÁCH — sách là sự thật). */
  readonly preserveStructure?: boolean
  readonly frameworkVersionId?: string
}

/**
 * LLM output → CoursePlan skeleton. Slug lạ (model bịa) bị LOẠI khỏi teaches — vỏ khoá luôn neo vào
 * đồ thị thật. Thứ tự units[]/lessons[] GIỮ NGUYÊN theo mảng model trả về.
 *
 * `preserveStructure` (nguồn = SÁCH): một bài không map được KC nào VẪN được giữ đúng chỗ (teaches
 * rỗng) và ghi vào `unmappedLessons`. Bỏ bài đi là nói dối về cấu trúc sách — người soạn phải tự quyết.
 * Không bật cờ (nguồn = PROMPT): bài rỗng teaches bị loại, vì ở đó không có "cấu trúc gốc" để trung thành.
 */
export function sanitizeCourse(
  o: Record<string, unknown>,
  allowed: ReadonlySet<Slug>,
  opts: SanitizeOpts = {},
): SanitizedCourse {
  const keep = (v: unknown): Slug[] => strArr(v).filter((s) => allowed.has(s))
  const unmapped: string[] = []
  const mappings: LessonMappingClaim[] = []
  const proposed: ProposedKnowledge[] = []
  const dropped: DroppedMapping[] = []

  /**
   * `teaches` nhận HAI dạng: mảng chuỗi (dạng cũ) hoặc mảng {slug, quote} (dạng mới, có căn cứ).
   *
   * Nhận cả hai vì model không phải lúc nào cũng theo dạng mới, và một câu trả lời đúng nội dung mà
   * sai vỏ thì không đáng vứt. Không có câu trích thì ánh xạ vẫn giữ — chỉ là nó sẽ được đánh dấu
   * là chưa có căn cứ, chứ không biến mất.
   */
  const readTeaches = (v: unknown): { slug: string; quote?: string }[] =>
    arr(v).map((x) => {
      if (typeof x === 'string') return { slug: x.trim() }
      const o = rec(x)
      const slug = str(o.slug) ?? ''
      const q = str(o.quote)
      return { slug, ...(q !== undefined ? { quote: q } : {}) }
    })

  const units: UnitPlan[] = arr(o.units).map((u, ui): UnitPlan => {
    const uo = rec(u)
    const rawLessons = arr(uo.lessons).map((l, li): LessonInstructionPlan => {
      const lo = rec(l)
      const title = loc(lo.title)
      const ref = str(lo.sourceRef)
      const lessonSlug = str(lo.slug) ?? `u${ui}-l${li}`

      // Tách LẤY và LOẠI, giữ lý do cho từng cái bị loại.
      const claimed = readTeaches(lo.teaches).filter((x) => x.slug.length > 0)
      const teaches: Slug[] = []
      for (const c of claimed) {
        if (allowed.has(c.slug as Slug)) {
          teaches.push(c.slug as Slug)
          mappings.push({
            lessonSlug,
            lessonTitle: title,
            conceptSlug: c.slug as Slug,
            ...(c.quote !== undefined ? { quote: c.quote } : {}),
          })
        } else {
          dropped.push({ lessonSlug, proposed: c.slug, reason: 'not-in-vocabulary' })
        }
      }

      // Kiến thức sách dạy mà khung chưa có — model khai riêng, không lẫn vào `teaches`.
      for (const p of arr(lo.proposes)) {
        const po = rec(p)
        const t = str(po.title)
        if (t === undefined) continue
        const q = str(po.quote)
        proposed.push({ title: t, lessonSlug, ...(q !== undefined ? { quote: q } : {}) })
      }

      if (teaches.length === 0) unmapped.push(ref ?? title.en ?? `u${ui}-l${li}`)
      return {
        slug: lessonSlug,
        version: 1,
        title,
        teaches,
        knowledgePoints: [], // vỏ khoá: chi tiết bài sinh sau (/plan/generate)
      }
    })
    // Nguồn SÁCH giữ hết bài (kể cả rỗng teaches). Nguồn PROMPT bỏ bài rỗng.
    const lessons = opts.preserveStructure ? rawLessons : rawLessons.filter((l) => l.teaches.length > 0)
    return {
      slug: str(uo.slug) ?? `unit-${ui + 1}`,
      version: 1,
      title: loc(uo.title),
      concepts: keep(uo.concepts),
      lessons,
    }
  })

  return {
    plan: {
      slug: str(o.slug) ?? 'course',
      title: loc(o.title, 'Course'),
      objectives: keep(o.objectives),
      units,
      ...(opts.frameworkVersionId !== undefined ? { frameworkVersionId: opts.frameworkVersionId } : {}),
    },
    unmappedLessons: unmapped,
    mappings,
    proposed,
    dropped,
  }
}
