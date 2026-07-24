// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * NEO VỊ TRÍ — khung tô chỉ hiện khi ĐỊNH VỊ CHẮC CHẮN. Các bài này chốt đúng chỗ phản biện lo:
 * trùng chữ → không khung; nhảy trang/cột → không khung; text thuần → offset. Nguồn tự soạn (§1).
 */

import { describe, expect, it } from 'vitest'
import { locateInUnits, type PositionedUnit } from '../src/index'

const R = { x: 0.1, y: 0.2, w: 0.1, h: 0.02 }
const w = (text: string, order: number, page = 2, rect = R): PositionedUnit => ({ text, order, page, rect })

// "Đếm đến một trăm" = 16 ký tự, 4 từ → qua sàn.
const LINE = ['Đếm', 'đến', 'một', 'trăm']
const units = LINE.map((t, i) => w(t, i))

describe('locateInUnits', () => {
  it('khớp đúng 1 lần, cùng trang, liền mạch → locator pdf + hợp hộp các từ', () => {
    const a = locateInUnits('Đếm đến một trăm', units)
    expect(a.matchQuality).toBe('exact')
    expect(a.occurrences).toBe(1)
    expect(a.locator).toEqual({ kind: 'pdf', page: 2, rects: [R, R, R, R] })
  })

  it('span một phần chuỗi từ (qua sàn) → chỉ các từ chạm vào', () => {
    const a = locateInUnits('đến một trăm', units)
    expect(a.locator).toEqual({ kind: 'pdf', page: 2, rects: [R, R, R] })
  })

  it('TRÙNG chữ trên trang → occurrences>1, KHÔNG khung (dù chữ có thật)', () => {
    const dup = [...LINE, ...LINE].map((t, i) => w(t, i))
    const a = locateInUnits('Đếm đến một trăm', dup)
    expect(a.matchQuality).toBe('exact')
    expect(a.occurrences).toBe(2)
    expect(a.locator).toBeUndefined()
  })

  it('không có trong nguồn → not_found', () => {
    expect(locateInUnits('Nhân chia nghìn', units).matchQuality).toBe('not_found')
  })

  it('câu quá ngắn/tầm thường → not_found (không neo bừa)', () => {
    expect(locateInUnits('Đếm', units).matchQuality).toBe('not_found')
  })

  it('luồng TEXT thuần (không hộp) → locator offset ký tự', () => {
    const a = locateInUnits('Đếm đến một trăm', [{ text: 'Đếm đến một trăm rồi so sánh', order: 0 }])
    expect(a.locator).toEqual({ kind: 'text', start: 0, end: 16 })
  })

  it('span NHẢY TRANG → tìm thấy nhưng KHÔNG khung, không cả trang (mơ hồ)', () => {
    const cross = [w('Đếm', 0, 1), w('đến', 1, 1), w('một', 2, 2), w('trăm', 3, 2)]
    const a = locateInUnits('Đếm đến một trăm', cross)
    expect(a.matchQuality).toBe('exact')
    expect(a.locator).toBeUndefined()
  })

  it('thứ tự đọc ĐỨT QUÃNG (nhiều cột) cùng trang → giữ TRANG, khung rỗng (không vẽ bừa)', () => {
    const gapped = [w('Đếm', 0), w('đến', 1), w('một', 5), w('trăm', 6)]
    const a = locateInUnits('Đếm đến một trăm', gapped)
    expect(a.locator).toEqual({ kind: 'pdf', page: 2, rects: [] })
  })
})
