// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * ADAPTER PDF (bẩn) — pdfjs → `PageRaw`. Đây là chỗ DUY NHẤT trong bộ này biết pdfjs tồn tại.
 *
 * Vì sao đi qua `getOperatorList()` chứ không chỉ `getTextContent()`:
 *
 *  1. **Hộp mức TỪ.** `getTextContent()` trả mỗi RUN một hộp — ở file này một run thường là CẢ
 *     DÒNG (~90 ký tự), nên tô một cụm giữa dòng sẽ tô cả dòng. Operator list cho `unicode` + bề
 *     rộng TỪNG glyph (đơn vị 1/1000 em) kèm ma trận text, nên vị trí từng chữ là **đo được từ
 *     font metrics**, không phải chia đều theo số ký tự (chia đều là chính xác giả).
 *  2. **Kẻ bảng.** Bảng "Nội dung ¦ Yêu cầu cần đạt" vẽ kẻ bằng hình chữ nhật mỏng được tô. Có
 *     kẻ thì biên ô là ĐO ĐƯỢC, không phải đoán cột theo x — và đó là thứ chặn lỗi nặng nhất của
 *     bóc tách PDF nhiều cột: gộp ba ô cùng `y` thành một câu vô nghĩa.
 *
 * `getTextContent()` vẫn được gọi, nhưng để làm **đối chứng** (`glyphsVerified`) và làm bản lùi.
 *
 * Giới hạn đã biết: giả trang KHÔNG xoay (đúng với file này — đã kiểm cả 1555 trang rotation 0).
 */

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { Glyph, ItemBox, PageRaw, RuleSeg } from './model'

type Matrix = readonly [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** m ⊗ n (áp m trước, rồi n) — cùng quy ước với `Util.transform` của pdfjs. */
function mul(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ]
}

const asMatrix = (a: unknown): Matrix => {
  const v = a as number[]
  return [v[0] ?? 1, v[1] ?? 0, v[2] ?? 0, v[3] ?? 1, v[4] ?? 0, v[5] ?? 0]
}

interface PdfGlyph {
  readonly unicode?: string
  readonly width: number
  readonly isSpace: boolean
}

const isGlyph = (g: unknown): g is PdfGlyph => typeof g === 'object' && g !== null && 'width' in g

/** Ops kết thúc một path bằng cách TÔ hoặc VẼ NÉT. Path chỉ dùng để clip thì không phải kẻ bảng. */
function isPaintOp(fn: number): boolean {
  const O = pdfjs.OPS
  return fn === O.fill || fn === O.eoFill || fn === O.stroke || fn === O.fillStroke || fn === O.eoFillStroke
}

/** Bề dày tối đa (pt) để một hình chữ nhật được coi là NÉT KẺ chứ không phải khối màu. */
const RULE_THICKNESS = 2
/**
 * Chiều dài tối thiểu (pt) của một nét KẺ BẢNG. Đo trên file: nét kẻ bảng ngắn nhất là 30pt, còn
 * gạch phân số dài ~7pt. Đặt 20pt để gạch phân số không bị coi là biên ô — nếu coi là biên thì nó
 * cắt ô "Yêu cầu cần đạt" thành nhiều mảnh và câu chứa phân số vỡ ra.
 */
const RULE_MIN_LENGTH = 20

/** Số toạ độ mỗi lệnh path tiêu thụ. */
function coordCount(op: number): number {
  const O = pdfjs.OPS
  if (op === O.moveTo || op === O.lineTo) return 2
  if (op === O.curveTo) return 6
  if (op === O.curveTo2 || op === O.curveTo3) return 4
  if (op === O.rectangle) return 4
  return 0 // closePath
}

