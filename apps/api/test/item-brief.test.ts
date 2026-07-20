// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * ItemBrief — rút misconceptions của KC từ plan bài + render seed cho prompt (chạy offline).
 * Khoá: distractor phải NHẮM đúng hiểu-sai của ĐÚNG KC (targetsKc), không lấy nhầm KC khác.
 */

import { describe, expect, it } from 'vitest'
import { misconceptionsForKc, renderMisconceptions } from '../src/services/item-brief'

const plan = {
  knowledgePoints: [
    {
      slug: 'kp1',
      targets: ['add-within-20'],
      misconceptions: [
        {
          id: 'm1',
          type: 'procedural',
          wrong: { vi: 'Quên nhớ khi cộng qua 10', en: 'Forgets to carry' },
          targetsKc: 'add-within-20',
          diagnostic: { vi: '8+5 ra 13 hay 3?' },
        },
        { id: 'm2', type: 'conceptual', wrong: { vi: 'Đếm cả số đầu' }, targetsKc: 'count-to-10' }, // KC khác
      ],
    },
    {
      slug: 'kp2',
      targets: ['add-within-20', 'place-value'],
      misconceptions: [{ id: 'm3', type: 'incomplete', wrong: { vi: 'Chỉ cộng hàng đơn vị' } }], // không ghim targetsKc → theo KP.targets
    },
  ],
}

describe('misconceptionsForKc', () => {
  it('lấy đúng misconception ghim targetsKc = kc', () => {
    const m = misconceptionsForKc(plan, 'add-within-20')
    expect(m.map((x) => x.id).sort()).toEqual(['m1', 'm3']) // m1 (targetsKc khớp) + m3 (KP.targets chứa kc)
  })

  it('KHÔNG lấy misconception của KC khác (m2 targetsKc=count-to-10)', () => {
    const m = misconceptionsForKc(plan, 'add-within-20')
    expect(m.some((x) => x.id === 'm2')).toBe(false)
  })

  it('KC không có misconception → rỗng; doc lỗi → rỗng (không nổ)', () => {
    expect(misconceptionsForKc(plan, 'unknown-kc')).toHaveLength(0)
    expect(misconceptionsForKc(null, 'x')).toHaveLength(0)
    expect(misconceptionsForKc({}, 'x')).toHaveLength(0)
  })
})

describe('renderMisconceptions', () => {
  it('render loại + ý sai + chẩn đoán (locale vi)', () => {
    const txt = renderMisconceptions(misconceptionsForKc(plan, 'add-within-20'), 'vi')
    expect(txt).toMatch(/\[procedural\] WRONG BELIEF: Quên nhớ/)
    expect(txt).toMatch(/PROBE: 8\+5/)
    expect(txt).toMatch(/\[incomplete\] WRONG BELIEF: Chỉ cộng/)
  })

  it('rỗng → chuỗi rỗng', () => {
    expect(renderMisconceptions([], 'vi')).toBe('')
    expect(renderMisconceptions(undefined, 'vi')).toBe('')
  })
})
