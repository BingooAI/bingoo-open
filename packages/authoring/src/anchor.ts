// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * NEO VỊ TRÍ — định vị một câu trích TRONG tài liệu để "mở đúng trang, tô đúng dòng".
 *
 * Thuần (R2): KHÔNG parse PDF ở đây. Adapter bẩn (pdfjs) ở apps/api biến tài liệu thành luồng
 * `PositionedUnit` (mỗi TỪ một hộp, theo thứ tự đọc); lõi này nhận luồng đó + câu trích và trả
 * `Anchor`. Định dạng khác (sách/EPUB/scan) chỉ thêm một nhánh `SourceLocator` + một adapter — lõi
 * KHÔNG đổi.
 *
 * Trung thực (những chỗ phản biện đào ra):
 *  • verdict XANH và KHUNG TÔ sinh từ CÙNG một lần khớp — không dựng toạ độ bằng phép tính thứ hai.
 *  • Trùng chữ trên trang → `occurrences>1` ⇒ KHÔNG khung (không biết cái nào) dù chữ CÓ thật.
 *  • Span nhảy trang / thứ tự đọc đứt quãng (nhiều cột) ⇒ giữ "có trên trang" nhưng KHÔNG vẽ khung bừa.
 *  • Khung ở mức TỪ/RUN (hộp của pdfjs), KHÔNG nội suy dưới-glyph (giả chính xác).
 */

import { foldForMatch } from './quote'

/** Hộp chuẩn hoá 0..1 theo khổ trang, gốc GÓC TRÊN-TRÁI — độc lập DPI/zoom/xoay. */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** "Ở đâu" theo định dạng. Union — lõi lưu mờ, mỗi viewer chỉ đọc nhánh của mình. */
export type SourceLocator =
  | { readonly kind: 'pdf'; readonly page: number; readonly rects: readonly Rect[] }
  | { readonly kind: 'text'; readonly start: number; readonly end: number }
// dành sẵn (chưa hiện thực): 'ocr' {page,rects} | 'epub' {cfi} | 'html' {startPath,…}

/** Đơn vị NHỎ NHẤT adapter dám bảo chứng một hộp: một TỪ (pdf), theo thứ tự đọc. */
export interface PositionedUnit {
  readonly text: string // glyph THÔ (chưa chuẩn hoá) — matcher tự chuẩn hoá
  readonly page?: number // pdf/ocr
  readonly rect?: Rect // hộp của riêng đơn vị này; vắng = luồng text thuần (không toạ độ)
  readonly order: number // chỉ số thứ tự đọc, đơn điệu toàn tài liệu
}

export type MatchQuality = 'exact' | 'not_found'

export interface Anchor {
  /** 'exact' = tìm thấy nguyên văn (sau chuẩn hoá an toàn). Chưa làm tầng gần-đúng (MVP PDF-first). */
  readonly matchQuality: MatchQuality
  /** Số lần câu xuất hiện exact. >1 ⇒ chữ có thật nhưng KHÔNG khung (không rõ cái nào). */
  readonly occurrences: number
  /** Chỉ có khi định vị được TIN CẬY (đúng 1 lần + cùng trang + đọc liền mạch). */
  readonly locator?: SourceLocator
}

const MIN_CHARS = 10
const MIN_WORDS = 2
const SEP = '\n' // ranh giới đơn vị trong chuỗi ghép — fold gộp nó thành 1 dấu cách

/**
 * Định vị `quote` trong `units`. Cùng một phép gập/khớp như verifyQuote, nhưng trên chuỗi GHÉP của
 * các đơn vị, giữ map ngược ra đơn vị → khung tô = hợp hộp của các đơn vị mà span chạm vào.
 */
export function locateInUnits(quote: string, units: readonly PositionedUnit[]): Anchor {
  if (units.length === 0) return { matchQuality: 'not_found', occurrences: 0 }

  // Chuỗi ghép (đã NFC) + owner[i] = chỉ số đơn vị của ký tự i (ký tự SEP → -1).
  let raw = ''
  const owner: number[] = []
  units.forEach((u, ui) => {
    if (ui > 0) {
      raw += SEP
      owner.push(-1)
    }
    const t = u.text.normalize('NFC')
    raw += t
    for (let k = 0; k < t.length; k++) owner.push(ui)
  })

  const src = foldForMatch(raw)
  const q = foldForMatch(quote.normalize('NFC'))
  const needle = q.text.trim()
  if (needle.length < MIN_CHARS || needle.split(' ').filter(Boolean).length < MIN_WORDS) {
    return { matchQuality: 'not_found', occurrences: 0 }
  }

  // Đếm số lần xuất hiện exact.
  let occurrences = 0
  let firstAt = -1
  for (let i = src.text.indexOf(needle); i !== -1; i = src.text.indexOf(needle, i + 1)) {
    if (firstAt === -1) firstAt = i
    occurrences++
  }
  if (occurrences === 0) return { matchQuality: 'not_found', occurrences: 0 }
  if (occurrences > 1) return { matchQuality: 'exact', occurrences } // chữ có thật, nhưng KHÔNG khung

  // Đúng 1 lần → map span folded về raw, gom đơn vị chạm vào.
  const rawStart = src.map[firstAt] as number
  const rawEnd = (src.map[firstAt + needle.length - 1] as number) + 1
  const touched: number[] = []
  for (let i = rawStart; i < rawEnd; i++) {
    const ui = owner[i]
    if (ui !== undefined && ui !== -1 && touched[touched.length - 1] !== ui) touched.push(ui)
  }
  if (touched.length === 0) return { matchQuality: 'exact', occurrences }

  // Luồng TEXT thuần (không hộp) → locator offset ký tự vào chuỗi ghép (chính là excerptText).
  const hasRects = units[touched[0] as number]?.rect !== undefined
  if (!hasRects) {
    return { matchQuality: 'exact', occurrences, locator: { kind: 'text', start: rawStart, end: rawEnd } }
  }

  // PDF: chỉ vẽ khung khi CÙNG một trang và các đơn vị LIỀN MẠCH thứ tự đọc (không nhảy cột/trang).
  const us = touched.map((i) => units[i] as PositionedUnit)
  const pages = new Set(us.map((u) => u.page))
  const orders = us.map((u) => u.order).sort((a, b) => a - b)
  const contiguous = orders.every((o, i) => i === 0 || o === (orders[i - 1] as number) + 1)
  const page = us[0]?.page
  if (pages.size !== 1 || !contiguous || page === undefined) {
    // Tìm thấy nhưng không định vị chắc chắn → giữ trang (nếu cùng trang), KHÔNG vẽ khung.
    return {
      matchQuality: 'exact',
      occurrences,
      ...(pages.size === 1 && page !== undefined ? { locator: { kind: 'pdf', page, rects: [] } } : {}),
    }
  }

  const rects = us.map((u) => u.rect as Rect)
  return { matchQuality: 'exact', occurrences, locator: { kind: 'pdf', page, rects } }
}