/** Cắt một lệnh path thành từng NHÁNH rời (mỗi `moveTo`/`rectangle` mở một nhánh mới). */
export function subPaths(ops: readonly number[], coords: readonly number[]): number[][] {
  const O = pdfjs.OPS
  const out: number[][] = []
  let cur: number[] = []
  let at = 0
  for (const op of ops) {
    const n = coordCount(op)
    const chunk = coords.slice(at, at + n)
    at += n
    if (op === O.moveTo || op === O.rectangle) {
      if (cur.length > 0) out.push(cur)
      cur = [...chunk]
      if (op === O.rectangle && chunk.length === 4) {
        // rectangle(x, y, w, h) → bốn góc, để hộp bao đúng thật.
        const [x, y, w, h] = chunk as [number, number, number, number]
        cur = [x, y, x + w, y + h]
      }
      continue
    }
    cur.push(...chunk)
  }
  if (cur.length > 0) out.push(cur)
  return out
}

/**
 * Chạy operator list qua một máy trạng thái text tối giản → vị trí từng glyph + các nét kẻ.
 *
 * Bước tiến một glyph (đúng công thức PDF 32000-1 §9.4.4):
 *   tx = (w/1000 × Tf + Tc + (glyph là dấu cách ? Tw : 0)) × Th
 * File này để Tc=0, Tw=0, Th=100% và nhét cỡ chữ vào ma trận text (Tf=1) — nhưng máy trạng thái
 * vẫn xử đủ, vì viết đúng công thức rẻ hơn là tin vào một giả định về file.
 */
