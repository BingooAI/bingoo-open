// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Adapter GeneratorPort (content-gen S4b) — LLM sinh QuizQuestion theo ĐÚNG schema @bingoo.ai/core
 * (quizJsonSchema), rồi QuizQuestion.safeParse LỌC bản hợp lệ. BÁM 20 loại quiz có sẵn trong
 * registry — KHÔNG chế primitive mới. Bản hỏng schema bị loại thẳng.
 */

import type { AuthoredItem } from '@bingoo.ai/authored-item'
import {
  QUIZ_PRIMITIVE_KINDS,
  blockKind,
  isKnownPrimitive,
  listBlockTypes,
  manipKind,
  primitiveMeta,
  validateItem,
} from '@bingoo.ai/authored-item'
import { KIT_DOCS, kitAnswerDoc } from '@bingoo.ai/manipulatives'
import {
  ContentBlock,
  Flashcard,
  QuizQuestion,
  contentJsonSchema,
  flashcardDeckJsonSchema,
  quizJsonSchema,
} from '@bingoo.ai/core'
import type { ExpositionPort, FlashcardPort, GeneratorPort } from '@bingoo.ai/content-gen'
import type { Slug } from '@bingoo.ai/knowledge-engine'
import type { DifficultyBand, GenerationSpec } from '@bingoo.ai/personalization'
import { getAi } from '../providers'
import { readEnv } from '../providers/core/config'
import { renderPrompt } from '../prompts'

/**
 * CHI PHÍ: tách model cho khâu sinh nội dung. Mặc định Sonnet (nội dung học cần chất lượng hơn
 * trích xuất, nhưng KHÔNG cần Opus). Đổi bằng env `CONTENT_MODEL`, không đụng code.
 */
const CONTENT_MODEL = readEnv('CONTENT_MODEL') ?? 'claude-sonnet-5'

const BAND_ELO: Record<DifficultyBand, number> = { easy: 1300, core: 1500, stretch: 1700 }

/** Locale sinh content: "en" (GỐC) luôn đứng đầu, + các ngôn ngữ yêu cầu, dedupe giữ thứ tự. */
function localeList(languages: readonly string[] | undefined, fallback: string): string[] {
  const out = ['en']
  for (const l of languages && languages.length ? languages : [fallback]) {
    const k = (l ?? '').trim()
    if (k && !out.includes(k)) out.push(k)
  }
  return out
}

/**
 * DANH MỤC dạng bài — dẫn xuất từ registry (union Zod của core), KHÔNG gõ tay.
 *
 * Trước đây chỗ này là một bảng cứng 7 loại (single/boolean/match/multiple/fill/numeric/categorize)
 * trong khi core có 55. Nghĩa là `tenframe`, `numberline`, `partwhole`, `placevalue`, `tally`, `array`
 * — đúng những primitive được làm RA CHO toán tiểu học — chưa từng được sinh một lần nào. Không có lỗi
 * nào nổ ra: hệ vẫn sinh item hợp lệ, chỉ là luôn sinh nhầm loại.
 *
 * Đây lại vẫn là một câu hỏi SƯ PHẠM ("dạng bài nào bắt học sinh LÀM đúng cái đang học?") bị trả lời
 * bằng một hằng số tình cờ. Câu hỏi đó chỉ trả lời được khi đã NHÌN THẤY kiến thức cụ thể — nên nó
 * thuộc về người/LLM lúc sinh, còn tầng này chỉ có một việc: đưa ra ĐỦ danh mục và ĐỦ ngữ cảnh.
 */
const CATALOGUE = QUIZ_PRIMITIVE_KINDS.join(', ')

/** Số item mỗi KC. Nhiều dạng khác nhau > nhiều item cùng một dạng. */
const ITEMS_PER_KC = 4

// Hợp đồng schema tĩnh — tính 1 lần, nhét vào prompt để model bám đúng union trên "type".
const SCHEMA_JSON = JSON.stringify(quizJsonSchema())
const CONTENT_SCHEMA_JSON = JSON.stringify(contentJsonSchema())
const FLASHCARD_SCHEMA_JSON = JSON.stringify(flashcardDeckJsonSchema())

