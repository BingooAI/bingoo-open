// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * KHÉP VÒNG BẰNG CHỨNG CHO 67 KIT — kit thao tác chấm được → Verdict → (Observation → mastery).
 * Trước đây `graderFor` trả null cho kit nên hệ MÙ với mọi tương tác kit → không adaptive được.
 *
 * Hai điều canh:
 *  ① Đăng ký ĐỘNG + namespace `manip:` — kit KHÔNG đè quiz type trùng tên (tenframe/numberline/clock…).
 *  ② manipGrader ĐỘNG — đọc kind trong payload → checkAnswer, kit mới không cần code grader.
 */

import { describe, expect, it } from 'vitest'
import { INTERACTIVE_KITS } from '@bingoo.ai/manipulatives'
import { isKnownPrimitive, manipGrader, manipKind, primitiveMeta } from '../src/index'

describe('đăng ký kit — động + namespace', () => {
  it('mọi kit trong INTERACTIVE_KITS đều có entry `manip:<kind>` measurable + graderKind manip', () => {
    expect(INTERACTIVE_KITS.length).toBeGreaterThan(50)
    for (const k of INTERACTIVE_KITS) {
      const meta = primitiveMeta(manipKind(k))
      expect(meta, `thiếu ${manipKind(k)}`).not.toBeNull()
      expect(meta?.measurable).toBe(true)
      expect(meta?.graderKind).toBe('manip')
    }
  })

  it('VA TÊN: quiz `tenframe` (auto-key) ≠ kit `manip:tenframe` (manip) — không đè nhau', () => {
    // 'tenframe' là loại câu hỏi core → auto-key; 'manip:tenframe' là kit thao tác → manip.
    expect(primitiveMeta('tenframe')?.graderKind).toBe('auto-key')
    expect(primitiveMeta('manip:tenframe')?.graderKind).toBe('manip')
    expect(isKnownPrimitive('manip:tenframe')).toBe(true)
  })

  it('kit KHÔNG namespace không phải primitive hợp lệ (phải qua manipKind)', () => {
    // 'base10' trần không có trong registry (chỉ 'manip:base10') → tránh nhầm.
    expect(isKnownPrimitive('base10')).toBe(false)
    expect(isKnownPrimitive('manip:base10')).toBe(true)
  })
})

describe('manipGrader — động qua checkAnswer', () => {
  it('kit CÓ check riêng (base10): trạng thái đúng → correct', () => {
    const payload = { kind: 'base10', target: { value: 123 } }
    expect(manipGrader(payload, { hundreds: 1, tens: 2, ones: 3 })).toEqual({
      correct: true,
      score: 1,
    })
    expect(manipGrader(payload, { hundreds: 1, tens: 2, ones: 4 })).toEqual({
      correct: false,
      score: 0,
    })
  })

  it('kit KHÔNG check riêng (dùng field-match chung): partwhole', () => {
    // genericCheck: mọi khoá của target phải khớp field trong response.
    const payload = { kind: 'partwhole', target: { whole: 10, parts: [4, 6] } }
    expect(manipGrader(payload, { whole: 10, parts: [4, 6] }).correct).toBe(true)
    expect(manipGrader(payload, { whole: 10, parts: [5, 6] }).correct).toBe(false)
  })

  it('payload thiếu kind → incorrect (không nổ)', () => {
    expect(manipGrader({ target: { value: 1 } }, { value: 1 })).toEqual({
      correct: false,
      score: 0,
    })
    expect(manipGrader(null, null)).toEqual({ correct: false, score: 0 })
  })
})