function walkOperators(fnArray: number[], argsArray: unknown[][]): { glyphs: Glyph[]; rules: RuleSeg[] } {
  const O = pdfjs.OPS
  const glyphs: Glyph[] = []
  const rules: RuleSeg[] = []
  const ctmStack: Matrix[] = []
  let ctm: Matrix = IDENTITY
  let tm: Matrix = IDENTITY
  let tlm: Matrix = IDENTITY
  let fontSize = 1
  let charSpacing = 0
  let wordSpacing = 0
  let hScale = 1
  let leading = 0
  let rise = 0
  let font = ''

  const show = (raw: unknown[]): void => {
    for (const g of raw) {
      if (typeof g === 'number') {
        // Số trong mảng TJ là dịch ngược, đơn vị 1/1000 em.
        tm = mul([1, 0, 0, 1, (-g / 1000) * fontSize * hScale, 0], tm)
        continue
      }
      if (!isGlyph(g)) continue
      const tx = ((g.width / 1000) * fontSize + charSpacing + (g.isSpace ? wordSpacing : 0)) * hScale
      const d = mul(mul([1, 0, 0, 1, 0, rise], tm), ctm)
      const scale = tm[0] * ctm[0]
      glyphs.push({
        u: g.unicode ?? '',
        x: d[4],
        y: d[5],
        adv: tx * scale,
        size: fontSize * scale,
        font,
      })
      tm = mul([1, 0, 0, 1, tx, 0], tm)
    }
  }

  const nextLine = (): void => {
    tlm = mul([1, 0, 0, 1, 0, -leading], tlm)
    tm = tlm
  }

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i] as number
    const a = argsArray[i] ?? []
    switch (fn) {
      case O.save:
        ctmStack.push(ctm)
        break
      case O.restore:
        ctm = ctmStack.pop() ?? ctm
        break
      case O.transform:
        ctm = mul(asMatrix(a), ctm)
        break
      case O.paintFormXObjectBegin:
        ctmStack.push(ctm)
        ctm = mul(asMatrix(a[0]), ctm)
        break
      case O.paintFormXObjectEnd:
        ctm = ctmStack.pop() ?? ctm
        break
      case O.beginText:
        tm = IDENTITY
        tlm = IDENTITY
        break
      case O.setTextMatrix:
        tm = asMatrix(a)
        tlm = tm
        break
      case O.moveText:
        tlm = mul([1, 0, 0, 1, Number(a[0] ?? 0), Number(a[1] ?? 0)], tlm)
        tm = tlm
        break
      case O.setLeadingMoveText:
        leading = -Number(a[1] ?? 0)
        tlm = mul([1, 0, 0, 1, Number(a[0] ?? 0), Number(a[1] ?? 0)], tlm)
        tm = tlm
        break
      case O.setLeading:
        leading = Number(a[0] ?? 0)
        break
      case O.nextLine:
        nextLine()
        break
      case O.setFont:
        font = String(a[0] ?? '')
        fontSize = Number(a[1] ?? 1)
        break
      case O.setCharSpacing:
        charSpacing = Number(a[0] ?? 0)
        break
      case O.setWordSpacing:
        wordSpacing = Number(a[0] ?? 0)
        break
      case O.setHScale:
        hScale = Number(a[0] ?? 100) / 100
        break
      case O.setTextRise:
        rise = Number(a[0] ?? 0)
        break
      case O.showText:
        show((a[0] as unknown[]) ?? [])
        break
      case O.nextLineShowText:
        nextLine()
        show((a[0] as unknown[]) ?? [])
        break
      case O.nextLineSetSpacingShowText:
        wordSpacing = Number(a[0] ?? 0)
        charSpacing = Number(a[1] ?? 0)
        nextLine()
        show((a[2] as unknown[]) ?? [])
        break
      case O.constructPath: {
        if (!isPaintOp(fnArray[i + 1] ?? -1)) break // path chỉ để clip → không phải kẻ
        // TỪNG NHÁNH một hộp. Một lệnh path có thể vẽ NHIỀU hình rời nhau — ở file này, cả một dãy
        // gạch phân số `1/2 1/3 … 1/9` nằm trong cùng một lệnh. Lấy hộp bao của cả lệnh thì dãy gạch
        // dài 7pt ấy hoá thành "một nét kẻ 50pt", băm ô "Yêu cầu cần đạt" ra thành nhiều mảnh và
        // cắt đứt câu. Đây đúng là lỗi đã quan sát được ở trang 197.
        for (const sub of subPaths(
          (a[0] as number[] | undefined) ?? [],
          (a[1] as number[] | undefined) ?? [],
        )) {
          const xs: number[] = []
          const ys: number[] = []
          for (let k = 0; k + 1 < sub.length; k += 2) {
            const p = mul([1, 0, 0, 1, sub[k] as number, sub[k + 1] as number], ctm)
            xs.push(p[4])
            ys.push(p[5])
          }
          if (xs.length === 0) continue
          rules.push({
            x0: Math.min(...xs),
            x1: Math.max(...xs),
            y0: Math.min(...ys),
            y1: Math.max(...ys),
          })
        }
        break
      }
      default:
        break
    }
  }
  return { glyphs, rules }
}

/**
 * FONT SYMBOL → UNICODE CHUẨN.
 *
 * Khi một font không khai `ToUnicode`, pdfjs trả ký tự ở **vùng dùng riêng** `U+F000 + mã`. Ở file
 * này có 1431 ký tự như vậy trên 32 mã, và tất cả đều là font **Adobe Symbol** — không phải đoán
 * mò, mà kiểm được bằng ngữ cảnh: `(a ⟦F0B9⟧ 0)` → `≠` · `v = ⟦F06C⟧f` → `λ` · `n → ⟦F0A5⟧` → `∞` ·
 * `từ ⟦F0B0⟧ đến 180` → `°` · `công thức ⟦F0E5⟧` → `∑` · `biến thiên ⟦F044⟧H` → `Δ`.
 * Không quy đổi thì mọi công thức trong Toán/Lí/Hoá đọc lên đều hỏng.
 *
 * Đây là bảng mã hoá Adobe Symbol tiêu chuẩn. Mã KHÔNG có trong bảng thì **giữ nguyên** ký tự vùng
 * riêng (thà để lộ ra còn hơn bịa), và số lần quy đổi được ghi vào `document.json` để soi lại.
 */