function parseItems(text: string): unknown[] {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return []
  try {
    const p = JSON.parse(m[0]) as { items?: unknown }
    return Array.isArray(p.items) ? p.items : []
  } catch {
    return []
  }
}

/** raw model → AuthoredItem; null nếu KHÔNG hợp schema core / primitive chưa đăng ký. */
function toAuthoredItem(raw: unknown, kc: Slug, index: number, elo: number): AuthoredItem | null {
  const parsed = QuizQuestion.safeParse(raw)
  if (!parsed.success) {
    if (process.env.DEBUG_GEN)
      console.error(
        '[toAuthoredItem] safeParse FAIL',
        JSON.stringify(parsed.error.issues.slice(0, 4)),
        '\nraw=',
        JSON.stringify(raw).slice(0, 600),
      )
    return null
  }
  const q = parsed.data
  if (!isKnownPrimitive(q.type)) {
    if (process.env.DEBUG_GEN) console.error('[toAuthoredItem] primitive chưa đăng ký:', q.type)
    return null
  }
  const itemKey = `${kc}::${q.type}::${index}`
  // THANG HỖ TRỢ 4 level (hint/guide/instruction/teach, đa ngôn ngữ) — LLM sinh kèm nhưng `QuizQuestion`
  // schema core KHÔNG có field này nên safeParse STRIP mất; lấy lại từ raw để lưu SONG SONG như kit
  // (không đụng core; QuizShell không render, dùng cho TTS/chat sau). Xem [[content-authoring-spec]].
  const support = (raw as { support?: unknown }).support
  const item: AuthoredItem = {
    itemKey,
    skills: [kc],
    difficulty: elo,
    mode: 'LEARN',
    primitiveKind: q.type,
    payload: { ...q, id: itemKey, ...(support && typeof support === 'object' ? { support } : {}) },
  }
  const errs = validateItem(item).filter((i) => i.severity === 'error')
  if (errs.length && process.env.DEBUG_GEN)
    console.error('[toAuthoredItem] validate FAIL', q.type, JSON.stringify(errs.slice(0, 4)))
  return errs.length ? null : item
}

function parseBlocks(text: string): unknown[] {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return []
  try {
    const p = JSON.parse(m[0]) as { blocks?: unknown }
    return Array.isArray(p.blocks) ? p.blocks : []
  } catch {
    return []
  }
}

// Content HỌC chỉ dùng block KHÔNG chấm được. Danh mục LẤY TỪ REGISTRY (nguồn sự thật về measurable),
// không tự lọc `CONTENT_BLOCK_META` của core — để đường HỌC và đường ĐÁNH GIÁ cùng tin MỘT chỗ.
const TEACHING_BLOCKS: readonly string[] = listBlockTypes({ graded: false })

/** raw model → AuthoredItem content HỌC (measurable=false); null nếu sai schema / là block chấm được. */
function toBlockItem(raw: unknown, kc: Slug, index: number): AuthoredItem | null {
  const parsed = ContentBlock.safeParse(raw)
  if (!parsed.success) return null
  const b = parsed.data
  const kind = blockKind(b.type) // namespace: tránh va với quiz type trùng tên (vd "math")
  const meta = primitiveMeta(kind)
  if (!meta) return null // block lạ, chưa đăng ký
  if (meta.measurable) return null // block CHẤM ĐƯỢC → thuộc luồng đánh giá, không lẫn vào phần dạy
  const item: AuthoredItem = {
    itemKey: `${kc}::teach::${index}`,
    skills: [kc],
    difficulty: 1500, // không dùng (phơi bày), nhưng field bắt buộc
    measurable: false,
    primitiveKind: kind,
    payload: b,
  }
  return validateItem(item).some((i) => i.severity === 'error') ? null : item
}

