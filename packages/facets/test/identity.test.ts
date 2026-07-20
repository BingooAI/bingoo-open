/**
 * Luật ĐỊNH DANH — mỗi test ở đây canh MỘT lớp lỗi đã thực sự xảy ra khi chạy dữ liệu thật.
 * Không có test nào là giả định: 6 lớp lỗi dưới đây đều được phát hiện bằng tay, rất muộn.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IDENTITY_AXES,
  compareIdentity,
  facetKey,
  normalizeFacets,
  type DomainProfile,
} from '../src/index'

const math: DomainProfile = {
  domain: 'math',
  requiredAxes: ['object', 'bloom'],
  aliases: { object: { 'addition (+)': 'addition', sum: 'addition' } },
}

describe('normalizeFacets', () => {
  it('chuẩn hoá hoa/thường + khoảng trắng để "Counting" và "counting " là một', () => {
    expect(normalizeFacets({ object: '  Counting ' })).toEqual({ object: 'counting' })
  })

  it('áp alias của MÔN (dữ liệu, không phải code): "sum" → "addition"', () => {
    expect(normalizeFacets({ object: 'Sum' }, math).object).toBe('addition')
  })

  it('sắp xếp khoá của scope → thứ tự khai báo không đổi định danh', () => {
    expect(facetKey({ scope: { max: 20, min: 0 } })).toBe(facetKey({ scope: { min: 0, max: 20 } }))
  })
})

describe('compareIdentity', () => {
  it('trục định danh mặc định CHỈ gồm trục ổn định (object, scope)', () => {
    expect([...DEFAULT_IDENTITY_AXES]).toEqual(['object', 'scope'])
  })

  // LỚP LỖI #9: trước khi có trục `object`, "parity" và "addition" ra facets y hệt nhau
  // → 5 va chạm định danh giả. Đây là test canh chuyện đó.
  it('khác OBJECT → DIFFERENT dứt khoát (parity ≠ addition, dù mọi trục khác giống hệt)', () => {
    const r = compareIdentity(
      { object: 'parity', bloom: 'understand', channel: 'reason' },
      { object: 'addition', bloom: 'understand', channel: 'reason' },
      math,
    )
    expect(r.verdict).toBe('DIFFERENT')
    expect(r.axes).toContain('object')
  })

  it('khác SCOPE → DIFFERENT (within 20 ≠ within 100)', () => {
    const r = compareIdentity(
      { object: 'counting', scope: { max: 20 } },
      { object: 'counting', scope: { max: 100 } },
      math,
    )
    expect(r.verdict).toBe('DIFFERENT')
    expect(r.axes).toEqual(['scope'])
  })

  // LỚP LỖI #10: coi 7 trục ngang nhau → 9/10 phán quyết ra OVERLAP vô dụng.
  // channel/bloom/representation là PHÁN ĐOÁN của LLM, nhiễu giữa hai lần trích → không được kết luận.
  it('chỉ lệch ở trục MÔ TẢ (bloom) → UNKNOWN, KHÔNG được kết luận DIFFERENT', () => {
    const r = compareIdentity(
      { object: 'addition', scope: { max: 20 }, bloom: 'apply' },
      { object: 'addition', scope: { max: 20 }, bloom: 'understand' },
      math,
    )
    expect(r.verdict).toBe('UNKNOWN')
    expect(r.axes).toEqual(['bloom'])
  })

  it('trùng khít trục định danh + khai đủ trục bắt buộc → SAME (ứng viên gộp)', () => {
    const f = { object: 'addition', scope: { max: 20 }, bloom: 'apply' } as const
    expect(compareIdentity(f, { ...f }, math).verdict).toBe('SAME')
  })

  it('thiếu trục BẮT BUỘC của môn → UNKNOWN, không bao giờ tự gộp', () => {
    const r = compareIdentity({ object: 'addition' }, { object: 'addition' }, math)
    expect(r.verdict).toBe('UNKNOWN')
    expect(r.axes).toContain('bloom')
  })

  it('hồ sơ môn có thể MỞ RỘNG trục định danh bằng DỮ LIỆU (ngôn ngữ: channel là định danh)', () => {
    // Nghe ≠ đọc là hai năng lực khác nhau THẬT trong môn ngôn ngữ — nhưng đó là chuyện của
    // hồ sơ môn (một dòng DB), không phải một schema riêng cho từng môn trong code.
    const lang: DomainProfile = {
      domain: 'language',
      requiredAxes: ['object', 'channel'],
      identityAxes: ['object', 'scope', 'channel'],
    }
    const r = compareIdentity(
      { object: 'past-simple', channel: 'listen' },
      { object: 'past-simple', channel: 'read' },
      lang,
    )
    expect(r.verdict).toBe('DIFFERENT')
    expect(r.axes).toContain('channel')
  })
})