const SYMBOL_TO_UNICODE: Readonly<Record<number, string>> = {
  0x22: '∀',
  0x24: '∃',
  0x27: '∋',
  0x2a: '∗',
  0x2d: '−',
  0x40: '≅',
  0x41: 'Α',
  0x42: 'Β',
  0x43: 'Χ',
  0x44: 'Δ',
  0x45: 'Ε',
  0x46: 'Φ',
  0x47: 'Γ',
  0x48: 'Η',
  0x49: 'Ι',
  0x4a: 'ϑ',
  0x4b: 'Κ',
  0x4c: 'Λ',
  0x4d: 'Μ',
  0x4e: 'Ν',
  0x4f: 'Ο',
  0x50: 'Π',
  0x51: 'Θ',
  0x52: 'Ρ',
  0x53: 'Σ',
  0x54: 'Τ',
  0x55: 'Υ',
  0x56: 'ς',
  0x57: 'Ω',
  0x58: 'Ξ',
  0x59: 'Ψ',
  0x5a: 'Ζ',
  0x5c: '∴',
  0x5e: '⊥',
  0x60: '‾',
  0x61: 'α',
  0x62: 'β',
  0x63: 'χ',
  0x64: 'δ',
  0x65: 'ε',
  0x66: 'φ',
  0x67: 'γ',
  0x68: 'η',
  0x69: 'ι',
  0x6a: 'ϕ',
  0x6b: 'κ',
  0x6c: 'λ',
  0x6d: 'µ',
  0x6e: 'ν',
  0x6f: 'ο',
  0x70: 'π',
  0x71: 'θ',
  0x72: 'ρ',
  0x73: 'σ',
  0x74: 'τ',
  0x75: 'υ',
  0x76: 'ϖ',
  0x77: 'ω',
  0x78: 'ξ',
  0x79: 'ψ',
  0x7a: 'ζ',
  0x7e: '∼',
  0xa1: 'ϒ',
  0xa2: '′',
  0xa3: '≤',
  0xa4: '⁄',
  0xa5: '∞',
  0xa6: 'ƒ',
  0xa7: '♣',
  0xa8: '♦',
  0xa9: '♥',
  0xaa: '♠',
  0xab: '↔',
  0xac: '←',
  0xad: '↑',
  0xae: '→',
  0xaf: '↓',
  0xb0: '°',
  0xb1: '±',
  0xb2: '″',
  0xb3: '≥',
  0xb4: '×',
  0xb5: '∝',
  0xb6: '∂',
  0xb7: '•',
  0xb8: '÷',
  0xb9: '≠',
  0xba: '≡',
  0xbb: '≈',
  0xbc: '…',
  0xbe: '—',
  0xbf: '↵',
  0xc0: 'ℵ',
  0xc1: 'ℑ',
  0xc2: 'ℜ',
  0xc3: '℘',
  0xc4: '⊗',
  0xc5: '⊕',
  0xc6: '∅',
  0xc7: '∩',
  0xc8: '∪',
  0xc9: '⊃',
  0xca: '⊇',
  0xcb: '⊄',
  0xcc: '⊂',
  0xcd: '⊆',
  0xce: '∈',
  0xcf: '∉',
  0xd0: '∠',
  0xd1: '∇',
  0xd2: '®',
  0xd3: '©',
  0xd4: '™',
  0xd5: '∏',
  0xd6: '√',
  0xd7: '⋅',
  0xd8: '¬',
  0xd9: '∧',
  0xda: '∨',
  0xdb: '⇔',
  0xdc: '⇐',
  0xdd: '⇑',
  0xde: '⇒',
  0xdf: '⇓',
  0xe0: '◊',
  0xe1: '⟨',
  0xe2: '®',
  0xe3: '©',
  0xe4: '™',
  0xe5: '∑',
  0xf1: '⟩',
  0xf2: '∫',
}

