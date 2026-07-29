// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Bóc tách Thông tư 32 — kiểm bằng FIXTURE dựng tay (chạy được ở CI, không cần PDF) và, khi máy
 * có file gốc, kiểm luôn TRÊN FILE THẬT.
 *
 * Test chỉ xanh trên input tốt thì không chứng minh gì. Nên với bảo đảm nặng nhất — "hai ô cùng
 * `y` không được chảy vào nhau" — có hẳn một ca CỐ Ý PHÁ: bỏ nét kẻ giữa đi thì kết quả PHẢI đổi.
 * Nếu bỏ kẻ mà kết quả vẫn thế thì test kia đang xanh nhờ may, không nhờ nét kẻ.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, beforeAll } from 'vitest'
import { locateInUnits, type PositionedUnit } from '@bingoo.ai/authoring'
import { buildLayout, cellAt, wordsOf } from '../src/scripts/tt32/layout'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { extractPages, mapSymbolChars, subPaths } from '../src/scripts/tt32/extract-pdf'
import type { Block, DocumentLayout, Glyph, PageRaw, RuleSeg } from '../src/scripts/tt32/model'

// ── dựng fixture ─────────────────────────────────────────────────────────────

const W = 800
const H = 600
const SIZE = 10
const ADV = 5 // bề rộng mỗi ký tự, cố định cho dễ tính

function glyphs(text: string, x: number, y: number, font = 'f1', size = SIZE): Glyph[] {
  return [...text].map((u, i) => ({ u, x: x + i * ADV, y, adv: ADV, size, font }))
}

const hRule = (y: number, x0: number, x1: number): RuleSeg => ({ x0, x1, y0: y - 0.25, y1: y + 0.25 })
const vRule = (x: number, y0: number, y1: number): RuleSeg => ({ x0: x - 0.25, x1: x + 0.25, y0, y1 })

function page(over: Partial<PageRaw> & { page?: number }): PageRaw {
  return {
    page: 1,
    width: W,
    height: H,
    rotation: 0,
    glyphs: [],
    hRules: [],
    vRules: [],
    items: [],
    symbols: {},
    glyphsVerified: true,
    ...over,
  }
}

const textsOf = (layout: DocumentLayout): string[] => (layout.parts[0]?.blocks ?? []).map((b) => b.text)
const blocksOf = (layout: DocumentLayout): readonly Block[] => layout.parts[0]?.blocks ?? []

/**
 * Bảng hai cột, hai hàng: hàng tiêu đề (Nội dung ¦ Yêu cầu cần đạt) rồi một hàng dữ liệu mà hai ô
 * NẰM CÙNG MỘT `y` — đúng hình dạng đã gây lỗi trộn cột ở các bộ bóc tách khác.
 */
function twoColumnPage(withMiddleRule: boolean): PageRaw {
  const cols = { left: 100, mid: 400, right: 700 }
  const rows = { top: 500, mid: 460, bottom: 400 }
  const vRules = [
    vRule(cols.left, rows.mid, rows.top),
    vRule(cols.right, rows.mid, rows.top),
    vRule(cols.left, rows.bottom, rows.mid),
    vRule(cols.right, rows.bottom, rows.mid),
    ...(withMiddleRule ? [vRule(cols.mid, rows.mid, rows.top), vRule(cols.mid, rows.bottom, rows.mid)] : []),
  ]
  return page({
    glyphs: [
      ...glyphs('Nội dung', cols.left + 5, rows.mid + 20),
      ...glyphs('Yêu cầu cần đạt', cols.mid + 5, rows.mid + 20),
      ...glyphs('So sánh các số', cols.left + 5, rows.mid - 20),
      ...glyphs('– Đọc được các số.', cols.mid + 5, rows.mid - 20),
    ],
    hRules: [
      hRule(rows.top, cols.left, cols.right),
      hRule(rows.mid, cols.left, cols.right),
      hRule(rows.bottom, cols.left, cols.right),
    ],
    vRules,
  })
}

// ── từ & hộp ─────────────────────────────────────────────────────────────────

