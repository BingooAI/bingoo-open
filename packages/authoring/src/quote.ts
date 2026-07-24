// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * KIỂM CÂU TRÍCH — làn bằng chứng DUY NHẤT một người không chuyên tự soi được bằng mắt.
 *
 * Một câu AI khai là "trích từ nguồn" chỉ đáng tô xanh khi nó THẬT SỰ có mặt nguyên văn trong
 * nguồn. Đây là phép kiểm rẻ nhất mà mạnh nhất: hoàn toàn xác định, phản chứng được, KHÔNG cần
 * tin LLM — hệt cái canh gác `sfx-catalog` (cố tình phá cho đỏ).
 *
 * KHÔNG có điểm số, KHÔNG có ngưỡng mờ — trùng lập trường của repo (facets/identity.ts từ chối
 * "đo độ giống"). Chỉ ba kết cục: khớp nguyên văn (đã chuẩn hoá), không thấy, hoặc quá ngắn để
 * có nghĩa. Chuẩn hoá là để dung sai khoảng trắng / nháy cong / NFC — KHÔNG phải để nới lỏng tới
 * mức một câu bịa gần giống cũng lọt.
 *
 * "Tìm thấy chuỗi" ≠ "câu này chứng minh mục tiêu". Hàm này chỉ trả lời vế đầu; vế sau là việc
 * của NGƯỜI DUYỆT nhìn câu trích trong ngữ cảnh (R5). Vì thế có sàn tối thiểu: một từ lẻ thường
 * gặp ("Đếm", "Số") hay một tiêu đề cụt KHÔNG được earn màu xanh.
 */

export type QuoteStatus =
  | 'verified' // khớp nguyên văn (sau chuẩn hoá) — tô xanh "từ tài liệu"
  | 'not_found' // không có trong nguồn — coi như AI suy đoán (màu vàng)
  | 'too_short' // quá ngắn/tầm thường để chứng minh gì — không xét là bằng chứng

export interface QuoteMatch {
  readonly status: QuoteStatus
  /** Offset ký tự trong nguồn ĐÃ CHUẨN HOÁ (`normalizeSource`) — để tô sáng đúng đoạn. */
  readonly charStart?: number
  readonly charEnd?: number
}

// Sàn tối thiểu: chặn từ lẻ / tiêu đề cụt earn "từ tài liệu". Không phải "độ giống" — chỉ là
// ngưỡng "đủ đặc trưng để đáng soi". UI vẫn hiện câu trong ngữ cảnh cho người duyệt tự xử vế
// "có đúng là căn cứ không".
const MIN_CHARS = 10
const MIN_WORDS = 2

// Nháy cong, gạch dài, khoảng trắng không ngắt → dạng ASCII, để bản gõ tay và bản OCR khớp nhau.
const FOLD: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '‟': '"',
  '–': '-',
  '—': '-',
  '−': '-',
  ' ': ' ',
}

interface Folded {
  readonly text: string
  /** `map[i]` = chỉ số trong chuỗi gốc (đã NFC) của ký tự thứ i trong `text`. */
  readonly map: readonly number[]
}

/**
 * Gập một chuỗi ĐÃ NFC để so khớp: nháy/gạch → ASCII, chuỗi khoảng trắng → một dấu cách. Giữ
 * `map` để một vị trí khớp trong `text` quay ngược được về chỉ số trong nguồn gốc (tô sáng).
 */
function fold(src: string): Folded {
  let text = ''
  const map: number[] = []
  let prevSpace = false
  for (let i = 0; i < src.length; i++) {
    const raw = src[i] as string
    const c = FOLD[raw] ?? raw
    if (/\s/.test(c)) {
      if (prevSpace) continue // gộp chuỗi khoảng trắng
      text += ' '
      map.push(i)
      prevSpace = true
    } else {
      text += c
      map.push(i)
      prevSpace = false
    }
  }
  return { text, map }
}

/**
 * Dạng CHUẨN của nguồn để LƯU (`SourceDocument.excerptText`). Câu trích được đối chiếu vào đây và
 * offset trả về là chỉ số TRONG chuỗi này — nên phải lưu đúng chuỗi này, không phải bản thô.
 */
export function normalizeSource(extracted: string): string {
  return extracted.normalize('NFC')
}

/**
 * Câu trích `quote` có nằm nguyên văn (sau chuẩn hoá) trong `source` không.
 * `source` là văn bản nguồn thô hoặc đã NFC — hàm tự NFC lại nên truyền gì cũng được; offset trả
 * về khớp với `normalizeSource(source)`.
 */
export function verifyQuote(quote: string, source: string): QuoteMatch {
  const q = fold(quote.normalize('NFC'))
  const needle = q.text.trim()
  const words = needle.split(' ').filter(Boolean)
  if (needle.length < MIN_CHARS || words.length < MIN_WORDS) {
    return { status: 'too_short' }
  }

  const src = fold(source.normalize('NFC'))
  const at = src.text.indexOf(needle)
  if (at === -1) return { status: 'not_found' }

  const charStart = src.map[at] as number
  const charEnd = (src.map[at + needle.length - 1] as number) + 1
  return { status: 'verified', charStart, charEnd }
}