/** Dựng ExpositionPort (content HỌC) từ hạ tầng AI. Sinh content block phơi bày cho 1 KC. */
export function buildExpositionPort(opts?: { aiKey?: string }): ExpositionPort {
  return {
    async generate(spec: GenerationSpec, kc: Slug): Promise<readonly AuthoredItem[]> {
      const res = await getAi(opts?.aiKey).generateText({
        system: await renderPrompt('content.exposition.generate', {
          kc,
          band: spec.difficultyBand,
          language: spec.language,
          storyTheme: spec.storyTheme ?? '',
          blocks: TEACHING_BLOCKS.join(', '),
          schema: CONTENT_SCHEMA_JSON,
        }),
        messages: [{ role: 'user', content: `KC=${kc}` }],
        model: CONTENT_MODEL,
        maxTokens: 2000,
      })
      if (res.finishReason === 'max_tokens') {
        // Cắt token → JSON dở → parse hỏng → trả RỖNG mà im lặng. Phải nổ (xem authoring-adapters).
        throw new Error('Sinh nội dung bị CẮT vì hết token — giảm phạm vi yêu cầu.')
      }
      return parseBlocks(res.text)
        .map((raw, i) => toBlockItem(raw, kc, i))
        .filter((it): it is AuthoredItem => it !== null)
    },
  }
}

function parseCards(text: string): unknown[] {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return []
  try {
    const p = JSON.parse(m[0]) as { cards?: unknown }
    return Array.isArray(p.cards) ? p.cards : []
  } catch {
    return []
  }
}

/** raw model → AuthoredItem flashcard ÔN TẬP (measurable=false); null nếu không hợp schema. */
function toCardItem(raw: unknown, kc: Slug, index: number): AuthoredItem | null {
  const parsed = Flashcard.safeParse(raw)
  if (!parsed.success) return null
  const itemKey = `${kc}::card::${index}`
  const item: AuthoredItem = {
    itemKey,
    skills: [kc],
    difficulty: 1500, // không dùng (ôn tập), field bắt buộc
    measurable: false,
    primitiveKind: 'flashcard',
    payload: { ...parsed.data, id: itemKey },
  }
  return validateItem(item).some((i) => i.severity === 'error') ? null : item
}

/** Dựng FlashcardPort (content ÔN TẬP). Sinh flashcard cho 1 KC. */
export function buildFlashcardPort(opts?: { aiKey?: string }): FlashcardPort {
  return {
    async generate(spec: GenerationSpec, kc: Slug): Promise<readonly AuthoredItem[]> {
      const res = await getAi(opts?.aiKey).generateText({
        system: await renderPrompt('content.flashcard.generate', {
          kc,
          language: spec.language,
          storyTheme: spec.storyTheme ?? '',
          schema: FLASHCARD_SCHEMA_JSON,
        }),
        messages: [{ role: 'user', content: `KC=${kc}` }],
        model: CONTENT_MODEL,
        maxTokens: 1500,
      })
      if (res.finishReason === 'max_tokens') {
        // Cắt token → JSON dở → parse hỏng → trả RỖNG mà im lặng. Phải nổ (xem authoring-adapters).
        throw new Error('Sinh nội dung bị CẮT vì hết token — giảm phạm vi yêu cầu.')
      }
      return parseCards(res.text)
        .map((raw, i) => toCardItem(raw, kc, i))
        .filter((it): it is AuthoredItem => it !== null)
    },
  }
}

/**
 * Dựng GeneratorPort (content ĐÁNH GIÁ). `kinds` GIỚI HẠN danh mục (dùng khi người soạn cố ý ép một
 * dạng); bỏ trống → mở TOÀN BỘ danh mục và để bên sinh tự chọn dạng hợp với kiến thức.
 */
