// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Sinh VỎ KHOÁ (course shell) — cây course→unit→lesson, MAP vào framework:
 * mọi teaches/concepts/objectives chỉ được dùng slug năng lực CÓ THẬT trong đồ thị (lọc cứng).
 * Nguồn: prompt (brief) hoặc sách PDF (OCR qua vision). Chi tiết bài sinh sau ở /plan/generate.
 */

import type { Slug } from '@bingoo.ai/knowledge-engine'
import type { CoursePlan } from '@bingoo.ai/plans'
import { getAi, getVision } from '../providers'
import { renderPrompt } from '../prompts'
import { loadConceptVocab, type ConceptVocabItem } from '../repos/authoring.repo'
import { saveCourse, type SavedCourse } from '../repos/course.repo'
import { AppError } from '../lib/errors'
import { firstJson, sanitizeCourse } from './course-shell.sanitize'
import { modelFor } from '../config/models'

/**
 * CHI PHÍ: tách model cho khâu sinh nội dung. Mặc định Sonnet (nội dung học cần chất lượng hơn
 * trích xuất, nhưng KHÔNG cần Opus). Đổi bằng env `modelFor('content')`, không đụng code.
 */

// Bó vốn từ (KC) đưa vào prompt — chặn trần để không thổi token.
const VOCAB_CAP = 300

export interface CourseShellInput {
  readonly brief: string
  readonly createdBy: string
  readonly frameworkVersionId?: string
  /** Khung để lọc vốn từ KC theo ĐÚNG framework (kèm stage). Trước đây bị rơi âm thầm → lọc sai. */
  readonly frameworkSlug?: string
  /** Phân đoạn chương trình — sách Stage 1 phải neo vào KC Stage 1. Không truyền = toàn đồ thị. */
  readonly stage?: string
  readonly strand?: string
  readonly locale?: string
  readonly aiKey?: string
}

/**
 * Vốn từ KC cho một khung/stage. Đây là chỗ MAP KIẾN THỨC VÀO FRAMEWORK THEO GRADE/STAGE:
 * loadConceptVocab đi OBJECTIVE(mang stage) --MAPS_TO--> KC, nên lọc theo stage/framework cho ra đúng
 * bộ KC mà sách của stage đó được phép dạy. Rỗng → ném lỗi rõ ràng (không sinh khoá treo lơ lửng).
 */
async function stageVocab(input: {
  stage?: string
  strand?: string
  frameworkSlug?: string
}): Promise<ConceptVocabItem[]> {
  const vocab = await loadConceptVocab({
    ...(input.stage ? { stage: input.stage } : {}),
    ...(input.strand ? { strand: input.strand } : {}),
    ...(input.frameworkSlug ? { frameworkSlug: input.frameworkSlug } : {}),
  })
  if (vocab.length === 0) {
    throw AppError.validation([
      {
        path: input.stage ? 'stage' : 'frameworkSlug',
        message:
          input.stage || input.frameworkSlug
            ? `Không có năng lực nào thuộc ${input.frameworkSlug ?? ''} ${input.stage ? `stage "${input.stage}"` : ''}`.trim() +
              ' — sinh & duyệt khung cho phần này trước đã.'
            : 'Đồ thị năng lực đang rỗng — sinh & duyệt khung trước đã.',
        code: 'empty_vocab',
      },
    ])
  }
  return vocab
}

/** Vỏ khoá sau khi lưu, kèm báo cáo cho người soạn (chỉ đường sinh-từ-sách mới có `bookReport`). */
export interface CourseShellResult extends SavedCourse {
  readonly bookReport?: {
    /** Bài GIỮ ĐÚNG VỊ TRÍ trong sách nhưng chưa neo được KC nào — cần người soạn xử lý. */
    readonly unmappedLessons: readonly string[]
    /** OCR bị cắt (sách dài hơn cửa sổ) → có thể thiếu chương cuối. */
    readonly truncated: boolean
  }
}

const throwIfTruncated = (finishReason: string | undefined, hint: string): void => {
  // Hết token → JSON cắt → firstJson trả {} → VỎ KHOÁ RỖNG MÀ IM LẶNG. Im lặng trả rỗng là kiểu
  // hỏng tệ nhất (không tín hiệu nào báo sai) — phải nổ to.
  if (finishReason === 'max_tokens') {
    throw AppError.validation([
      { path: 'brief', message: `Sinh vỏ khoá bị CẮT vì hết token — ${hint}.`, code: 'truncated' },
    ])
  }
}

