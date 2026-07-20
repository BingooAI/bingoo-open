// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * primitiveDisplay — nhãn/mô tả song ngữ co-located: kit lấy từ KIT_META (@bingoo.ai/manipulatives),
 * quiz lấy từ bảng cạnh registry, còn lại titleize. Khoá: KHÔNG còn titleize thô cho kit/quiz đã khai.
 */

import { describe, expect, it } from 'vitest'
import { manipKind } from '../src/registry'
import { primitiveDisplay } from '../src/primitive-display'

describe('primitiveDisplay', () => {
  it('kit đã khai (count) → nhãn VI từ KIT_META, không titleize', () => {
    const d = primitiveDisplay(manipKind('count'))
    expect(d.label.vi).toBe('Đếm vật')
    expect(d.label.en).toBe('Count objects')
    expect(d.desc?.vi).toMatch(/đếm/i)
  })

  it('kit subitize/tenframe có nhãn VI thật (trước titleize English)', () => {
    expect(primitiveDisplay(manipKind('subitize')).label.vi).toBe('Nhận nhanh số lượng')
    expect(primitiveDisplay(manipKind('tenframe')).label.vi).toBe('Khung mười ô')
  })

  it('quiz đã khai (single) → nhãn VI từ bảng cạnh registry', () => {
    const d = primitiveDisplay('single')
    expect(d.label.vi).toBe('Chọn một')
    expect(d.label.en).toBe('Single choice')
  })

  it('kit trùng tên quiz: manip:tenframe ≠ quiz tenframe (dispatch theo namespace)', () => {
    const kit = primitiveDisplay(manipKind('tenframe'))
    const quiz = primitiveDisplay('tenframe')
    expect(kit.desc?.vi).not.toBe(quiz.desc?.vi) // bản kit "chạm thêm chấm" ≠ bản quiz "đặt số chấm"
  })

  it('loại chưa khai → titleize (không vỡ)', () => {
    expect(primitiveDisplay('block:heading').label.vi).toBe('Heading')
    // kit chưa khai nhãn vẫn có label titleize + (nếu có) mô tả từ KIT_DOCS.en
    const unknown = primitiveDisplay(manipKind('foobarkit'))
    expect(unknown.label.vi).toBe('Foobarkit')
  })
})
