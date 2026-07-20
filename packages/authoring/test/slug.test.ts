/** SLUG = khoá VĨNH VIỄN. TIẾNG ANH LÀ GỐC — cùng kiến thức phải ra cùng slug dù nguồn viết bằng gì. */

import { describe, expect, it } from 'vitest'
import { canonicalTitle, mintSlug, slugify } from '../src/index'

describe('canonicalTitle', () => {
  it('luôn lấy tiếng Anh làm gốc, dù "vi" đứng trước trong object', () => {
    expect(canonicalTitle({ vi: 'Phép cộng trong phạm vi 20', en: 'Add within 20' })).toBe('Add within 20')
  })
  it('chấp nhận en-US', () => {
    expect(canonicalTitle({ 'en-US': 'Add within 20' })).toBe('Add within 20')
  })
  it('không có tiếng Anh → dùng tạm cái có (I7 sẽ chặn ở cổng ghi)', () => {
    expect(canonicalTitle({ vi: 'Phép cộng' })).toBe('Phép cộng')
  })
})

describe('slugify', () => {
  it('bỏ dấu tiếng Việt, đ → d', () => {
    expect(slugify('Đếm số')).toBe('dem-so')
  })
  it('cắt ở BIÊN TỪ, không quá 56 ký tự — slug là khoá, không phải câu văn', () => {
    const s = slugify('Count objects from 0 to 20 recognising conservation of number and more')
    expect(s.length).toBeLessThanOrEqual(56)
    expect(s.endsWith('-')).toBe(false)
    expect(s.split('-').every((w) => w.length > 0)).toBe(true)
  })
})

describe('mintSlug — chống va chạm', () => {
  it('slug đã bị chiếm → thêm hậu tố, và tự ghi nhận là đã chiếm', () => {
    const taken = new Set(['add-within-20'])
    const a = mintSlug('add-within-20', taken)
    expect(a).not.toBe('add-within-20')
    const b = mintSlug('add-within-20', taken)
    expect(b).not.toBe(a)
  })
})