const assertNonEmpty = (plan: CoursePlan): void => {
  const lessons = plan.units.reduce((n, u) => n + u.lessons.length, 0)
  if (plan.units.length === 0 || lessons === 0) {
    throw AppError.validation([
      {
        path: 'units',
        message:
          'Vỏ khoá sinh ra RỖNG (0 chương/bài) — model không bám được vốn từ KC, hoặc mọi slug nó ' +
          'trả về đều không có thật trong đồ thị. Kiểm lại stage/vốn từ.',
        code: 'empty_course',
      },
    ])
  }
}

/** Vỏ khoá từ PROMPT/brief. Vốn từ KC LỌC THEO framework/stage nếu có; LLM tự thiết kế cấu trúc. */
export async function courseShellFromPrompt(input: CourseShellInput): Promise<CourseShellResult> {
  const vocab = await stageVocab(input)
  const allowed = new Set<Slug>(vocab.map((v) => v.slug))

  const res = await getAi(input.aiKey).generateText({
    system: await renderPrompt('authoring.course.generate', {
      brief: input.brief,
      locale: input.locale ?? 'vi',
      stage: input.stage ?? '(any)',
      vocab: JSON.stringify(
        vocab.slice(0, VOCAB_CAP).map((v) => ({ slug: v.slug, title: v.title, strand: v.strand })),
      ),
    }),
    messages: [{ role: 'user', content: input.brief }],
    model: modelFor('content'),
    maxTokens: 8000,
  })
  throwIfTruncated(res.finishReason, 'rút gọn mô tả hoặc thu hẹp stage')

  const { plan } = sanitizeCourse(firstJson(res.text), allowed, {
    ...(input.frameworkVersionId !== undefined ? { frameworkVersionId: input.frameworkVersionId } : {}),
  })
  assertNonEmpty(plan)
  return saveCourse(plan, input.createdBy, input.frameworkVersionId)
}

// Cửa sổ OCR cho SÁCH — cần thấy TOÀN BỘ mục lục để dựng đúng cây chương/bài. Rộng hơn hẳn brief.
const BOOK_OCR_CAP = 40_000

/**
 * Vỏ khoá từ SÁCH (PDF).
 *
 * KHÁC HẲN đường prompt: sách ĐÃ CÓ cấu trúc và thứ tự của nó, nên việc ở đây là TRÍCH TRUNG THÀNH cây
 * chương→bài theo ĐÚNG trình tự sách, rồi chỉ MAP mỗi bài vào KC của framework. KHÔNG sắp lại theo tiên
 * quyết (đó là điều đường cũ làm sai: nó ném text sách vào prompt tự-do "sắp theo tiên quyết" → vứt sạch
 * cấu trúc sách). Bài nào không map được KC nào vẫn GIỮ đúng chỗ (unmapped) — bỏ đi là nói dối về sách.
 */
export async function courseShellFromBook(
  input: Omit<CourseShellInput, 'brief'> & { pdf: string },
): Promise<CourseShellResult> {
  const vocab = await stageVocab(input)
  const allowed = new Set<Slug>(vocab.map((v) => v.slug))

  const ocr = await getVision().extractText({ image: input.pdf })
  const truncated = ocr.text.length > BOOK_OCR_CAP
  const bookText = ocr.text.slice(0, BOOK_OCR_CAP)

  const res = await getAi(input.aiKey).generateText({
    system: await renderPrompt('authoring.course.fromBook', {
      bookText,
      locale: input.locale ?? 'vi',
      stage: input.stage ?? '(any)',
      vocab: JSON.stringify(
        vocab.slice(0, VOCAB_CAP).map((v) => ({ slug: v.slug, title: v.title, strand: v.strand })),
      ),
    }),
    messages: [{ role: 'user', content: 'Trích cấu trúc sách thành vỏ khoá, giữ nguyên thứ tự.' }],
    model: modelFor('content'),
    maxTokens: 8000,
  })
  throwIfTruncated(res.finishReason, 'sách quá dài, tách theo phần/chương rồi sinh từng phần')

  const { plan, unmappedLessons } = sanitizeCourse(firstJson(res.text), allowed, {
    preserveStructure: true, // sách là sự thật về cấu trúc — giữ mọi bài, đúng thứ tự
    ...(input.frameworkVersionId !== undefined ? { frameworkVersionId: input.frameworkVersionId } : {}),
  })
  assertNonEmpty(plan)

  const saved = await saveCourse(plan, input.createdBy, input.frameworkVersionId)
  return { ...saved, bookReport: { unmappedLessons, truncated } }
}
