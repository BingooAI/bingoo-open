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
import { rec, sanitizeCourse } from './course-shell.sanitize'
import { parseModelJson } from '../lib/model-json'
import { modelFor } from '../config/models'
import { writeBookTraces, type WriteTraceResult } from './decision-trace.service'
import { pdfPositionedUnits } from './pdf-anchor.service'
import { splitPdfBySize } from './pdf-split.service'

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
    /** Kiến thức sách dạy mà khung chưa có — đề xuất làm dày, chờ người duyệt. */
    readonly proposed: number
    /** Ánh xạ model đề xuất nhưng bị loại vì không có trong vốn từ khung — có thẻ ghi lý do. */
    readonly dropped: number
    /** Thẻ căn cứ đã ghi. Vắng = ghi hỏng, và chỗ gọi phải thấy điều đó. */
    readonly traces?: WriteTraceResult
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

  const { plan } = sanitizeCourse(parseModelJson(res.text, 'Không dựng được vỏ khoá học'), allowed, {
    ...(input.frameworkVersionId !== undefined ? { frameworkVersionId: input.frameworkVersionId } : {}),
  })
  assertNonEmpty(plan)
  return saveCourse(plan, input.createdBy, input.frameworkVersionId)
}

// Cửa sổ OCR cho SÁCH — cần thấy TOÀN BỘ mục lục để dựng đúng cây chương/bài. Rộng hơn hẳn brief.
const BOOK_OCR_CAP = 40_000

/**
 * Dưới ngưỡng này thì coi như PDF không có lớp chữ (sách quét thành ảnh) và phải OCR.
 *
 * Không đặt bằng 0: một cuốn sách quét vẫn thường rút ra được dăm chục ký tự rác từ chữ ký số hoặc
 * số trang, và nhận nhầm đám đó làm nội dung sách thì kết quả là một vỏ khoá rỗng mà không ai hiểu
 * vì sao.
 */
const LOCAL_TEXT_FLOOR = 2_000

/**
 * Trần dung lượng mỗi phần gửi đi đọc ảnh.
 *
 * Đặt thấp hơn hẳn giới hạn của nhà cung cấp, vì giới hạn đó tính trên bản mã hoá base64 — phình
 * thêm khoảng một phần ba — và mỗi nhà cung cấp một con số. Chọn ngưỡng an toàn cho mọi nhà thì
 * không phải đi dò lại mỗi lần đổi.
 */
const OCR_CHUNK_BYTES = 3_500_000

/**
 * Đọc lớp chữ có sẵn trong PDF, không gọi ra ngoài. `undefined` khi không đọc được.
 *
 * Hỏng ở đây KHÔNG được ném: nó chỉ có nghĩa là phải OCR, và OCR là đường vốn đã có.
 */
/**
 * OCR cả cuốn — và khi nó không nhận nổi thì nói ra CHUYỆN GÌ ĐANG XẢY RA.
 *
 * Một cuốn sách giáo khoa quét thành ảnh không có lớp chữ nào để đọc tại chỗ, nên nó buộc phải đi
 * qua dịch vụ đọc ảnh; và dịch vụ đó có trần dung lượng mà một cuốn sách thật vượt qua dễ dàng.
 * Ném nguyên câu trả lời của nhà cung cấp ra ngoài thì người dùng nhận được "tệp vượt quá dung
 * lượng cho phép" — đúng về mặt kỹ thuật và vô dụng: nó không nói tệp nào, không nói vì sao một
 * cuốn PDF khác cùng cỡ lại chạy được, và không nói phải làm gì.
 *
 * Đây là một GIỚI HẠN CHƯA GỠ, không phải một lỗi thoáng qua. Câu báo nói đúng như vậy.
 */
async function ocrBook(pdfUrl: string, localChars: number): Promise<string> {
  try {
    return (await getVision().extractText({ image: pdfUrl })).text
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/exceeds the maximum allowed size|too large|payload/i.test(msg)) throw e
    // Quá cỡ → cắt thành từng phần rồi đọc lần lượt. Không phải đường dự phòng cho có: đây là cách
    // DUY NHẤT một cuốn sách quét thật đi qua được.
    return ocrInChunks(pdfUrl, localChars)
  }
}

