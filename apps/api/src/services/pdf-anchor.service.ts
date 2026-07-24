// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * ADAPTER PDF (bẩn) — biến PDF có lớp text thành `PositionedUnit[]` để lõi thuần `locateInUnits`
 * định vị câu trích. Dùng pdfjs `getTextContent`: mỗi ITEM (một run text) một hộp, theo thứ tự đọc
 * pdfjs trả về. KHÔNG tách dưới-item (pdfjs không cho hộp theo glyph — nội suy là giả chính xác);
 * khung tô ở mức run, honest.
 *
 * Toạ độ → Rect 0..1 gốc GÓC TRÊN-TRÁI (pdf y-up → 1 - y/H). Giới hạn MVP: giả trang KHÔNG xoay
 * (rotation 0 — đúng với Circular32); trang xoay sẽ để sau. Thứ tự đọc = thứ tự item của pdfjs;
 * nhiều cột có thể đứt quãng → lõi tự từ chối vẽ khung (giữ trang, không vẽ bừa).
 */

import { createHash } from 'node:crypto'
import type { PositionedUnit } from '@bingoo.ai/authoring'
// legacy build chạy trong node (getTextContent không cần worker/canvas)
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

interface PdfTextItem {
  readonly str: string
  readonly transform: number[]
  readonly width: number
  readonly height: number
}

const isTextItem = (it: unknown): it is PdfTextItem =>
  typeof it === 'object' && it !== null && 'str' in it && 'transform' in it

export interface PdfExtract {
  readonly units: PositionedUnit[]
  readonly pageCount: number
}

/** SHA-256 của bytes — chốt toạ độ theo đúng bản tài liệu (contentHash). */
export function contentHashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** PDF → luồng đơn vị có vị trí (mọi trang, theo thứ tự đọc). Rect 0..1 top-left. */
export async function pdfPositionedUnits(bytes: Uint8Array): Promise<PdfExtract> {
  // Chỉ cần VỊ TRÍ text, KHÔNG render → tắt font/eval để tránh message không clone được của
  // fake-worker pdfjs trong node (DataCloneError khi postMessage font).
  // `.slice()` — pdfjs LẤY QUYỀN (detach) ArrayBuffer của `data`; đưa bản sao để buffer của caller
  // còn nguyên (nếu không, `contentHashOf(bytes)` sau đó sẽ băm mảng rỗng đã detach).
  const doc = await pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise
  const units: PositionedUnit[] = []
  let order = 0
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const W = vp.width
    const H = vp.height
    const tc = await page.getTextContent()
    for (const raw of tc.items) {
      if (!isTextItem(raw) || raw.str.trim().length === 0) continue
      const x = raw.transform[4] as number
      const y = raw.transform[5] as number
      const h = raw.height || Math.abs(raw.transform[3] as number) || 10
      units.push({
        text: raw.str,
        page: p,
        rect: { x: x / W, y: (H - y - h) / H, w: raw.width / W, h: h / H },
        order: order++,
      })
    }
  }
  // KHÔNG gọi cleanup()/destroy() — pdfjs-node fake-worker ném DataCloneError bất đồng bộ khi
  // postMessage lúc teardown. doc được GC; extraction đã xong.
  return { units, pageCount: doc.numPages }
}

// Cố ý KHÔNG có `locatePdf(bytes, quote)` trích-lại-mỗi-câu: pdfjs-node fake-worker hỏng state ở
// getDocument LẦN HAI trong cùng tiến trình. Đúng cách: `pdfPositionedUnits` MỘT lần rồi
// `locateInUnits` (thuần) cho từng câu. Render là việc của trình duyệt (worker thật, không dính lỗi).
