// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * DỰNG CẤU TRÚC — glyph rời → từ → dòng → ô bảng → khối ngữ nghĩa → phần.
 *
 * Hàm thuần: vào `PageRaw[]`, ra `DocumentLayout`. Không đọc file, không gọi mạng, không đồng hồ,
 * không ngẫu nhiên → chạy lại cho ra đúng một kết quả, và test được bằng fixture dựng tay.
 *
 * Chỗ dễ sai nhất của bóc tách PDF nhiều cột là **gộp các ô cùng `y` thành một câu**. Ở đây từng
 * TỪ được gán vào ô của nó bằng các NÉT KẺ THẬT của bảng trước khi gom dòng, nên hai cột không
 * bao giờ chảy vào nhau. Trang không có kẻ thì đi đường văn xuôi một luồng.
 */

import { createHash } from 'node:crypto'
import { slugify } from '@bingoo.ai/authoring'
import type {
  Block,
  BlockKind,
  CellRef,
  DocumentLayout,
  Glyph,
  PageRaw,
  PageReport,
  Part,
  Rect,
  RuleSeg,
  Span,
} from './model'

// ── hằng số căn chỉnh ────────────────────────────────────────────────────────
/** Lệch baseline tối đa (theo cỡ chữ) vẫn coi là cùng một dòng. */
const LINE_TOL = 0.35
/**
 * Khe ngang (theo cỡ chữ) đủ lớn để tách từ khi PDF không vẽ glyph dấu cách.
 *
 * Đo trên file (bỏ các cặp có dấu cách thật): khe TRONG một từ là 0,00 (kerning xuống −0,05), còn
 * khe thật nhỏ nhất là 0,48 — giữa hai tử số của `1/2` và `1/3` in cạnh nhau. Hai cụm rời hẳn nhau,
 * nên đặt ngưỡng ở 0,25: không xé chữ, mà vẫn tách được hai phân số đứng liền.
 */
const WORD_GAP = 0.25
/** Khe dọc (theo cỡ chữ) đủ lớn để cắt khối. Đo trên file: trong một đoạn ≤1,45; giữa hai đoạn ≥1,74. */
const BLOCK_GAP = 1.6
/** Dòng kết thúc sớm hơn lề phải chừng này (theo cỡ chữ) là dòng CUỐI đoạn — văn xuôi canh đều. */
const RAGGED_END = 2
/** Thụt đầu dòng (theo cỡ chữ) đủ lớn để coi là mở đoạn mới. */
const INDENT = 0.6
/** Dung sai khi hỏi một nét kẻ có bao trùm một điểm không (nét dày ~0,5pt). */
const RULE_EPS = 0.6
/** Gộp các biên ô lệch nhau dưới ngưỡng này thành một. */
const GRID_TOL = 1.5
/** Dải chân trang (theo chiều cao trang) để nhận số trang in. */
const FOOTER_BAND = 0.12

const BULLET = /^[–—\-+•*]\s/u
const NUMBERED = /^(\d+(\.\d+)*\.|[IVXLC]+\.|[a-zđ]\)|\d+\))\s/u

const HEADING_RULES: readonly { readonly re: RegExp; readonly level: number }[] = [
  { re: /^(PHẦN|CHƯƠNG)\s/u, level: 1 },
  { re: /^LỚP\s+\d+/u, level: 3 },
  { re: /^[IVXLC]+\.\s/u, level: 2 },
  { re: /^\d+\.\d+\.\s/u, level: 4 },
  { re: /^\d+\.\s/u, level: 3 },
  { re: /^[a-zđ]\)\s/u, level: 5 },
]

