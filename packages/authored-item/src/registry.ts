// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Metadata primitive — khai "đo được không / chấm bằng gì" cho từng primitiveKind của
 * @bingoo.ai/core (mảnh core còn thiếu). Đây là hợp đồng tầng ③ neo vào engine, KHÔNG sửa schema core.
 *
 * Danh sách bám đúng @bingoo.ai/core hiện tại: quiz.ts (20 loại), content.ts (11 block),
 * draw.ts (tracingGlyph/coloringPicture), flashcard.ts. Khi core thêm loại → cập nhật ở đây.
 */

import { CONTENT_BLOCK_META, CONTENT_BLOCK_TYPES, QuizQuestion } from '@bingoo.ai/core'
import { INTERACTIVE_KITS } from '@bingoo.ai/manipulatives'
import type { GraderKind } from './model'

export interface PrimitiveMeta {
  readonly measurable: boolean
  readonly graderKind?: GraderKind
  /** Độ tin cậy cơ sở của cách chấm (auto-key chắc hơn LLM/peer). */
  readonly baseConfidence: number
}

// Baseline phòng khi cấu trúc Zod đổi — vẫn chạy được (KHÔNG bao giờ rỗng).
const QUIZ_FALLBACK = [
  'single',
  'multiple',
  'boolean',
  'fill',
  'order',
  'match',
  'numeric',
  'wordbank',
  'categorize',
  'highlight',
  'numberline',
  'clock',
  'venn',
  'tablefill',
  'tenframe',
  'partwhole',
  'placevalue',
  'pattern',
  'label',
  'hotspot',
]

/**
 * TỰ dẫn xuất mọi literal `type` của union QuizQuestion (@bingoo.ai/core) LÚC CHẠY — core thêm loại
 * mới (arrow, wordsearch…) là registry tự biết, KHÔNG cần sửa tay. Union = nguồn sự thật duy nhất.
 * Bất biến: mọi thành viên union đều đo được + auto-key (gradeQuestion của core chấm hết).
 */
function deriveQuizTypes(): string[] {
  try {
    const eff = QuizQuestion as unknown as { _def?: { schema?: unknown } }
    const inner = (eff._def?.schema ?? QuizQuestion) as { options?: readonly unknown[] }
    const types = (inner.options ?? [])
      .map((o) => (o as { shape?: { type?: { value?: unknown } } }).shape?.type?.value)
      .filter((v): v is string => typeof v === 'string')
    return types.length ? types : QUIZ_FALLBACK
  } catch {
    return QUIZ_FALLBACK
  }
}

// quiz.ts — auto-key qua gradeQuestion (đo được). Dẫn xuất → tự cập nhật.
const QUIZ_TYPES = deriveQuizTypes()

/**
 * Tiền tố NAMESPACE cho content block. BẮT BUỘC vì keyspace va nhau: `math` vừa là quiz type
 * (chấm được) vừa là content block (text tĩnh). Không namespace thì registry nhập nhằng.
 */
export const BLOCK_PREFIX = 'block:'
export const blockKind = (type: string): string => `${BLOCK_PREFIX}${type}`

/**
 * Tiền tố NAMESPACE cho manipulative kit — BẮT BUỘC vì kit VA TÊN với quiz type: `tenframe`,
 * `numberline`, `clock`, `partwhole`… vừa là loại câu hỏi (auto-key) vừa là kit thao tác (chấm bằng
 * checkAnswer). Không namespace thì kit đè lên quiz type trong registry, chấm sai luôn.
 */
export const MANIP_PREFIX = 'manip:'
export const manipKind = (kind: string): string => `${MANIP_PREFIX}${kind}`

/**
 * Đăng ký kit là primitive CHẤM ĐƯỢC — ĐỘNG từ `INTERACTIVE_KITS` của @bingoo.ai/manipulatives (chính là
 * khoá của REG). Kit mới thêm vào REG là tự có entry ở đây; KHÔNG liệt kê tay 63 kit. graderKind='manip'
 * → dispatcher gọi `checkAnswer(kind, ...)` (xem grade.ts manipGrader). baseConfidence 0.9: check trực
 * tiếp nhưng thao tác có nhiễu hơn khoá đáp án thuần. measurable=true: kit item mặc định sinh evidence
 * (item KHÔNG đo — dùng để khám phá — tự set measurable=false ở AuthoredItem).
 */
const MANIP_ENTRIES: [string, PrimitiveMeta][] = INTERACTIVE_KITS.map((k) => [
  manipKind(k),
  { measurable: true, graderKind: 'manip', baseConfidence: 0.9 },
])

/** Grader cho block CHẤM ĐƯỢC (core khai gradeable): quiz→auto-key, tracing/coloring→coverage. */
function blockGrader(type: string): GraderKind | undefined {
  // experiment carries hypothesis.correctId — an answer key, same as a quiz.
  if (type === 'quiz' || type === 'experiment') return 'auto-key'
  if (type === 'tracing' || type === 'coloring') return 'coverage'
  return undefined
}

