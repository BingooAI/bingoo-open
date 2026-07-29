// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * KIỂU DÙNG CHUNG cho bộ bóc tách Thông tư 32/2018 (Chương trình GDPT 2018).
 *
 * Hai không gian toạ độ, đừng lẫn:
 *  • `PageRaw` (đầu ra adapter pdfjs) dùng **toạ độ PDF**: gốc GÓC DƯỚI-TRÁI, y đi LÊN, đơn vị pt.
 *  • `Rect` (đầu ra cuối) dùng **0..1 theo khổ trang, gốc GÓC TRÊN-TRÁI** — đúng quy ước
 *    `Rect` của `@bingoo.ai/authoring` và của `pdf-viewer.tsx`, nên đưa thẳng vào viewer được.
 */

/** Hộp chuẩn hoá 0..1 theo khổ trang, gốc GÓC TRÊN-TRÁI. Khớp `Rect` của @bingoo.ai/authoring. */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Một glyph ĐÚNG NHƯ ĐƯỢC VẼ. Toạ độ PDF (y-up). `adv` là bước tiến của chính glyph đó. */
export interface Glyph {
  readonly u: string
  /** Mép trái của glyph tại thời điểm vẽ. */
  readonly x: number
  /** Đường chân chữ (baseline). */
  readonly y: number
  readonly adv: number
  /** Cỡ chữ quy ra đơn vị trang (đã nhân ma trận text + CTM). */
  readonly size: number
  readonly font: string
}

/** Một đoạn kẻ bảng. File này vẽ kẻ bằng hình chữ nhật mỏng được tô, không phải nét stroke. */
export interface RuleSeg {
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly y1: number
}

/** Hộp mức run do chính pdfjs báo — dùng làm ĐỐI CHỨNG, và làm bản lùi khi tự kiểm trượt. */
export interface ItemBox {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface PageRaw {
  readonly page: number
  readonly width: number
  readonly height: number
  readonly rotation: number
  readonly glyphs: readonly Glyph[]
  readonly hRules: readonly RuleSeg[]
  readonly vRules: readonly RuleSeg[]
  readonly items: readonly ItemBox[]
  /** Ký tự font Symbol đã quy về Unicode chuẩn: mã Symbol (hex) → số lần. Vết để kiểm lại được. */
  readonly symbols: Readonly<Record<string, number>>
  /**
   * `true` khi chuỗi glyph ta dựng lại từ operator list KHỚP ĐÚNG chuỗi pdfjs báo (đã bỏ khoảng
   * trắng, đã NFC). Đây là điều kiện để dám nói toạ độ ở mức TỪ; sai thì trang đó lùi về mức run.
   */
  readonly glyphsVerified: boolean
}

/** Một TỪ — đơn vị nhỏ nhất ta dám bảo chứng một hộp. Khớp `PositionedUnit` của authoring. */
export interface Span {
  readonly i: number
  readonly page: number
  readonly text: string
  readonly rect: Rect
}

export type BlockKind =
  'heading' | 'para' | 'list_item' | 'table_heading' | 'table_header' | 'table_cell' | 'page_number'

/** Vị trí một ô trong lưới bảng của TRANG đó (chỉ số hàng/cột đếm lại theo từng trang). */
export interface CellRef {
  readonly table: string
  readonly row: number
  readonly col: number
  readonly rowSpan: number
  readonly colSpan: number
  /** Tiêu đề cột (hàng đầu của bảng trên trang này), nếu có. */
  readonly header?: string
}

export interface Block {
  /** `tt32.<phần>.p<trang PDF>.<thứ tự>` — ổn định chừng nào bản bóc tách còn tất định. */
  readonly id: string
  /** 8 hex đầu của sha256(text đã chuẩn hoá) — để kiểm một trích dẫn cũ còn trỏ đúng chữ không. */
  readonly hash: string
  readonly part: string
  readonly page: number
  /** Số trang IN trên giấy (mỗi phần đánh lại từ đầu). `null` ở trang bìa. */
  readonly pageLabel: number | null
  readonly kind: BlockKind
  /** Chỉ có ở heading. 1 là ngoài cùng. */
  readonly level?: number
  /** Đường dẫn ngữ nghĩa: phần → mục → lớp → mạch kiến thức → chủ đề. Thứ làm cho khối tự giải thích. */
  readonly path: readonly string[]
  readonly text: string
  /** Một hộp mỗi DÒNG hiển thị. Hộp mức từ nằm ở `spans`. */
  readonly rects: readonly Rect[]
  /** [đầu, cuối] — chỉ số span, bao gồm cả hai đầu. */
  readonly spans: readonly [number, number]
  readonly cell?: CellRef
}

export interface Part {
  readonly slug: string
  readonly index: number
  readonly title: string
  readonly pageStart: number
  readonly pageEnd: number
  readonly spans: readonly Span[]
  readonly blocks: readonly Block[]
}

export interface PageReport {
  readonly page: number
  readonly part: string
  readonly width: number
  readonly height: number
  readonly textLayer: boolean
  /** `word` = hộp dựng từ font metrics đã qua tự kiểm; `line` = lùi về hộp run của pdfjs. */
  readonly precision: 'word' | 'line' | 'none'
  readonly pageLabel: number | null
  readonly tableCells: number
  /** Số ký tự Symbol đã quy về Unicode trên trang này. */
  readonly symbols: number
  /** Số chữ số trên/dưới đã nhập lại vào câu (mm^2, 60^o). */
  readonly scripts: number
  /** Số phân số xếp tầng đã dựng lại (1/2). */
  readonly fractions: number
}

export interface DocumentLayout {
  readonly parts: readonly Part[]
  readonly pages: readonly PageReport[]
  readonly warnings: readonly string[]
  /** Bảng quy đổi Symbol đã áp: mã Symbol → {ký tự, số lần}. Để người đọc kiểm lại suy đoán. */
  readonly symbolsMapped: Readonly<Record<string, { readonly to: string; readonly count: number }>>
}