describe('wordsOf', () => {
  it('cắt từ tại glyph dấu cách, hộp là hợp hộp glyph — không nội suy', () => {
    const words = wordsOf(glyphs('ab cd', 100, 200))
    expect(words.map((w) => w.text)).toEqual(['ab', 'cd'])
    expect(words[0]).toMatchObject({ x0: 100, x1: 110, y: 200 })
    expect(words[1]).toMatchObject({ x0: 115, x1: 125 })
  })

  it('cắt khi khe ngang rộng bất thường, dù PDF không vẽ dấu cách', () => {
    const far = glyphs('cd', 300, 200)
    expect(wordsOf([...glyphs('ab', 100, 200), ...far]).map((w) => w.text)).toEqual(['ab', 'cd'])
  })

  it('cắt khi đổi dòng', () => {
    expect(wordsOf([...glyphs('ab', 100, 200), ...glyphs('cd', 100, 180)]).map((w) => w.text)).toEqual([
      'ab',
      'cd',
    ])
  })
})

describe('cellAt', () => {
  const hRules = [hRule(500, 100, 700), hRule(400, 100, 700)]
  const vRules = [vRule(100, 400, 500), vRule(400, 400, 500), vRule(700, 400, 500)]

  it('trả đúng ô khi đủ bốn cạnh', () => {
    expect(cellAt(200, 450, hRules, vRules)).toEqual({ x0: 100, x1: 400, y0: 400, y1: 500 })
  })

  it('thiếu cạnh ⇒ không phải ô (chảy theo văn xuôi)', () => {
    expect(cellAt(900, 450, hRules, vRules)).toBeNull()
    expect(cellAt(200, 200, hRules, vRules)).toBeNull()
  })
})

// ── bảng ─────────────────────────────────────────────────────────────────────

describe('bảng nhiều cột', () => {
  it('hai ô CÙNG MỘT y không chảy vào nhau', () => {
    const texts = textsOf(buildLayout([twoColumnPage(true)]))
    expect(texts).toContain('So sánh các số')
    expect(texts).toContain('– Đọc được các số.')
    expect(texts.some((t) => t.includes('So sánh các số – Đọc'))).toBe(false)
  })

  it('CỐ Ý PHÁ: bỏ nét kẻ giữa thì hai ô GỘP lại — nên ca trên xanh là nhờ nét kẻ, không nhờ may', () => {
    const texts = textsOf(buildLayout([twoColumnPage(false)]))
    expect(texts.some((t) => t.includes('So sánh các số – Đọc được các số.'))).toBe(true)
  })

  it('ô dữ liệu mang nhãn cột lấy từ hàng tiêu đề, và các ô bên trái vào đường dẫn', () => {
    const blocks = blocksOf(buildLayout([twoColumnPage(true)]))
    const req = blocks.find((b) => b.text.startsWith('– Đọc'))
    expect(req?.cell?.header).toBe('Yêu cầu cần đạt')
    expect(req?.path).toContain('So sánh các số')
    expect(req?.kind).toBe('list_item')
    const head = blocks.find((b) => b.text === 'Yêu cầu cần đạt')
    expect(head?.kind).toBe('table_header')
    // Ô tiêu đề KHÔNG được thừa hưởng ô bên trái nó.
    expect(head?.path).not.toContain('Nội dung')
  })

  it('ô gộp hết chiều ngang là TIÊU ĐỀ TRONG BẢNG, và phủ xuống các hàng sau', () => {
    const cols = { left: 100, mid: 400, right: 700 }
    const p = page({
      glyphs: [
        ...glyphs('SỐ VÀ PHÉP TÍNH', cols.left + 5, 480),
        ...glyphs('Số tự nhiên', cols.left + 5, 430),
        ...glyphs('– Đếm được đến 100.', cols.mid + 5, 430),
      ],
      hRules: [hRule(500, 100, 700), hRule(460, 100, 700), hRule(400, 100, 700)],
      vRules: [
        vRule(cols.left, 460, 500),
        vRule(cols.right, 460, 500),
        vRule(cols.left, 400, 460),
        vRule(cols.mid, 400, 460),
        vRule(cols.right, 400, 460),
      ],
    })
    const blocks = blocksOf(buildLayout([p]))
    expect(blocks.find((b) => b.text === 'SỐ VÀ PHÉP TÍNH')?.kind).toBe('table_heading')
    expect(blocks.find((b) => b.text.startsWith('– Đếm'))?.path).toEqual(
      expect.arrayContaining(['SỐ VÀ PHÉP TÍNH', 'Số tự nhiên']),
    )
  })

  it('tiêu đề HAI TẦNG: cột số thừa hưởng cả nhãn gộp lẫn nhãn con', () => {
    // "Môn học" gộp hai hàng tiêu đề; "Số tiết" gộp ba cột, dưới nó là Lớp 1/2/3.
    const [c0, c1, c2, c3, c4] = [100, 250, 400, 550, 700]
    const [top, tier, head, data] = [520, 490, 460, 420]
    const cross = (y0: number, y1: number): RuleSeg[] => [c0, c1, c2, c3, c4].map((x) => vRule(x, y0, y1))
    const p = page({
      glyphs: [
        ...glyphs('Môn học', c0 + 5, 495),
        ...glyphs('Số tiết', c1 + 5, 498),
        ...glyphs('Lớp 1', c1 + 5, 468),
        ...glyphs('Lớp 2', c2 + 5, 468),
        ...glyphs('Lớp 3', c3 + 5, 468),
        ...glyphs('Toán', c0 + 5, 428),
        ...glyphs('105', c1 + 5, 428),
        ...glyphs('175', c2 + 5, 428),
        ...glyphs('180', c3 + 5, 428),
      ],
      // Kẻ ngang ở `tier` chỉ chạy từ c1 — đó là cách "Môn học" gộp hai hàng tiêu đề.
      hRules: [hRule(top, c0, c4), hRule(tier, c1, c4), hRule(head, c0, c4), hRule(data, c0, c4)],
      vRules: [
        vRule(c0, tier, top),
        vRule(c1, tier, top),
        vRule(c4, tier, top),
        ...cross(head, tier),
        ...cross(data, head),
      ],
    })
    const blocks = blocksOf(buildLayout([p]))
    expect(blocks.find((b) => b.text === '105')?.cell?.header).toBe('Số tiết › Lớp 1')
    expect(blocks.find((b) => b.text === '175')?.cell?.header).toBe('Số tiết › Lớp 2')
    expect(blocks.find((b) => b.text === 'Toán')?.cell?.header).toBe('Môn học')
  })
})