const COVER_MARK_MINISTRY = 'BỘ GIÁO DỤC VÀ ĐÀO TẠO'
const COVER_MARK_PROGRAM = 'CHƯƠNG TRÌNH GIÁO DỤC PHỔ THÔNG'
const COVER_MARK_END = /^\(Ban hành/u

// ── kiểu nội bộ ──────────────────────────────────────────────────────────────

interface Word {
  readonly text: string
  readonly x0: number
  readonly x1: number
  /** Baseline dùng để GOM DÒNG và tính ngưỡng. */
  readonly y: number
  /** Cỡ chữ dùng để tính ngưỡng. */
  readonly size: number
  readonly font: string
  /** Đáy HỘP, khi khác baseline (phân số, chữ số nhấc) — mặc định là `y`. */
  readonly by?: number
  /** Chiều cao HỘP, khi khác cỡ chữ — mặc định là `size`. Hộp phải trùm cả tử lẫn mẫu. */
  readonly bh?: number
}

interface CellBox {
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly y1: number
}

interface Line {
  readonly words: readonly Word[]
  readonly text: string
  readonly y: number
  readonly x0: number
  readonly x1: number
  readonly size: number
  readonly font: string
  /** Mép trên/dưới của HỘP dòng (hợp hộp các từ) — khác baseline khi dòng có phân số/số nhấc. */
  readonly top: number
  readonly bottom: number
}

interface Region {
  readonly cell: CellBox | null
  readonly top: number
  readonly left: number
  readonly lines: Line[]
}

interface PageUnits {
  readonly page: PageRaw
  readonly regions: readonly Region[]
  readonly pageLabel: number | null
  readonly grid: Grid | null
  readonly coverTitle: string | null
  readonly fractions: number
  readonly scripts: number
}

interface Grid {
  readonly cols: readonly number[]
  readonly rows: readonly number[]
  readonly headers: ReadonlyMap<number, string>
  /** Số hàng đầu bảng là hàng TIÊU ĐỀ (0, 1 hoặc 2). */
  readonly headerRowCount: number
}

// ── từ ───────────────────────────────────────────────────────────────────────

/**
 * Glyph → TỪ. Cắt tại glyph dấu cách, tại đổi dòng, tại lùi ngược, và tại khe rộng bất thường.
 * Hộp của từ là hợp hộp các glyph của nó — không nội suy gì.
 */
export function wordsOf(glyphs: readonly Glyph[]): Word[] {
  const words: Word[] = []
  let buf: Glyph[] = []

  const flush = (): void => {
    if (buf.length === 0) return
    const text = buf
      .map((g) => g.u)
      .join('')
      .normalize('NFC')
      .trim()
    if (text.length > 0) {
      const first = buf[0] as Glyph
      const last = buf[buf.length - 1] as Glyph
      words.push({
        text,
        x0: Math.min(...buf.map((g) => g.x)),
        x1: Math.max(last.x + last.adv, ...buf.map((g) => g.x + g.adv)),
        y: first.y,
        size: Math.max(...buf.map((g) => g.size)),
        font: first.font,
      })
    }
    buf = []
  }

  for (const g of glyphs) {
    if (g.u === '' || g.u === undefined) continue
    if (/^\s+$/u.test(g.u)) {
      flush()
      continue
    }
    const prev = buf[buf.length - 1]
    if (prev !== undefined) {
      const size = Math.max(prev.size, g.size) || 1
      const sameLine = Math.abs(g.y - prev.y) <= LINE_TOL * size
      const gap = g.x - (prev.x + prev.adv)
      if (!sameLine || gap > WORD_GAP * size || gap < -0.5 * size) flush()
    }
    buf.push(g)
  }
  flush()
  return words
}

// ── ô bảng ───────────────────────────────────────────────────────────────────

const mid = (a: number, b: number): number => (a + b) / 2

/**
 * Ô chứa điểm (cx, cy), suy từ NÉT KẺ: kẻ dọc gần nhất hai bên (có phủ cao độ cy) và kẻ ngang gần
 * nhất trên/dưới (có phủ hoành độ cx). Thiếu bất kỳ cạnh nào ⇒ không phải ô ⇒ chảy theo văn xuôi.
 * Ô GỘP tự ra đúng, vì trong lòng ô gộp không có nét nào để tìm thấy.
 */
export function cellAt(
  cx: number,
  cy: number,
  hRules: readonly RuleSeg[],
  vRules: readonly RuleSeg[],
): CellBox | null {
  let left = Number.NEGATIVE_INFINITY
  let right = Number.POSITIVE_INFINITY
  let leftSeg: RuleSeg | null = null
  let rightSeg: RuleSeg | null = null

  for (const v of vRules) {
    if (cy < v.y0 - RULE_EPS || cy > v.y1 + RULE_EPS) continue
    const x = mid(v.x0, v.x1)
    if (x <= cx && x > left) {
      left = x
      leftSeg = v
    }
    if (x >= cx && x < right) {
      right = x
      rightSeg = v
    }
  }
  // KHÔNG có cạnh dọc hai bên ⇒ không phải ô. Đây là bất biến duy nhất không được nhượng: chữ ở
  // hai bên một nét kẻ dọc thì không bao giờ được nối vào cùng một câu.
  if (leftSeg === null || rightSeg === null) return null

  // Ranh HÀNG: nét ngang nếu có; thiếu thì lấy đầu mút của chính hai đoạn nét dọc. Word vẽ viền
  // theo TỪNG Ô, nên nhiều bảng chỉ có nét ngang ở đỉnh bảng và dưới hàng tiêu đề, còn ranh các
  // hàng sau chỉ tồn tại dưới dạng đầu/cuối đoạn nét dọc. Trước đây đòi đủ bốn cạnh nên 103 trang
  // rơi hết xuống luồng văn xuôi và các cột dính thành một câu vô nghĩa.
  let bottom = Math.max(leftSeg.y0, rightSeg.y0)
  let top = Math.min(leftSeg.y1, rightSeg.y1)
  for (const h of hRules) {
    if (cx < h.x0 - RULE_EPS || cx > h.x1 + RULE_EPS) continue
    const y = mid(h.y0, h.y1)
    if (y <= cy + RULE_EPS && y > bottom) bottom = y
    if (y >= cy - RULE_EPS && y < top) top = y
  }
  if (!(bottom < top)) return null
  return { x0: left, x1: right, y0: bottom, y1: top }
}

const cellKey = (c: CellBox): string =>
  `${c.x0.toFixed(1)}:${c.x1.toFixed(1)}:${c.y0.toFixed(1)}:${c.y1.toFixed(1)}`

/** Gộp các giá trị sát nhau thành một mốc lưới, rồi trả về mảng mốc đã sắp. */
function gridAxis(values: readonly number[], descending: boolean): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of sorted) {
    const last = out[out.length - 1]
    if (last === undefined || Math.abs(v - last) > GRID_TOL) out.push(v)
  }
  return descending ? out.reverse() : out
}

