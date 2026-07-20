/**
 * graderFor — dispatch theo graderKind (dữ liệu registry), KHÔNG theo tên kind cứng. Kit (namespace
 * `manip:`) route sang manipGrader; quiz trùng tên vẫn auto-key. Chạy offline.
 */

import { describe, expect, it } from 'vitest'
import { manipKind } from '@bingoo/authored-item'
import { graderFor } from '../src/services/graders'

describe('graderFor', () => {
  it('kit `manip:base10` → có grader, chấm được', () => {
    const g = graderFor(manipKind('base10'))
    expect(g).not.toBeNull()
    expect(g!({ kind: 'base10', target: { value: 42 } }, { hundreds: 0, tens: 4, ones: 2 })).toEqual({
      correct: true,
      score: 1,
    })
  })

  it('VA TÊN ở tầng dispatch: quiz `tenframe` và kit `manip:tenframe` KHÁC grader', () => {
    expect(graderFor('tenframe')).not.toBeNull() // quiz auto-key
    expect(graderFor('manip:tenframe')).not.toBeNull() // kit manip
    // Khác hàm grader → không lẫn cách chấm.
    expect(graderFor('tenframe')).not.toBe(graderFor('manip:tenframe'))
  })

  it('primitive cần rater ngoài (observation) → null', () => {
    expect(graderFor('observation')).toBeNull()
  })

  it('primitive lạ → null', () => {
    expect(graderFor('khong-ton-tai')).toBeNull()
  })
})