// ── văn xuôi ─────────────────────────────────────────────────────────────────

describe('văn xuôi', () => {
  const line = (text: string, x: number, y: number, font = 'f1'): Glyph[] => glyphs(text, x, y, font)

  it('nối các dòng của một đoạn, cắt khi dòng trước kết thúc sớm hơn lề phải', () => {
    const full = 'x'.repeat(60)
    const layout = buildLayout([
      page({
        glyphs: [
          ...line(full, 100, 500),
          ...line(full, 90, 486),
          ...line('ngắn hơn.', 90, 472),
          ...line(full, 100, 458),
        ],
      }),
    ])
    const texts = textsOf(layout)
    expect(texts).toHaveLength(2)
    expect(texts[0]).toBe(`${full} ${full} ngắn hơn.`)
    expect(texts[1]).toBe(full)
  })

  it('dấu đầu dòng mở khối mới', () => {
    const texts = textsOf(
      buildLayout([page({ glyphs: [...line('Một câu.', 100, 500), ...line('– Ý thứ nhất.', 100, 488)] })]),
    )
    expect(texts).toEqual(['Một câu.', '– Ý thứ nhất.'])
  })

  it('tiêu đề xếp chồng theo cấp và sinh đường dẫn cho khối bên dưới', () => {
    const layout = buildLayout([
      page({
        glyphs: [
          ...line('V. NỘI DUNG GIÁO DỤC', 100, 520, 'f2'),
          ...line('1. Nội dung khái quát', 100, 490, 'f2'),
          ...line('Một đoạn thân bài.', 100, 460),
        ],
      }),
    ])
    const blocks = blocksOf(layout)
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'heading', 'para'])
    expect(blocks[0]?.level).toBe(2)
    expect(blocks[1]?.level).toBe(3)
    expect(blocks[2]?.path).toEqual(expect.arrayContaining(['V. NỘI DUNG GIÁO DỤC', '1. Nội dung khái quát']))
  })

  it('số trang in ở chân trang thành khối riêng và gắn vào mọi khối của trang', () => {
    const layout = buildLayout([
      page({ glyphs: [...glyphs('Một câu.', 100, 500), ...glyphs('29', 400, 30)] }),
    ])
    const blocks = blocksOf(layout)
    expect(blocks.find((b) => b.kind === 'page_number')?.text).toBe('29')
    expect(blocks[0]?.pageLabel).toBe(29)
  })
})