const axisIndex = (axis: readonly number[], v: number): number => {
  let best = 0
  let bestD = Number.POSITIVE_INFINITY
  for (let i = 0; i < axis.length; i++) {
    const d = Math.abs((axis[i] as number) - v)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

// ── dòng & vùng ──────────────────────────────────────────────────────────────

function makeLine(words: readonly Word[]): Line {
  const sorted = [...words].sort((a, b) => a.x0 - b.x0)
  const first = sorted[0] as Word
  return {
    words: sorted,
    text: sorted.map((w) => w.text).join(' '),
    y: first.y,
    x0: Math.min(...sorted.map((w) => w.x0)),
    x1: Math.max(...sorted.map((w) => w.x1)),
    size: Math.max(...sorted.map((w) => w.size)),
    font: first.font,
    top: Math.max(...sorted.map((w) => boxTop(w))),
    bottom: Math.min(...sorted.map((w) => boxBottom(w))),
  }
}

const boxBottom = (w: Word): number => w.by ?? w.y
const boxTop = (w: Word): number => (w.by ?? w.y) + (w.bh ?? w.size)
const xOverlap = (a: Word, b: Word): number => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)

/** Gom từ thành các nhóm cùng baseline (chưa xử tầng trên/dưới). */
function baselineGroups(words: readonly Word[]): Word[][] {
  const sorted = [...words].sort((a, b) => b.y - a.y || a.x0 - b.x0)
  const groups: Word[][] = []
  for (const w of sorted) {
    const g = groups[groups.length - 1]
    const head = g?.[0]
    if (
      g !== undefined &&
      head !== undefined &&
      Math.abs(head.y - w.y) <= LINE_TOL * Math.max(head.size, w.size)
    ) {
      g.push(w)
    } else {
      groups.push([w])
    }
  }
  for (const g of groups) g.sort((a, b) => a.x0 - b.x0)
  return groups
}

const NUMERATOR = /^\d{1,4}$/u
/** Tử/mẫu là nhóm ngắn, toàn số. */
const isStack = (g: readonly Word[]): boolean => g.length <= 4 && g.every((w) => NUMERATOR.test(w.text))
/** Khoảng dọc tối đa (theo cỡ chữ) giữa tử và mẫu. Đo trên file: 1,4× — hai dòng văn thường cách 2,65×. */
const STACK_SPAN = 1.9

/** Ghép một tử với một mẫu → một TỪ "tử/mẫu", hộp trùm cả hai tầng. */
function pairStack(nums: readonly Word[], dens: readonly Word[]): { merged: Word[]; leftover: Word[] } {
  const takenDen = new Set<number>()
  const merged: Word[] = []
  const leftover: Word[] = []
  for (const n of nums) {
    let best = -1
    let bestOv = 0
    dens.forEach((d, j) => {
      if (takenDen.has(j)) return
      const ov = xOverlap(n, d)
      if (ov > bestOv) {
        bestOv = ov
        best = j
      }
    })
    if (best === -1) {
      leftover.push(n)
      continue
    }
    takenDen.add(best)
    const d = dens[best] as Word
    merged.push({
      text: `${n.text}/${d.text}`,
      x0: Math.min(n.x0, d.x0),
      x1: Math.max(n.x1, d.x1),
      y: n.y,
      size: n.size,
      font: n.font,
      by: boxBottom(d),
      bh: boxTop(n) - boxBottom(d),
    })
  }
  dens.forEach((d, j) => {
    if (!takenDen.has(j)) leftover.push(d)
  })
  return { merged, leftover }
}

/**
 * PHÂN SỐ XẾP TẦNG. Trong bảng "yêu cầu cần đạt" của môn Toán, `1/2` được in thành ba tầng: tử ở
 * baseline trên, câu văn ở giữa, mẫu ở dưới — nên gom dòng theo baseline sẽ xé câu ra và câu còn lại
 * đọc thành "Nhận biết được ; ;...; thông qua hình ảnh". Ở đây tử và mẫu được ghép theo trục x rồi
 * NHẬP vào đúng chỗ trong câu giữa. Điều kiện "có một dòng văn KẸP giữa hai tầng số" là thứ khiến
 * hai dòng văn thường không bao giờ bị nhận nhầm.
 */
function mergeFractions(groups: Word[][]): { groups: Word[][]; count: number } {
  const out = [...groups]
  let count = 0
  let i = 0
  while (i + 2 < out.length) {
    const a = out[i] as Word[]
    const l = out[i + 1] as Word[]
    const b = out[i + 2] as Word[]
    const size = Math.max(...l.map((w) => w.size))
    const span = (a[0] as Word).y - (b[0] as Word).y
    if (!isStack(a) || !isStack(b) || isStack(l) || span > STACK_SPAN * size) {
      i++
      continue
    }
    const { merged, leftover } = pairStack(a, b)
    if (merged.length === 0) {
      i++
      continue
    }
    count += merged.length
    out.splice(
      i,
      3,
      [...l, ...merged, ...leftover].sort((x, y) => x.x0 - y.x0),
    )
  }
  // Ô chỉ chứa một phân số: hai tầng số, không có câu nào kẹp giữa.
  if (out.length === 2 && isStack(out[0] as Word[]) && isStack(out[1] as Word[])) {
    const a = out[0] as Word[]
    const b = out[1] as Word[]
    const size = Math.max(...a.map((w) => w.size))
    if ((a[0] as Word).y - (b[0] as Word).y <= STACK_SPAN * size) {
      const { merged, leftover } = pairStack(a, b)
      if (merged.length > 0) {
        count += merged.length
        return { groups: [[...merged, ...leftover].sort((x, y) => x.x0 - y.x0)], count }
      }
    }
  }
  return { groups: out, count }
}

/** Cỡ chữ phổ biến nhất của vùng — mốc để biết cái gì là chữ số trên/dưới. */
function dominantSize(words: readonly Word[]): number {
  const tally = new Map<number, number>()
  for (const w of words) {
    const k = Math.round(w.size * 2) / 2
    tally.set(k, (tally.get(k) ?? 0) + 1)
  }
  let best = 0
  let bestN = -1
  for (const [k, n] of tally) {
    if (n > bestN || (n === bestN && k > best)) {
      bestN = n
      best = k
    }
  }
  return best || 1
}

/** Cỡ chữ dưới ngưỡng này (so với cỡ chữ chính) thì coi là chữ số trên/dưới. */
const SCRIPT_MAX_RATIO = 0.8

/**
 * CHỮ SỐ TRÊN/DƯỚI. `mm²` và `60°` được in thành một run cỡ 14 và một run cỡ 9 nhấc cao 6,5pt, tức
 * hai baseline — gom theo baseline sẽ đẩy số `2` ra thành một khối riêng và câu còn lại đọc thành
 * "diện tích (mm , cm , dm , m )". Ở đây run nhỏ được NHẬP vào từ ngay bên trái nó, thành `mm^2`,
 * hộp trùm cả chân lẫn số nhấc — nên câu trích khớp lại được và tô sáng vẫn đúng chỗ.
 */
function mergeScripts(groups: Word[][], bodySize: number): { groups: Word[][]; count: number } {
  const isScriptGroup = (g: readonly Word[]): boolean =>
    g.every((w) => w.size < SCRIPT_MAX_RATIO * bodySize) && g.length <= 8
  const hosts: Word[][] = []
  const scripts: Word[][] = []
  for (const g of groups) (isScriptGroup(g) ? scripts : hosts).push(g)
  if (hosts.length === 0 || scripts.length === 0) return { groups, count: 0 }

  let count = 0
  for (const s of scripts) {
    const sy = (s[0] as Word).y
    let host: Word[] | null = null
    let bestD = Number.POSITIVE_INFINITY
    for (const h of hosts) {
      const hy = (h[0] as Word).y
      const hSize = Math.max(...h.map((w) => w.size))
      const d = Math.abs(hy - sy)
      if (d <= hSize && d < bestD) {
        bestD = d
        host = h
      }
    }
    if (host === null) {
      hosts.push(s) // không tìm được câu chủ → giữ nguyên thành dòng riêng, đừng làm mất chữ
      continue
    }
    const hy = (host[0] as Word).y
    const mark = sy > hy ? '^' : '_'
    for (const w of s) {
      // Từ ngay BÊN TRÁI trong câu chủ (cho phép chớm lấn) là chân của số nhấc.
      let base: Word | null = null
      for (const cand of host) {
        if (cand.x1 <= w.x0 + 0.35 * cand.size && (base === null || cand.x1 > base.x1)) base = cand
      }
      count++
      if (base === null) {
        host.push({ ...w, text: `${mark}${w.text}` })
        continue
      }
      const at = host.indexOf(base)
      host[at] = {
        text: `${base.text}${mark}${w.text}`,
        x0: Math.min(base.x0, w.x0),
        x1: Math.max(base.x1, w.x1),
        y: base.y,
        size: base.size,
        font: base.font,
        by: Math.min(boxBottom(base), boxBottom(w)),
        bh: Math.max(boxTop(base), boxTop(w)) - Math.min(boxBottom(base), boxBottom(w)),
      }
    }
  }
  for (const h of hosts) h.sort((a, b) => a.x0 - b.x0)
  hosts.sort((a, b) => (b[0] as Word).y - (a[0] as Word).y)
  return { groups: hosts, count }
}

export interface LineBuild {
  readonly lines: Line[]
  readonly fractions: number
  readonly scripts: number
}

/** Gom từ thành dòng TRONG cùng một vùng (ô hoặc luồng): baseline → phân số → chữ số trên/dưới. */
function buildLines(words: readonly Word[]): LineBuild {
  if (words.length === 0) return { lines: [], fractions: 0, scripts: 0 }
  const frac = mergeFractions(baselineGroups(words))
  const scr = mergeScripts(frac.groups, dominantSize(words))
  return { lines: scr.groups.map(makeLine), fractions: frac.count, scripts: scr.count }
}

const linesOf = (words: readonly Word[]): Line[] => buildLines(words).lines

/** Một trang → các vùng đọc, đã xếp đúng thứ tự đọc (trên→dưới, trái→phải). */
function pageRegions(page: PageRaw): {
  regions: Region[]
  grid: Grid | null
  fractions: number
  scripts: number
} {
  const words = wordsOf(page.glyphs)
  const inCell = new Map<string, { box: CellBox; words: Word[] }>()
  const flow: Word[] = []

  for (const w of words) {
    const box = cellAt(mid(w.x0, w.x1), w.y + w.size * 0.3, page.hRules, page.vRules)
    if (box === null) {
      flow.push(w)
      continue
    }
    const key = cellKey(box)
    const bucket = inCell.get(key)
    if (bucket === undefined) inCell.set(key, { box, words: [w] })
    else bucket.words.push(w)
  }

  const regions: Region[] = []
  let fractions = 0
  let scripts = 0
  for (const { box, words: ws } of inCell.values()) {
    const built = buildLines(ws)
    fractions += built.fractions
    scripts += built.scripts
    regions.push({ cell: box, top: box.y1, left: box.x0, lines: built.lines })
  }
  const flowBuilt = buildLines(flow)
  fractions += flowBuilt.fractions
  scripts += flowBuilt.scripts
  for (const line of flowBuilt.lines) {
    regions.push({ cell: null, top: line.top, left: line.x0, lines: [line] })
  }
  regions.sort((a, b) => b.top - a.top || a.left - b.left)

  let grid: Grid | null = null
  if (inCell.size > 0) {
    const boxes = [...inCell.values()].map((c) => c.box)
    const cols = gridAxis(
      boxes.flatMap((b) => [b.x0, b.x1]),
      false,
    )
    const rows = gridAxis(
      boxes.flatMap((b) => [b.y0, b.y1]),
      true,
    )
    grid = { cols, rows, ...headerRows([...inCell.values()], cols, rows) }
  }
  return { regions, grid, fractions, scripts }
}

/** Chữ dài tối đa của một ô còn được coi là nhãn cột (dài hơn thì là dữ liệu, không phải tiêu đề). */
const HEADER_MAX_CHARS = 40

/**
 * Tiêu đề cột, CÓ XỬ tiêu đề hai tầng ("Số tiết/năm học" gộp 5 cột, dưới nó là "Lớp 1"…"Lớp 5").
 * Nhận tầng thứ hai khi tầng đầu có ô gộp và hàng dưới chia nhỏ hơn hẳn bằng những nhãn ngắn —
 * không nhận thì mọi con số ở bảng kế hoạch giáo dục đều mất thông tin "của lớp nào".
 */
function headerRows(
  cells: readonly { box: CellBox; words: Word[] }[],
  cols: readonly number[],
  rows: readonly number[],
): { headers: Map<number, string>; headerRowCount: number } {
  const headers = new Map<number, string>()
  const rowOf = (c: { box: CellBox }): number => axisIndex(rows, c.box.y1)
  const textOf = (c: { words: Word[] }): string =>
    linesOf(c.words)
      .map((l) => l.text)
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim()

  const row0 = cells.filter((c) => rowOf(c) === 0)
  if (row0.length < 2) return { headers, headerRowCount: 0 }
  const row1 = cells.filter((c) => rowOf(c) === 1)
  const twoTier =
    row0.some((c) => axisIndex(cols, c.box.x1) - axisIndex(cols, c.box.x0) > 1) &&
    row1.length > row0.length &&
    row1.every((c) => textOf(c).length <= HEADER_MAX_CHARS)

  for (const c of twoTier ? [...row0, ...row1] : row0) {
    const from = axisIndex(cols, c.box.x0)
    const to = axisIndex(cols, c.box.x1)
    const text = textOf(c)
    if (text.length === 0) continue
    for (let i = from; i < to; i++) {
      const prev = headers.get(i)
      headers.set(i, prev === undefined || prev === text ? text : `${prev} › ${text}`)
    }
  }
  return { headers, headerRowCount: twoTier ? 2 : 1 }
}

// ── phân loại ────────────────────────────────────────────────────────────────

const isAllCaps = (s: string): boolean => {
  const letters = [...s].filter((c) => /\p{L}/u.test(c))
  if (letters.length < 2) return false
  return letters.every((c) => c === c.toLocaleUpperCase('vi'))
}

function headingLevel(text: string): number | null {
  for (const r of HEADING_RULES) if (r.re.test(text)) return r.level
  if (isAllCaps(text) && text.length <= 120) return 2
  return null
}

// ── khối ─────────────────────────────────────────────────────────────────────

/**
 * Cắt các dòng của một vùng thành khối: dấu đầu dòng · khe dọc · thụt đầu dòng · đổi font · và
 * (chỉ với văn xuôi CANH ĐỀU) dòng trước kết thúc sớm hơn lề phải ⇒ nó là dòng cuối đoạn.
 */
function splitBlocks(lines: readonly Line[], justified: boolean): Line[][] {
  const rightMargin = Math.max(0, ...lines.map((l) => l.x1))
  const out: Line[][] = []
  for (const line of lines) {
    const cur = out[out.length - 1]
    const prev = cur?.[cur.length - 1]
    if (cur === undefined || prev === undefined) {
      out.push([line])
      continue
    }
    const size = Math.max(prev.size, line.size) || 1
    // Dòng có phân số/chữ số nhấc thì CAO hơn một dòng thường, nên nhà in phải giãn dòng ra. Cộng
    // phần cao thêm đó vào ngưỡng, nếu không một câu có `1/2` sẽ bị cắt làm đôi ngay giữa câu.
    const extra = Math.max(0, prev.top - prev.bottom - prev.size, line.top - line.bottom - line.size)
    const startsNew =
      BULLET.test(line.text) ||
      NUMBERED.test(line.text) ||
      prev.y - line.y > BLOCK_GAP * size + extra * 0.6 ||
      line.x0 - prev.x0 > INDENT * size ||
      line.font !== prev.font ||
      (justified && prev.x1 < rightMargin - RAGGED_END * size)
    if (startsNew) out.push([line])
    else cur.push(line)
  }
  return out
}

/** Gộp các vùng VĂN XUÔI liền nhau thành một luồng, để đoạn nhiều dòng còn nối lại được. */
function coalesce(regions: readonly Region[]): Region[] {
  const out: Region[] = []
  for (const r of regions) {
    const last = out[out.length - 1]
    if (r.cell === null && last !== undefined && last.cell === null) last.lines.push(...r.lines)
    else out.push({ cell: r.cell, top: r.top, left: r.left, lines: [...r.lines] })
  }
  return out
}

// Toạ độ PDF đi LÊN, `Rect` đi XUỐNG: mép trên của hộp là `H - top`.
const rectOf = (line: Line, w: number, h: number): Rect => ({
  x: round(line.x0 / w),
  y: round((h - line.top) / h),
  w: round((line.x1 - line.x0) / w),
  h: round((line.top - line.bottom) / h),
})

const round = (n: number): number => Math.round(n * 100000) / 100000

const spanRect = (word: Word, w: number, h: number): Rect => ({
  x: round(word.x0 / w),
  y: round((h - boxTop(word)) / h),
  w: round((word.x1 - word.x0) / w),
  h: round((boxTop(word) - boxBottom(word)) / h),
})

const hashOf = (text: string): string =>
  createHash('sha256').update(text.normalize('NFC')).digest('hex').slice(0, 8)

// ── phần (28 tài liệu con) ───────────────────────────────────────────────────

/** Trang bìa của một phần? Nhận bằng hai dòng cố định trên đầu bìa, không đoán theo số trang. */
function coverTitleOf(regions: readonly Region[]): string | null {
  const head = regions
    .filter((r) => r.cell === null)
    .slice(0, 12)
    .map((r) => (r.lines[0] as Line).text.trim())
  if (!head.some((t) => t.startsWith(COVER_MARK_MINISTRY))) return null
  const at = head.findIndex((t) => t.startsWith(COVER_MARK_PROGRAM))
  if (at === -1) return null
  const title: string[] = []
  for (const t of head.slice(at + 1)) {
    if (COVER_MARK_END.test(t)) break
    if (t.length > 0) title.push(t)
  }
  return title.length > 0 ? title.join(' ') : COVER_MARK_PROGRAM
}

function pageLabelOf(regions: readonly Region[], height: number): number | null {
  for (const r of regions) {
    if (r.cell !== null) continue
    const line = r.lines[0]
    if (line === undefined || line.y > height * FOOTER_BAND) continue
    const m = /^(\d{1,4})$/u.exec(line.text.trim())
    if (m) return Number(m[1])
  }
  return null
}

// ── dựng ─────────────────────────────────────────────────────────────────────

interface StackEntry {
  readonly level: number
  readonly text: string
}

/** Bóc tách toàn tài liệu. Tất định: cùng `PageRaw[]` luôn ra cùng kết quả. */
export function buildLayout(pages: readonly PageRaw[]): DocumentLayout {
  const warnings: string[] = []
  const units: PageUnits[] = pages.map((page) => {
    if (page.rotation !== 0)
      warnings.push(`Trang ${page.page} bị xoay ${page.rotation}° — toạ độ chưa xử xoay.`)
    const { regions, grid, fractions, scripts } = pageRegions(page)
    return {
      page,
      regions,
      grid,
      fractions,
      scripts,
      pageLabel: pageLabelOf(regions, page.height),
      coverTitle: coverTitleOf(regions),
    }
  })

  // Ranh giới phần: mỗi trang bìa mở một phần. Trang trước bìa đầu tiên là bản Thông tư (ảnh scan).
  const starts: number[] = units.filter((u) => u.coverTitle !== null).map((u) => u.page.page)
  // Không có trang bìa nào (fixture, hay một PDF khác) → cả tập là MỘT phần, không rơi về rỗng.
  const firstCover = starts[0] ?? pages.length + 1
  const bounds: { start: number; end: number; title: string }[] = []
  if (firstCover > 1) {
    bounds.push({ start: 1, end: firstCover - 1, title: 'Thông tư 32/2018/TT-BGDĐT' })
  }
  starts.forEach((start, i) => {
    const next = starts[i + 1]
    const unit = units[start - 1] as PageUnits
    bounds.push({
      start,
      end: next === undefined ? pages.length : next - 1,
      title: unit.coverTitle ?? 'Phần',
    })
  })

  const taken = new Set<string>()
  const parts: Part[] = []
  const reports: PageReport[] = []

  bounds.forEach((bound, partIndex) => {
    const base = slugify(bound.title)
    let slug = base
    let n = 2
    while (taken.has(slug)) slug = `${base}-${n++}`
    taken.add(slug)

    const spans: Span[] = []
    const blocks: Block[] = []
    const stack: StackEntry[] = []

    for (let p = bound.start; p <= bound.end; p++) {
      const unit = units[p - 1] as PageUnits
      const { page, grid } = unit
      const isCover = unit.coverTitle !== null
      const tableStack: StackEntry[] = []
      let indexOnPage = 0
      let cellsOnPage = 0

      for (const region of coalesce(unit.regions)) {
        const cellInfo =
          region.cell === null || grid === null ? null : describeCell(region.cell, grid, page.page)
        if (cellInfo !== null) cellsOnPage++
        const isFullWidth =
          cellInfo !== null && grid !== null && cellInfo.colSpan >= Math.max(1, grid.cols.length - 1)

        for (const group of splitBlocks(region.lines, region.cell === null)) {
          const first = group[0] as Line
          const text = group
            .map((l) => l.text)
            .join(' ')
            .replace(/\s+/gu, ' ')
            .trim()
          if (text.length === 0) continue

          const start = spans.length
          for (const line of group) {
            for (const w of line.words) {
              spans.push({
                i: spans.length,
                page: page.page,
                text: w.text,
                rect: spanRect(w, page.width, page.height),
              })
            }
          }
          const end = spans.length - 1
          if (end < start) continue

          const isFooter = region.cell === null && first.y <= page.height * FOOTER_BAND
          const numeric = /^\d{1,4}$/u.test(text)
          let kind: BlockKind
          let level: number | undefined
          if (isFooter && numeric) {
            kind = 'page_number'
          } else if (cellInfo !== null) {
            if (BULLET.test(text)) kind = 'list_item'
            else if (isFullWidth) kind = 'table_heading'
            else if (grid !== null && cellInfo.row < grid.headerRowCount) kind = 'table_header'
            else kind = 'table_cell'
          } else if (BULLET.test(text)) {
            kind = 'list_item'
          } else if (!isCover) {
            const lv = headingLevel(text)
            if (lv !== null) {
              kind = 'heading'
              level = lv
            } else {
              kind = 'para'
            }
          } else {
            kind = 'para'
          }

          if (kind === 'table_heading') {
            const depth = isAllCaps(text) ? 1 : 2
            while ((tableStack[tableStack.length - 1]?.level ?? 0) >= depth) tableStack.pop()
            tableStack.push({ level: depth, text })
          }

          // Ô tiêu đề tự nó KHÔNG lấy nhãn cột và KHÔNG lấy các ô bên trái — nếu không thì
          // "Số tiết/năm học" sẽ mang theo "Nội dung giáo dục" như thể nằm dưới nó.
          const isHeaderCell = kind === 'table_header'
          const rowPath =
            cellInfo === null || grid === null || isFullWidth || isHeaderCell
              ? []
              : leftCellTexts(unit, grid, cellInfo, region.cell as CellBox)

          const path = dedupeAdjacent([
            bound.title,
            ...stack.map((s) => s.text),
            ...tableStack.map((s) => s.text),
            ...rowPath,
            ...(cellInfo?.header !== undefined && !isHeaderCell && cellInfo.col > 0 ? [cellInfo.header] : []),
          ])

          blocks.push({
            id: `tt32.${slug}.p${page.page}.${String(indexOnPage).padStart(2, '0')}`,
            hash: hashOf(text),
            part: slug,
            page: page.page,
            pageLabel: unit.pageLabel,
            kind,
            ...(level === undefined ? {} : { level }),
            path,
            text,
            rects: group.map((l) => rectOf(l, page.width, page.height)),
            spans: [start, end],
            ...(cellInfo === null ? {} : { cell: cellInfo }),
          })
          indexOnPage++

          if (kind === 'heading' && level !== undefined) {
            while ((stack[stack.length - 1]?.level ?? 0) >= level) stack.pop()
            stack.push({ level, text })
          }
        }
      }

      const textLayer = page.glyphs.length > 0
      reports.push({
        page: page.page,
        part: slug,
        width: round(page.width),
        height: round(page.height),
        textLayer,
        precision: !textLayer ? 'none' : page.glyphsVerified ? 'word' : 'line',
        pageLabel: unit.pageLabel,
        tableCells: cellsOnPage,
        symbols: Object.values(page.symbols).reduce((a, b) => a + b, 0),
        scripts: unit.scripts,
        fractions: unit.fractions,
      })
      if (textLayer && !page.glyphsVerified) {
        warnings.push(
          `Trang ${page.page}: chuỗi glyph dựng lại KHÔNG khớp pdfjs — hộp mức từ không được bảo chứng.`,
        )
      }
      if (!textLayer) warnings.push(`Trang ${page.page}: không có lớp text (ảnh scan) — không bóc được chữ.`)
    }

    parts.push({
      slug,
      index: partIndex,
      title: bound.title,
      pageStart: bound.start,
      pageEnd: bound.end,
      spans,
      blocks,
    })
  })

  // Vết quy đổi Symbol, gộp toàn tài liệu — để người đọc soi lại từng suy đoán một.
  const symbolsMapped: Record<string, { to: string; count: number }> = {}
  for (const page of pages) {
    for (const [key, n] of Object.entries(page.symbols)) {
      const [code, to] = key.split('→')
      const at = symbolsMapped[code ?? key]
      if (at === undefined) symbolsMapped[code ?? key] = { to: to ?? '', count: n }
      else at.count += n
    }
  }
  const symbolTotal = Object.values(symbolsMapped).reduce((a, b) => a + b.count, 0)
  if (symbolTotal > 0) {
    warnings.push(
      `Đã quy ${symbolTotal} ký tự font Symbol về Unicode chuẩn (${Object.keys(symbolsMapped).length} mã) — ` +
        `xem bảng symbolsMapped để kiểm lại từng mã.`,
    )
  }

  return { parts, pages: reports, warnings, symbolsMapped }
}

function describeCell(box: CellBox, grid: Grid, page: number): CellRef {
  const col = axisIndex(grid.cols, box.x0)
  const colEnd = axisIndex(grid.cols, box.x1)
  const row = axisIndex(grid.rows, box.y1)
  const rowEnd = axisIndex(grid.rows, box.y0)
  const header = grid.headers.get(col)
  return {
    table: `t${page}`,
    row,
    col,
    rowSpan: Math.max(1, rowEnd - row),
    colSpan: Math.max(1, colEnd - col),
    ...(header === undefined ? {} : { header }),
  }
}

/** Chữ ở các ô BÊN TRÁI cùng hàng — "mạch kiến thức › chủ đề" của một yêu cầu cần đạt. */
function leftCellTexts(unit: PageUnits, grid: Grid, ref: CellRef, box: CellBox): string[] {
  if (ref.col === 0) return []
  const out: { col: number; text: string }[] = []
  for (const region of unit.regions) {
    const c = region.cell
    if (c === null) continue
    if (c.x1 > box.x0 + GRID_TOL) continue // không nằm bên trái
    // cùng hàng: hai ô có phần chồng nhau theo chiều dọc
    if (Math.min(c.y1, box.y1) - Math.max(c.y0, box.y0) <= GRID_TOL) continue
    const colIndex = axisIndex(grid.cols, c.x0)
    const text = region.lines
      .map((l) => l.text)
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim()
    if (text.length > 0) out.push({ col: colIndex, text })
  }
  return out.sort((a, b) => a.col - b.col).map((o) => o.text)
}

const dedupeAdjacent = (xs: readonly string[]): string[] => {
  const out: string[] = []
  for (const x of xs) if (x.length > 0 && out[out.length - 1] !== x) out.push(x)
  return out
}
