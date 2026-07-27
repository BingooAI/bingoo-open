// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * ĐỌC THẺ CĂN CỨ — hai chỗ dễ sai nhất, tách thuần ra để kiểm không cần cơ sở dữ liệu.
 *
 * 1. GOM THEO THẾ HỆ. Nhập lại một khung sinh thẻ mới cho cùng một chỗ. Lấy nhầm bản cũ thì người
 *    duyệt đọc một căn cứ đã bị thay thế mà không có dấu hiệu nào cho biết.
 *
 * 2. KIỂM LẠI SỐNG, và nhất là CỰC TÍNH của nó. Chỗ ghi lưu `passed = máy CHỨNG được thứ tự` cho cả
 *    ba mã thứ tự. Đọc mã `order:judgment` thành "có đúng là phán đoán không" là đảo nghĩa — đã mắc
 *    đúng lỗi đó, và hậu quả là mọi cạnh phán đoán báo lệch, tức màn hình giục người duyệt xem lại
 *    những cạnh không hề đổi gì. Một cảnh báo sai hàng loạt còn tệ hơn không cảnh báo.
 */

import { describe, expect, it } from 'vitest'
import { newestPerSubject, recheck } from '../src/services/decision-trace.service'

const row = (subjectSlug: string, objectSlug: string | null, at: string, id: string) => ({
  id,
  subjectSlug,
  objectSlug,
  relType: objectSlug ? 'PREREQUISITE' : null,
  createdAt: new Date(at),
})

describe('gom theo thế hệ — bản mới nhất thắng, số bản cũ nói ra', () => {
  it('cùng một chỗ, ba lần nhập → giữ bản mới nhất, đếm hai bản cũ', () => {
    const out = newestPerSubject([
      row('count-20', 'count-100', '2026-07-01T00:00:00Z', 'cũ-nhất'),
      row('count-20', 'count-100', '2026-07-20T00:00:00Z', 'mới-nhất'),
      row('count-20', 'count-100', '2026-07-10T00:00:00Z', 'giữa'),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]?.row.id).toBe('mới-nhất')
    expect(out[0]?.supersededCount).toBe(2)
  })

  it('khác ĐÍCH thì là hai chỗ khác nhau, không gộp làm một', () => {
    const out = newestPerSubject([
      row('count-20', 'count-100', '2026-07-01T00:00:00Z', 'a'),
      row('count-20', 'add-20', '2026-07-01T00:00:00Z', 'b'),
    ])
    expect(out).toHaveLength(2)
    expect(out.every((o) => o.supersededCount === 0)).toBe(true)
  })
})

/** Đồ thị đang có: đếm-20 nằm gọn trong đếm-100, và một mục tiêu đo bằng đếm-100. */
const live = {
  idBySlug: new Map([
    ['count-20', 'i1'],
    ['count-100', 'i2'],
    ['obj-1', 'i3'],
  ]),
  facetsBySlug: new Map<string, Record<string, unknown>>([
    ['count-20', { object: 'counting', channel: 'compute', scope: { max: 20 } }],
    ['count-100', { object: 'counting', channel: 'compute', scope: { max: 100 } }],
    ['obj-1', {}],
  ]),
  mapsToCount: new Map([['obj-1', 1]]),
  edgeKeys: new Set(['obj-1|count-100|MAPS_TO']),
}

const edge = (from: string, to: string) => ({ subjectSlug: from, objectSlug: to, relType: 'PREREQUISITE' })

describe('kiểm lại sống — cùng một câu hỏi cho cả ba mã thứ tự', () => {
  it('chiều hẹp-trước-rộng: cả ba mã đều trả CHỨNG ĐƯỢC', () => {
    for (const code of ['scope:subset', 'scope:superset', 'order:judgment']) {
      expect(recheck(code, edge('count-20', 'count-100'), live)).toBe(true)
    }
  })

  it('chiều ngược: cả ba mã đều trả KHÔNG chứng được — không mã nào đảo nghĩa', () => {
    for (const code of ['scope:subset', 'scope:superset', 'order:judgment']) {
      expect(recheck(code, edge('count-100', 'count-20'), live)).toBe(false)
    }
  })

  it('thiếu một đầu thì trả false, không giả vờ chứng được', () => {
    expect(recheck('order:judgment', edge('count-20', 'khong-co'), live)).toBe(false)
  })
})

describe('kiểm lại sống — các mã còn lại', () => {
  it('mục tiêu còn đo bằng ít nhất một mảnh (I5)', () => {
    expect(
      recheck('coverage:nonempty', { subjectSlug: 'obj-1', objectSlug: null, relType: null }, live),
    ).toBe(true)
    expect(
      recheck('coverage:nonempty', { subjectSlug: 'count-20', objectSlug: null, relType: null }, live),
    ).toBe(false)
  })

  it('kiến thức có khai nó nói VỀ CÁI GÌ (I1)', () => {
    expect(
      recheck('facets:discriminating', { subjectSlug: 'count-20', objectSlug: null, relType: null }, live),
    ).toBe(true)
    expect(
      recheck('facets:discriminating', { subjectSlug: 'obj-1', objectSlug: null, relType: null }, live),
    ).toBe(false)
  })

  it('cạnh đo còn đó và còn đúng kiểu (I4)', () => {
    expect(
      recheck(
        'coverage:required-all',
        { subjectSlug: 'obj-1', objectSlug: 'count-100', relType: 'MAPS_TO' },
        live,
      ),
    ).toBe(true)
    expect(
      recheck(
        'coverage:required-all',
        { subjectSlug: 'obj-1', objectSlug: 'count-20', relType: 'MAPS_TO' },
        live,
      ),
    ).toBe(false)
  })

  it('mã lạ trả UNDEFINED, không trả false', () => {
    // "chưa kiểm lại được" và "kiểm rồi, trượt" là hai chuyện khác hẳn. Gộp lại là dựng ra một lời
    // cảnh báo không có thật, và người duyệt đi sửa một thứ không hỏng.
    expect(recheck('mã:chưa-có', edge('count-20', 'count-100'), live)).toBeUndefined()
  })
})