// ── chữ bị xếp tầng: phân số, chữ số trên/dưới, ký tự font Symbol ────────────

/** Ký tự vùng dùng riêng mà pdfjs trả về cho font không khai ToUnicode. */
const pua = (symbolCode: number): string => String.fromCharCode(0xf000 + symbolCode)

describe('font Symbol', () => {
  it('quy ký tự vùng dùng riêng về Unicode chuẩn, có đếm lại được', () => {
    const tally: Record<string, number> = {}
    // 0xB9 = "≠" và 0x6C = "λ" trong bảng mã Adobe Symbol.
    expect(mapSymbolChars(`a ${pua(0xb9)} 0, v = ${pua(0x6c)}f`, tally)).toBe('a ≠ 0, v = λf')
    expect(tally).toEqual({ '0xb9→≠': 1, '0x6c→λ': 1 })
  })

  it('mã KHÔNG có trong bảng thì GIỮ NGUYÊN — thà để lộ còn hơn bịa', () => {
    const unmapped = pua(0xf0)
    expect(mapSymbolChars(`x ${unmapped} y`)).toBe(`x ${unmapped} y`)
  })
})

describe('subPaths', () => {
  it('một lệnh path vẽ HAI hình rời thì ra HAI hộp, không phải một hộp trùm cả hai', () => {
    // Đây chính là lỗi ở trang 197: cả dãy gạch phân số nằm trong một lệnh, lấy hộp bao của cả
    // lệnh thì thành "nét kẻ 50pt" và nó băm ô "Yêu cầu cần đạt" ra từng mảnh.
    const { moveTo, lineTo } = pdfjs.OPS
    expect(subPaths([moveTo, lineTo, moveTo, lineTo], [0, 0, 7, 0, 40, 0, 47, 0])).toEqual([
      [0, 0, 7, 0],
      [40, 0, 47, 0],
    ])
  })
})

describe('phân số xếp tầng', () => {
  /** Tử ở baseline trên, câu văn ở giữa, mẫu ở dưới — đúng cách trang 197 in "1/2". */
  const stacked = (middle: string): PageRaw =>
    page({
      glyphs: [
        ...glyphs('1', 200, 508),
        ...glyphs('1', 240, 508),
        ...glyphs(middle, 100, 500),
        ...glyphs('2', 200, 492),
        ...glyphs('3', 240, 492),
      ],
    })

  it('ghép tử với mẫu theo trục x rồi nhập vào đúng chỗ trong câu', () => {
    const texts = textsOf(buildLayout([stacked('– Nhận biết được')]))
    expect(texts).toHaveLength(1)
    expect(texts[0]).toBe('– Nhận biết được 1/2 1/3')
  })

  it('hộp của phân số trùm CẢ tử lẫn mẫu, không chỉ một tầng', () => {
    const layout = buildLayout([stacked('– Nhận biết được')])
    const frac = layout.parts[0]?.spans.find((s) => s.text === '1/2')
    expect(frac).toBeDefined()
    // cao từ baseline mẫu (492) tới đỉnh tử (508+10) = 26 đơn vị trang
    expect((frac?.rect.h ?? 0) * H).toBeCloseTo(26, 1)
  })

  it('CỐ Ý PHÁ: bỏ câu kẹp ở giữa thì KHÔNG ghép — bảng số nhiều hàng không bị nhận nhầm', () => {
    const numericRows = page({
      glyphs: [...glyphs('1', 200, 508), ...glyphs('420', 100, 500), ...glyphs('2', 200, 492)],
    })
    expect(textsOf(buildLayout([numericRows])).some((t) => t.includes('1/2'))).toBe(false)
  })

  it('hai chữ số cách nhau 0,48 cỡ chữ là HAI từ — không dính thành "11"', () => {
    // Khe thật nhỏ nhất đo được trên file là 0,48× cỡ chữ, giữa tử của 1/2 và tử của 1/3.
    const words = wordsOf([...glyphs('1', 100, 200), ...glyphs('1', 100 + ADV + 0.48 * SIZE, 200)])
    expect(words.map((w) => w.text)).toEqual(['1', '1'])
  })
})