export function buildGeneratorPort(opts?: {
  aiKey?: string
  kinds?: readonly string[]
  count?: number
  /** Brief step (grounding): item phải hiện thực hoá đúng ý đồ step, không sinh chung chung theo KC. */
  brief?: string
  /** Locale cho THANG HỖ TRỢ (đa ngôn ngữ, en gốc). Đề quiz vẫn theo spec.language (multi-locale text = pass sau). */
  languages?: readonly string[]
  /** Điểm sai thường gặp (đã render) — distractor NHẮM đúng hiểu-sai, không bịa ngẫu nhiên. */
  misconceptions?: string
}): GeneratorPort {
  return {
    async generate(spec: GenerationSpec, kc: Slug): Promise<readonly AuthoredItem[]> {
      const catalogue = opts?.kinds?.length ? opts.kinds.join(', ') : CATALOGUE
      const count = opts?.count ?? opts?.kinds?.length ?? ITEMS_PER_KC
      const locales = localeList(opts?.languages, spec.language)
      const res = await getAi(opts?.aiKey).generateText({
        system: await renderPrompt('content.item.generate', {
          kc,
          band: spec.difficultyBand,
          language: spec.language,
          locales: locales.join(', '),
          storyTheme: spec.storyTheme ?? '',
          representation: spec.scaffolding.representationStage,
          count: String(count),
          catalogue,
          schema: SCHEMA_JSON,
          brief: opts?.brief ?? '(no specific brief — design a fitting item for the KC)',
          misconceptions: opts?.misconceptions ?? '(none listed — write plausible distractors)',
        }),
        messages: [{ role: 'user', content: `KC=${kc}` }],
        model: CONTENT_MODEL,
        // Đa-locale (prompt/label/explanation mỗi locale) + thang hỗ trợ 4 level (mỗi cấp đa-locale) → item
        // dài gấp ~3; trần thấp cắt JSON giữa chừng (nổ ở finishReason). Nới đủ cho vài item đa ngôn ngữ.
        maxTokens: 16000,
      })
      if (res.finishReason === 'max_tokens') {
        // Cắt token → JSON dở → parse hỏng → trả RỖNG mà im lặng. Phải nổ (xem authoring-adapters).
        throw new Error('Sinh nội dung bị CẮT vì hết token — giảm phạm vi yêu cầu.')
      }
      const elo = BAND_ELO[spec.difficultyBand]
      const parsed = parseItems(res.text)
      if (process.env.DEBUG_GEN)
        console.error(
          '[quizPort]',
          'finish=',
          res.finishReason,
          'textLen=',
          res.text.length,
          'parsed=',
          parsed.length,
          parsed.length ? '' : `\ntextHead=${res.text.slice(0, 400)}`,
        )
      return parsed
        .map((raw, i) => toAuthoredItem(raw, kc, i, elo))
        .filter((it): it is AuthoredItem => it !== null)
    },
  }
}

/**
 * raw model → AuthoredItem cho MANIPULATIVE kit. Bất biến: `target` PHẢI theo hợp đồng đáp án của kit
 * (mọi khoá trong `answer.example`, đúng kiểu) → `manipGrader` mới chấm được. Sai hợp đồng → loại thẳng
 * (không lưu item không chấm được). `payload = { kind, target, prompt }` khớp thứ manipGrader đọc.
 */
function toKitItem(raw: unknown, kc: Slug, kind: string, index: number, elo: number): AuthoredItem | null {
  const r = (raw ?? {}) as {
    prompt?: unknown
    target?: unknown
    support?: unknown
    params?: unknown
    objectLabel?: unknown
  }
  const ans = kitAnswerDoc(kind)
  if (!ans || !r.target || typeof r.target !== 'object') {
    if (process.env.DEBUG_GEN)
      console.error('[toKitItem] no target/ans', kind, 'raw=', JSON.stringify(raw).slice(0, 500))
    return null
  }
  const tgt = r.target as Record<string, unknown>
  // Hợp đồng đáp án: mọi khoá mẫu phải có trong target, đúng kiểu (chống LLM tạo target sai hình dạng).
  for (const [k, v] of Object.entries(ans.example)) {
    if (!(k in tgt) || typeof tgt[k] !== typeof v) {
      if (process.env.DEBUG_GEN)
        console.error('[toKitItem] target sai hợp đồng: khoá', k, 'target=', JSON.stringify(tgt))
      return null
    }
  }
  const itemKey = `${kc}::${manipKind(kind)}::${index}`
  const item: AuthoredItem = {
    itemKey,
    skills: [kc],
    difficulty: elo,
    mode: 'LEARN',
    measurable: true,
    primitiveKind: manipKind(kind),
    // support = thang hỗ trợ 4 level (hint/guide/instruction/teach), đa ngôn ngữ — cho audio/chat sau.
    payload: {
      id: itemKey,
      kind,
      target: tgt,
      // params = trạng thái đầu của kit (shape/count…) → preview render đúng vật + số như prompt mô tả.
      ...(r.params && typeof r.params === 'object' ? { params: r.params } : {}),
      // objectLabel = vật thật (đơn lẻ) → dùng làm query sinh ảnh-vật cho kit (1 vật, không cả cảnh).
      ...(r.objectLabel && typeof r.objectLabel === 'object' ? { objectLabel: r.objectLabel } : {}),
      ...(r.prompt ? { prompt: r.prompt } : {}),
      ...(r.support ? { support: r.support } : {}),
    },
  }
  const errs = validateItem(item).filter((i) => i.severity === 'error')
  if (errs.length && process.env.DEBUG_GEN)
    console.error('[toKitItem] validate FAIL', JSON.stringify(errs.slice(0, 4)))
  return errs.length ? null : item
}

