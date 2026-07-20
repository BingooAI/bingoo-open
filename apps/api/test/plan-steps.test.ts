// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * CẤU TRÚC bài = MỖI KC MỘT CHUỖI (arc). Sanitizer phải ép hợp lệ mà KHÔNG áp luồng cứng, và không
 * cho gộp nhiều KC. Chạy offline, không LLM.
 */

import { describe, expect, it } from 'vitest'
import { sanitizeKcArcs } from '../src/services/plan-adapters'

const teaches = ['count-to-10', 'add-within-20']

describe('sanitizeKcArcs', () => {
  it('mỗi KC một arc, giữ THỨ TỰ bước trong arc', () => {
    const arcs = sanitizeKcArcs(
      [
        {
          kc: 'count-to-10',
          steps: [
            { role: 'hook', deliveryKind: 'content', durationMin: 3 },
            { role: 'teach', deliveryKind: 'explainer', durationMin: 8 },
            { role: 'assessment', deliveryKind: 'assessment', durationMin: 5 },
          ],
        },
        {
          kc: 'add-within-20',
          steps: [{ role: 'teach', deliveryKind: 'explainer', durationMin: 6 }],
        },
      ],
      teaches,
    )
    expect(arcs.map((a) => a.kc)).toEqual(['count-to-10', 'add-within-20'])
    expect(arcs[0]?.steps.map((s) => s.role)).toEqual(['hook', 'teach', 'assessment'])
  })

  it('CHỈ nhận KC có thật trong bài — arc của KC bịa bị loại', () => {
    const arcs = sanitizeKcArcs(
      [
        { kc: 'add-within-20', steps: [{ role: 'teach', deliveryKind: 'content' }] },
        { kc: 'the-2-times-table', steps: [{ role: 'teach', deliveryKind: 'content' }] },
      ],
      teaches,
    )
    expect(arcs.map((a) => a.kc)).toEqual(['add-within-20'])
  })

  it('mỗi KC chỉ một arc — arc trùng KC bị bỏ (không gộp/nhân bản)', () => {
    const arcs = sanitizeKcArcs(
      [
        { kc: 'count-to-10', steps: [{ role: 'teach', deliveryKind: 'content' }] },
        { kc: 'count-to-10', steps: [{ role: 'practice', deliveryKind: 'practice' }] },
      ],
      teaches,
    )
    expect(arcs).toHaveLength(1)
  })

  it('role mở (giữ vai trò lạ); bước không role bị loại; duration kẹp [1,60]', () => {
    const arcs = sanitizeKcArcs(
      [
        {
          kc: 'count-to-10',
          steps: [
            { role: 'productive-struggle', deliveryKind: 'practice', durationMin: 999 },
            { deliveryKind: 'content' }, // không role → loại
            { role: 'x', durationMin: 0 },
          ],
        },
      ],
      teaches,
    )
    expect(arcs[0]?.steps.map((s) => s.role)).toEqual(['productive-struggle', 'x'])
    expect(arcs[0]?.steps.map((s) => s.durationMin)).toEqual([60, 1])
  })

  it('deliveryKind lạ → "content"; bước KHÔNG mang targets (thuộc đúng KC của arc)', () => {
    const arcs = sanitizeKcArcs(
      [{ kc: 'count-to-10', steps: [{ role: 'teach', deliveryKind: 'hologram' }] }],
      teaches,
    )
    expect(arcs[0]?.steps[0]?.deliveryKind).toBe('content')
    expect(arcs[0]?.steps[0]).not.toHaveProperty('targets')
  })
})