/**
 * content.ts — measurable LẤY THẲNG từ `CONTENT_BLOCK_META[t].gradeable` của core (core TỰ khai,
 * không đoán). Core thêm block gradeable mới → registry tự biết.
 */
const CONTENT_ENTRIES = CONTENT_BLOCK_TYPES.map((t): [string, PrimitiveMeta] => {
  const gradeable = CONTENT_BLOCK_META[t].gradeable
  if (!gradeable) return [blockKind(t), { measurable: false, baseConfidence: 0 }]
  const gk = blockGrader(t)
  return [
    blockKind(t),
    {
      measurable: true,
      ...(gk ? { graderKind: gk } : {}),
      baseConfidence: gk === 'coverage' ? 0.9 : 1,
    },
  ]
})

const REGISTRY: Record<string, PrimitiveMeta> = {
  ...Object.fromEntries(
    QUIZ_TYPES.map((t) => [t, { measurable: true, graderKind: 'auto-key', baseConfidence: 1 }]),
  ),
  // draw.ts — primitive độc lập, chấm theo coverage (scoreTracedStroke / coloringScore)
  tracingGlyph: { measurable: true, graderKind: 'coverage', baseConfidence: 0.9 },
  coloringPicture: { measurable: true, graderKind: 'coverage', baseConfidence: 0.9 },
  // manipulatives — kit thao tác (namespace `manip:`), chấm bằng checkAnswer. ĐỘNG, không liệt kê tay.
  ...Object.fromEntries(MANIP_ENTRIES),
  ...Object.fromEntries(CONTENT_ENTRIES),
  // flashcard.ts — tự ôn (SRS SM-2), không phải bài đo
  flashcard: { measurable: false, baseConfidence: 0 },
  // Primitive engine cần thêm (chưa có ở core) — khai trước để sẵn sàng
  'rubric-task': { measurable: true, graderKind: 'rubric', baseConfidence: 0.9 },
  'code-task': { measurable: true, graderKind: 'code', baseConfidence: 1 },
  observation: { measurable: true, graderKind: 'observation', baseConfidence: 0.6 },
  explainer: { measurable: false, baseConfidence: 0 },
}

/**
 * DANH MỤC primitive cho bộ SINH NỘI DUNG — dẫn xuất, không gõ tay.
 *
 * Trước đây adapter sinh item gõ cứng một danh sách 7 loại (`single/boolean/match/...`) trong khi core
 * có 55 loại. Hậu quả: `tenframe`, `numberline`, `partwhole`, `placevalue`, `tally`, `array` — đúng
 * những primitive sinh ra CHO toán tiểu học — chưa từng được sinh lần nào. Đó lại là cùng một lớp lỗi:
 * một quyết định SƯ PHẠM ("dạng bài nào hợp với kiến thức này") bị trả lời bằng một hằng số tình cờ.
 * Nên danh mục phải chảy ra TỪ ĐÂY; chọn loại nào là việc của người/LLM khi đã NHÌN THẤY kiến thức.
 */
export function listPrimitives(pred?: (m: PrimitiveMeta, kind: string) => boolean): string[] {
  return Object.entries(REGISTRY)
    .filter(([kind, meta]) => (pred ? pred(meta, kind) : true))
    .map(([kind]) => kind)
}

/** Mọi loại quiz auto-key của core (55 và còn tăng) — union Zod là nguồn sự thật duy nhất. */
export const QUIZ_PRIMITIVE_KINDS: readonly string[] = QUIZ_TYPES

/**
 * CONTENT BLOCK theo phân loại chấm-được — LẤY TỪ REGISTRY, không lọc lại `CONTENT_BLOCK_META` của core.
 *
 * Vì sao phải qua đây: registry MỚI là nơi chốt "block này đo được không / chấm bằng gì" (nó có thể
 * quyết khác core, vd `experiment` mang answer key → gán grader auto-key). Nếu bên sinh nội dung tự lọc
 * `gradeable` từ core thì hai chỗ có thể LỆCH NHAU mà không ai báo — đúng lớp lỗi "một câu hỏi trả lời
 * ở hai nơi". Trả về type block ĐÃ BỎ tiền tố `block:` (dùng thẳng cho schema/prompt của core).
 *
 * `graded=false` → block để ĐỌC (exposition/dạy). `graded=true` → block CHẤM ĐƯỢC (đi luồng đánh giá).
 */
export function listBlockTypes(opts: { graded: boolean }): string[] {
  return Object.entries(REGISTRY)
    .filter(([kind, meta]) => kind.startsWith(BLOCK_PREFIX) && meta.measurable === opts.graded)
    .map(([kind]) => kind.slice(BLOCK_PREFIX.length))
}

/** Metadata cho một primitiveKind; null nếu chưa đăng ký. */
export function primitiveMeta(kind: string): PrimitiveMeta | null {
  return REGISTRY[kind] ?? null
}

export function isKnownPrimitive(kind: string): boolean {
  return kind in REGISTRY
}