/**
 * GeneratorPort cho ITEM MANIPULATIVE — sinh nhiệm vụ học sinh LÀM trên kit (tenframe, numberline…),
 * chấm được qua `checkAnswer`. `kinds` = kit đã khai hợp đồng đáp án (GRADABLE_KITS hoặc do người soạn
 * ép). Mỗi kit sinh `count` item cho KC. Item sai hợp đồng bị loại (không lưu rác không chấm được).
 */
export function buildKitGeneratorPort(opts: {
  kinds: readonly string[]
  aiKey?: string
  count?: number
  /** Đa ngôn ngữ: sinh text cho MỌI locale này (en luôn có, là gốc). Mặc định [en, spec.language]. */
  languages?: readonly string[]
  /** Brief step (grounding) — task phải bám đúng ý đồ step. */
  brief?: string
  /** Điểm sai thường gặp (đã render) — task/gợi ý nhắm đúng hiểu-sai. */
  misconceptions?: string
}): GeneratorPort {
  return {
    async generate(spec: GenerationSpec, kc: Slug): Promise<readonly AuthoredItem[]> {
      const items: AuthoredItem[] = []
      const elo = BAND_ELO[spec.difficultyBand]
      const count = opts.count ?? 2
      const locales = localeList(opts.languages, spec.language)
      for (const kind of opts.kinds) {
        const doc = KIT_DOCS[kind]
        const ans = kitAnswerDoc(kind)
        if (!doc || !ans) continue // chỉ kit đã khai answer (chưa khai → không sinh bừa)
        const res = await getAi(opts.aiKey).generateText({
          system: await renderPrompt('content.kititem.generate', {
            kc,
            band: spec.difficultyBand,
            locales: locales.join(', '),
            kind,
            kitDesc: doc.desc,
            kitVerbs: doc.verbs,
            paramEnums: JSON.stringify(doc.paramEnums ?? {}),
            answerShape: ans.shape,
            answerExample: JSON.stringify(ans.example),
            count: String(count),
            brief: opts.brief ?? '(no specific brief — design a fitting task for the KC)',
            misconceptions: opts.misconceptions ?? '(none listed)',
          }),
          messages: [{ role: 'user', content: `KC=${kc} KIT=${kind}` }],
          model: CONTENT_MODEL,
          // Kit cũng đa-locale (prompt/support 4 level mỗi locale) → nới trần.
          maxTokens: 8000,
        })
        if (res.finishReason === 'max_tokens') throw new Error('Sinh item kit bị CẮT — giảm count.')
        const parsed = parseItems(res.text)
        if (process.env.DEBUG_GEN)
          console.error(
            '[kitPort]',
            kind,
            'finish=',
            res.finishReason,
            'textLen=',
            res.text.length,
            'parsed=',
            parsed.length,
            parsed.length ? '' : `\ntextHead=${res.text.slice(0, 400)}`,
          )
        parsed.forEach((raw, i) => {
          const it = toKitItem(raw, kc, kind, i, elo)
          if (it) items.push(it)
        })
      }
      return items
    },
  }
}