describe('chữ số trên/dưới', () => {
  it('nhập số nhấc vào từ ngay bên trái: mm² → "mm^2"', () => {
    const p = page({
      glyphs: [
        ...glyphs('diện tích mm', 100, 500),
        ...glyphs('2', 100 + 12 * ADV, 505, 'f1', 6),
        ...glyphs('rồi', 100 + 14 * ADV, 500),
      ],
    })
    expect(textsOf(buildLayout([p]))[0]).toBe('diện tích mm^2 rồi')
  })

  it('số hạ xuống thì dùng dấu _', () => {
    const p = page({
      // Hạ 6 đơn vị (0,6 cỡ chữ) — thấp hơn hẳn dung sai gom dòng, đúng như chỉ số dưới in thật.
      glyphs: [...glyphs('H', 100, 500), ...glyphs('2', 100 + ADV, 494, 'f1', 6), ...glyphs('O', 120, 500)],
    })
    expect(textsOf(buildLayout([p]))[0]).toBe('H_2 O')
  })

  it('CỐ Ý PHÁ: cùng cỡ chữ thì KHÔNG nhập — chữ thường không bị nuốt vào từ bên cạnh', () => {
    const p = page({
      glyphs: [
        ...glyphs('diện tích mm', 100, 500),
        ...glyphs('2', 100 + 12 * ADV, 505),
        ...glyphs('rồi', 100 + 14 * ADV, 500),
      ],
    })
    expect(textsOf(buildLayout([p])).some((t) => t.includes('mm^2'))).toBe(false)
  })
})

// ── toạ độ ───────────────────────────────────────────────────────────────────

describe('toạ độ', () => {
  it('Rect là 0..1 theo khổ trang, gốc GÓC TRÊN-TRÁI (làm tròn 5 chữ số cho ổn định byte)', () => {
    const layout = buildLayout([page({ glyphs: glyphs('ab', 100, 200) })])
    const block = blocksOf(layout)[0]
    const span = layout.parts[0]?.spans[0]
    const r5 = (n: number): number => Math.round(n * 100000) / 100000
    expect(block?.rects[0]).toEqual({
      x: r5(100 / W),
      y: r5((H - 200 - SIZE) / H),
      w: r5(10 / W),
      h: r5(SIZE / H),
    })
    expect(span?.rect).toEqual(block?.rects[0])
  })
})

// ── phần ─────────────────────────────────────────────────────────────────────

describe('tách phần', () => {
  it('trang bìa mở một phần mới; trang trước bìa đầu là bản Thông tư', () => {
    const cover = (title: string, n: number): PageRaw =>
      page({
        page: n,
        glyphs: [
          ...glyphs('BỘ GIÁO DỤC VÀ ĐÀO TẠO', 300, 520),
          ...glyphs('CHƯƠNG TRÌNH GIÁO DỤC PHỔ THÔNG', 250, 490),
          ...glyphs(title, 300, 460),
          ...glyphs('(Ban hành kèm theo Thông tư số 32/2018/TT-BGDĐT', 200, 430),
        ],
      })
    const layout = buildLayout([
      page({ page: 1 }),
      cover('MÔN TOÁN', 2),
      page({ page: 3, glyphs: glyphs('Một câu.', 100, 500) }),
      cover('MÔN NGỮ VĂN', 4),
    ])
    expect(layout.parts.map((p) => p.slug)).toEqual(['thong-tu-32-2018-tt-bgddt', 'mon-toan', 'mon-ngu-van'])
    expect(layout.parts[1]).toMatchObject({ title: 'MÔN TOÁN', pageStart: 2, pageEnd: 3 })
    expect(layout.parts[1]?.blocks.at(-1)?.path[0]).toBe('MÔN TOÁN')
  })
})

// ── trung thực về độ chính xác ───────────────────────────────────────────────

describe('tự khai độ chính xác', () => {
  it('trang không có lớp text ⇒ precision none + cảnh báo', () => {
    const layout = buildLayout([page({ glyphs: [] })])
    expect(layout.pages[0]?.precision).toBe('none')
    expect(layout.warnings.join(' ')).toContain('không có lớp text')
  })

  it('glyph dựng lại KHÔNG khớp pdfjs ⇒ hạ xuống mức dòng, có cảnh báo, không im lặng', () => {
    const layout = buildLayout([page({ glyphs: glyphs('ab', 100, 200), glyphsVerified: false })])
    expect(layout.pages[0]?.precision).toBe('line')
    expect(layout.warnings.join(' ')).toContain('không được bảo chứng')
  })
})