const PUA_START = 0xf000
const PUA_END = 0xf0ff

/** Có ký tự nào trong vùng dùng riêng không — kiểm bằng mã, không bằng regex chứa glyph vô hình. */
function hasPua(s: string): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c >= PUA_START && c <= PUA_END) return true
  }
  return false
}

/**
 * Quy đổi ký tự vùng dùng riêng của font Symbol. Trả cả chuỗi đã đổi và vết đếm theo mã, để chỗ gọi
 * ghi lại được đã suy đoán những gì.
 */
export function mapSymbolChars(s: string, tally?: Record<string, number>): string {
  if (!hasPua(s)) return s
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    const mapped = c >= PUA_START && c <= PUA_END ? SYMBOL_TO_UNICODE[c - PUA_START] : undefined
    if (mapped === undefined) {
      out += ch
      continue
    }
    out += mapped
    if (tally !== undefined) {
      const key = `0x${(c - PUA_START).toString(16)}→${mapped}`
      tally[key] = (tally[key] ?? 0) + 1
    }
  }
  return out
}

/** Bỏ mọi khoảng trắng + NFC — hai nguồn chỉ cần khớp tới mức CHỮ, không tới mức cách. */
const squash = (s: string): string => mapSymbolChars(s).normalize('NFC').replace(/\s+/gu, '')

export interface ExtractProgress {
  (page: number, total: number): void
}

/** Đọc toàn bộ PDF → `PageRaw[]`. Một lượt duy nhất; không giữ tham chiếu pdfjs nào ra ngoài. */
export async function extractPages(bytes: Uint8Array, onProgress?: ExtractProgress): Promise<PageRaw[]> {
  // `.slice()` — pdfjs DETACH ArrayBuffer của `data`; đưa bản sao để buffer của caller còn nguyên
  // (nếu không, băm sha256 sau đó sẽ băm mảng rỗng).
  const doc = await pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise

  const pages: PageRaw[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const ops = await page.getOperatorList()
    const { glyphs: rawGlyphs, rules } = walkOperators(ops.fnArray as number[], ops.argsArray as unknown[][])
    const symbols: Record<string, number> = {}
    const glyphs = rawGlyphs.map((g) => (hasPua(g.u) ? { ...g, u: mapSymbolChars(g.u, symbols) } : g))

    const tc = await page.getTextContent()
    const items: ItemBox[] = []
    for (const raw of tc.items) {
      const it = raw as { str?: string; transform?: number[]; width?: number; height?: number }
      if (typeof it.str !== 'string' || it.str.length === 0) continue
      const t = it.transform ?? []
      items.push({
        text: it.str,
        x: t[4] ?? 0,
        y: t[5] ?? 0,
        w: it.width ?? 0,
        h: it.height || Math.abs(t[3] ?? 0) || 10,
      })
    }

    const hRules: RuleSeg[] = []
    const vRules: RuleSeg[] = []
    for (const r of rules) {
      const w = r.x1 - r.x0
      const h = r.y1 - r.y0
      if (h <= RULE_THICKNESS && w > RULE_MIN_LENGTH) hRules.push(r)
      else if (w <= RULE_THICKNESS && h > RULE_MIN_LENGTH) vRules.push(r)
    }

    pages.push({
      page: p,
      width: vp.width,
      height: vp.height,
      rotation: page.rotate,
      glyphs,
      hRules,
      vRules,
      items,
      symbols,
      glyphsVerified: squash(glyphs.map((g) => g.u).join('')) === squash(items.map((i) => i.text).join('')),
    })
    page.cleanup()
    onProgress?.(p, doc.numPages)
  }
  // KHÔNG gọi destroy(): fake-worker của pdfjs trong node ném DataCloneError bất đồng bộ lúc
  // teardown (đã mắc ở pdf-anchor.service). Bóc tách xong rồi; doc để GC thu.
  return pages
}