/**
 * Đọc ảnh THEO TỪNG PHẦN, và DỪNG khi đã đủ chữ.
 *
 * Dừng sớm không phải để tiết kiệm cho vui: việc ở đây là dựng cây chương/bài, mà cây đó nằm ở đầu
 * sách. Đọc hết 266 trang một cuốn sách quét để rồi cắt bỏ tất cả trừ 40.000 ký tự đầu là trả tiền
 * cho thứ bị vứt ngay sau đó.
 *
 * Dừng sớm thì `truncated` phải bật, và nó bật — người soạn cần biết những chương cuối có thể chưa
 * được nhìn tới.
 */
async function ocrInChunks(pdfUrl: string, localChars: number): Promise<string> {
  const res = await fetch(pdfUrl)
  if (!res.ok) {
    throw AppError.validation([
      { path: 'pdf', message: 'Không tải được tệp sách để cắt.', code: 'book_fetch_failed' },
    ])
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  const { chunks, pageCount } = await splitPdfBySize(bytes, OCR_CHUNK_BYTES)
  if (chunks.length === 0) {
    throw AppError.validation([
      {
        path: 'pdf',
        message:
          `Cuốn sách này là bản QUÉT (rút thẳng chỉ được ${localChars} ký tự) và không cắt nhỏ được ` +
          'để đọc ảnh — tệp có thể hỏng hoặc bị khoá. Hãy thử tách sách theo chương rồi bóc từng phần.',
        code: 'book_unsplittable',
      },
    ])
  }

  const parts: string[] = []
  let chars = 0
  for (const [i, chunk] of chunks.entries()) {
    const b64 = Buffer.from(chunk).toString('base64')
    const out = await getVision().extractText({ image: b64, mediaType: 'application/pdf' })
    parts.push(out.text)
    chars += out.text.length
    if (chars >= BOOK_OCR_CAP) {
      console.log(`[course:from-book] đọc ${i + 1}/${chunks.length} phần (${pageCount} trang) là đủ chữ`)
      break
    }
  }
  return parts.join('\n\n')
}

async function extractBookTextLocally(pdfUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(pdfUrl)
    if (!res.ok) return undefined
    const { units } = await pdfPositionedUnits(new Uint8Array(await res.arrayBuffer()))
    const text = units
      .map((u) => u.text)
      .join(' ')
      .trim()
    return text.length > 0 ? text : undefined
  } catch {
    return undefined
  }
}

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

  /**
   * RÚT CHỮ TẠI CHỖ TRƯỚC, OCR chỉ khi cần.
   *
   * Trước đây cả cuốn sách được đẩy lên dịch vụ đọc ảnh, kể cả khi nó vốn đã có sẵn chữ. Một cuốn
   * sách giáo khoa thật nặng gần trăm megabyte, và dịch vụ trả về đúng một câu: tệp vượt quá dung
   * lượng cho phép. Nghĩa là đường bóc sách hỏng với chính loại tệp mà nó tồn tại để xử lý.
   *
   * Sách in ra PDF thì có sẵn lớp chữ — đọc tại chỗ vừa không giới hạn dung lượng, vừa không tốn
   * một lượt gọi ra ngoài. OCR vẫn cần cho sách quét thành ảnh, và đó là lúc nó được gọi: khi rút
   * tại chỗ ra quá ít chữ để tin.
   */
  const local = await extractBookTextLocally(input.pdf)
  const raw =
    local !== undefined && local.length >= LOCAL_TEXT_FLOOR
      ? local
      : await ocrBook(input.pdf, local?.length ?? 0)
  const truncated = raw.length > BOOK_OCR_CAP
  const bookText = raw.slice(0, BOOK_OCR_CAP)

  /**
   * HAI LƯỢT: danh sách chương trước, rồi bài của từng chương.
   *
   * Một lượt duy nhất phải nhả ra cây chương + bài + ánh xạ + câu trích của cả cuốn sách, và độ dài
   * đó phụ thuộc vào việc sách dày bao nhiêu. Đo được trên một cuốn 266 trang: đầu ra chạm trần
   * token, JSON đứt giữa chừng, vỏ khoá ra rỗng. Nới trần chỉ dời chỗ vỡ sang cuốn dày hơn.
   *
   * Cắt việc thì mỗi lượt có kích thước tự nó quyết định: danh sách chương luôn nhỏ; bài của MỘT
   * chương cũng nhỏ, dù sách có bao nhiêu chương.
   */
  const unitsRes = await getAi(input.aiKey).generateText({
    system: await renderPrompt('authoring.course.bookUnits', { bookText, locale: input.locale ?? 'vi' }),
    messages: [{ role: 'user', content: 'Liệt kê các chương của sách, đúng thứ tự.' }],
    model: modelFor('content'),
    maxTokens: 4000,
  })
  throwIfTruncated(unitsRes.finishReason, 'danh sách chương quá dài, tách sách theo phần rồi bóc từng phần')
  const shell = rec(parseModelJson(unitsRes.text, 'Không đọc được danh sách chương'))
  const rawUnits = Array.isArray(shell.units) ? (shell.units as Record<string, unknown>[]) : []
  if (rawUnits.length === 0) {
    throw AppError.validation([
      {
        path: 'units',
        message: 'Không tìm thấy chương nào trong sách — kiểm lại tệp, hoặc sách không có mục lục rõ ràng.',
        code: 'no_units',
      },
    ])
  }

  const vocabJson = JSON.stringify(
    vocab.slice(0, VOCAB_CAP).map((v) => ({ slug: v.slug, title: v.title, strand: v.strand })),
  )

  // Bài của TỪNG chương — tuần tự, để một chương hỏng không kéo cả cuốn theo.
  const units: Record<string, unknown>[] = []
  for (const u of rawUnits) {
    const title = String((rec(u.title).vi ?? rec(u.title).en ?? u.slug) as string)
    const lessonsRes = await getAi(input.aiKey).generateText({
      system: await renderPrompt('authoring.course.bookLessons', {
        bookText,
        unitTitle: title,
        unitRef: String(u.sourceRef ?? ''),
        locale: input.locale ?? 'vi',
        vocab: vocabJson,
      }),
      messages: [{ role: 'user', content: `Trích các bài của chương "${title}".` }],
      model: modelFor('content'),
      maxTokens: 6000,
    })
    throwIfTruncated(lessonsRes.finishReason, `chương "${title}" quá dài, tách nhỏ rồi bóc lại`)
    const got = rec(parseModelJson(lessonsRes.text, `Không đọc được bài của chương "${title}"`))
    units.push({ ...u, lessons: Array.isArray(got.lessons) ? got.lessons : [] })
  }

  const { plan, unmappedLessons, mappings, proposed, dropped } = sanitizeCourse(
    { ...shell, units },
    allowed,
    {
      preserveStructure: true, // sách là sự thật về cấu trúc — giữ mọi bài, đúng thứ tự
      ...(input.frameworkVersionId !== undefined ? { frameworkVersionId: input.frameworkVersionId } : {}),
    },
  )
  assertNonEmpty(plan)

  const saved = await saveCourse(plan, input.createdBy, input.frameworkVersionId)

  /**
   * THẺ CĂN CỨ CHO SÁCH — vì sao bài này dạy kiến thức đó, và sách dạy thêm những gì.
   *
   * Không có phần này thì vỏ khoá sinh ra từ một cuốn sách thật vẫn là một cây chương/bài không ai
   * hỏi được "dựa vào đâu": ánh xạ bài→kiến thức do model chọn, và không một dòng nào nói nó chọn
   * dựa trên câu nào trong sách.
   *
   * Ghi hỏng KHÔNG chặn: vỏ khoá đã lưu xong và vẫn dùng được. Nhưng nói ra là ghi hỏng, chứ không
   * âm thầm trả về như thể có đủ căn cứ.
   */
  let traces: WriteTraceResult | undefined
  try {
    // Vốn từ chỉ mang nhan đề TIẾNG ANH (một chuỗi) — dựng dạng đa ngữ tối thiểu, không bịa bản dịch.
    const titles = new Map(vocab.map((v) => [v.slug as string, { en: v.title } as Record<string, string>]))
    traces = await writeBookTraces(saved.plan.slug, { mappings, proposed }, bookText, titles)
  } catch (e) {
    console.error('[course:from-book] ghi thẻ căn cứ hỏng', e)
  }

  return {
    ...saved,
    bookReport: {
      unmappedLessons,
      truncated,
      proposed: proposed.length,
      dropped: dropped.length,
      ...(traces ? { traces } : {}),
    },
  }
}