// ── file thật ────────────────────────────────────────────────────────────────

const PDF = resolve(
  import.meta.dirname,
  '../../../thong-tu-32-2018-tt-bgddt-ban-hanh-chuong-trinh-giao-duc-pho-thong-moi_332022836.pdf',
)

describe.skipIf(!existsSync(PDF))('trên file Thông tư 32 thật', () => {
  let layout: DocumentLayout
  let pages: PageRaw[]

  beforeAll(async () => {
    pages = await extractPages(new Uint8Array(readFileSync(PDF)))
    layout = buildLayout(pages)
  }, 300_000)

  it('1555 trang, không trang nào bị xoay', () => {
    expect(pages).toHaveLength(1555)
    expect(pages.every((p) => p.rotation === 0)).toBe(true)
  })

  it('29 phần, biên trang khớp bìa đã dò tay', () => {
    expect(layout.parts).toHaveLength(29)
    const starts = layout.parts.map((p) => p.pageStart)
    expect(starts.slice(0, 6)).toEqual([1, 4, 57, 167, 290, 349])
    expect(starts.at(-1)).toBe(1520)
    expect(layout.parts.map((p) => p.slug)).toContain('mon-toan')
  })

  it('mọi trang có chữ đều đạt độ chính xác mức TỪ; chỉ 3 trang scan là không có chữ', () => {
    const none = layout.pages.filter((p) => p.precision === 'none').map((p) => p.page)
    expect(none).toEqual([1, 2, 3])
    expect(layout.pages.filter((p) => p.precision === 'line')).toHaveLength(0)
  })

  it('mọi từ thuộc đúng MỘT khối — không mất chữ, không đếm hai lần', () => {
    for (const part of layout.parts) {
      let next = 0
      for (const b of part.blocks) {
        expect(b.spans[0]).toBe(next)
        expect(b.spans[1]).toBeGreaterThanOrEqual(b.spans[0])
        next = b.spans[1] + 1
      }
      expect(next).toBe(part.spans.length)
    }
  })

  it('vòng ngược: câu của khối định vị lại được đúng trang, khung trùng khung đã lưu', () => {
    const toan = layout.parts.find((p) => p.slug === 'mon-toan')
    expect(toan).toBeDefined()
    const units: PositionedUnit[] = (toan?.spans ?? []).map((s) => ({
      text: s.text,
      page: s.page,
      rect: s.rect,
      order: s.i,
    }))
    const sample = (toan?.blocks ?? [])
      .filter((b) => b.kind === 'list_item' && b.text.length > 60)
      .slice(0, 25)
    expect(sample.length).toBeGreaterThan(10)
    for (const b of sample) {
      const anchor = locateInUnits(b.text, units)
      expect(anchor.matchQuality, b.text).toBe('exact')
      if (anchor.occurrences > 1) continue // chữ trùng ở nơi khác — lõi cố ý KHÔNG vẽ khung
      expect(anchor.locator?.kind).toBe('pdf')
      if (anchor.locator?.kind !== 'pdf') continue
      expect(anchor.locator.page).toBe(b.page)
      const first = anchor.locator.rects[0]
      const mine = b.rects[0]
      expect(first?.y).toBeCloseTo(mine?.y ?? -1, 4)
    }
  })

  it('trang 195 ra đúng lưới 3 cột với nhãn cột của chương trình môn Toán', () => {
    const blocks = layout.parts.flatMap((p) => p.blocks).filter((b) => b.page === 195)
    const cols = new Set(blocks.filter((b) => b.cell !== undefined).map((b) => b.cell?.col))
    expect([...cols].sort()).toEqual([0, 1, 2])
    expect(blocks.map((b) => b.cell?.header)).toContain('Yêu cầu cần đạt')
    const req = blocks.find((b) => b.text.startsWith('– Đọc, viết được các số trong phạm vi 10 000'))
    expect(req?.path).toEqual([
      'MÔN TOÁN',
      'V. NỘI DUNG GIÁO DỤC',
      'LỚP 3',
      'SỐ VÀ PHÉP TÍNH',
      'Số tự nhiên',
      'Số và cấu tạo thập phân của một số',
      'Yêu cầu cần đạt',
    ])
  })
})
