// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Giải thích quan hệ — MÁY CHỨNG được cái gì, cái gì là phán đoán. Bài quan trọng nhất:
 * khác đối tượng → KHÔNG được tuyên "chứng minh được thứ tự" (đó là chỗ dễ bịa nhất).
 */

import { describe, expect, it } from 'vitest'
import { explainRelation } from '../src/index'
import type { Facets } from '@bingoo.ai/facets'

const f = (object: string, scope: Record<string, number>): Facets => ({ object, scope })

describe('explainRelation', () => {
  it('cùng đối tượng + nhỏ ⊂ lớn → CHỨNG ĐƯỢC (học phần nhỏ trước)', () => {
    const r = explainRelation(f('count', { max: 20 }), f('count', { max: 100 }), 'PREREQUISITE')
    expect(r.basis).toBe('ordering-proven')
    expect(r.machineProven).toBe(true)
  })

  it('cùng đối tượng nhưng rộng ⊃ hẹp → thứ tự NGƯỢC (cần xem lại)', () => {
    const r = explainRelation(f('count', { max: 100 }), f('count', { max: 20 }), 'PREREQUISITE')
    expect(r.basis).toBe('ordering-contradicted')
    expect(r.machineProven).toBe(false)
  })

  it('KHÁC đối tượng → KHÔNG chứng được, là phán đoán người soạn/AI', () => {
    const r = explainRelation(f('count', { max: 100 }), f('place-value', { max: 100 }), 'PREREQUISITE')
    expect(r.basis).toBe('ordering-judgment')
    expect(r.machineProven).toBe(false)
  })

  it('thiếu facet (không so được) → phán đoán, không chứng bừa', () => {
    expect(explainRelation(undefined, undefined, 'PREREQUISITE').basis).toBe('ordering-judgment')
  })

  it('MAPS_TO → mapping (mục tiêu đo bằng kiến thức)', () => {
    expect(
      explainRelation(f('objective', { max: 100 }), f('place-value', { max: 100 }), 'MAPS_TO').basis,
    ).toBe('mapping')
  })

  it('ALIGNS → lateral (liên quan, không phải thứ tự học)', () => {
    expect(explainRelation(f('a', { max: 1 }), f('b', { max: 1 }), 'ALIGNS').basis).toBe('lateral')
  })
})
