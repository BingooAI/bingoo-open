// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Quality cấp KHOÁ & UNIT — cổng duyệt. Luật: phủ đúng con (không thiếu, không bịa), có mục tiêu/
 * đầu ra/đánh giá. Chạy offline.
 */

import { describe, expect, it } from 'vitest'
import { coursePlanQuality, unitPlanQuality } from '../src/hierarchy-quality'
import type { CoursePlanDoc, UnitPlanDoc } from '../src/hierarchy'

const L = (en: string) => ({ en, vi: en })

const courseDoc = (over: Partial<CoursePlanDoc> = {}): CoursePlanDoc => ({
  courseSlug: 'c',
  title: L('C'),
  goals: [L('goal')],
  outcomes: [L('outcome')],
  approach: L('CPA'),
  sequenceRationale: L('by prereq'),
  assessmentStrategy: L('formative + summative'),
  units: [
    { slug: 'u1', title: L('U1'), focus: L('f1'), objectives: ['kc1'], order: 0 },
    { slug: 'u2', title: L('U2'), focus: L('f2'), objectives: ['kc2'], order: 1 },
  ],
  ...over,
})

describe('coursePlanQuality', () => {
  it('đủ + phủ đúng unit → approvable', () => {
    const q = coursePlanQuality(courseDoc(), ['u1', 'u2'])
    expect(q.approvable).toBe(true)
  })

  it('thiếu unit của vỏ khoá → UNIT_NOT_COVERED, chặn duyệt', () => {
    const q = coursePlanQuality(courseDoc(), ['u1', 'u2', 'u3'])
    expect(q.issues.map((i) => i.code)).toContain('UNIT_NOT_COVERED')
    expect(q.approvable).toBe(false)
  })

  it('bịa unit không có trong khoá → EXTRA_UNIT', () => {
    const q = coursePlanQuality(courseDoc(), ['u1']) // u2 không có trong vỏ
    expect(q.issues.map((i) => i.code)).toContain('EXTRA_UNIT')
  })

  it('thiếu mục tiêu/đầu ra → chặn duyệt', () => {
    const q = coursePlanQuality(courseDoc({ goals: [], outcomes: [] }), ['u1', 'u2'])
    const codes = q.issues.map((i) => i.code)
    expect(codes).toContain('NO_GOALS')
    expect(codes).toContain('NO_OUTCOMES')
    expect(q.approvable).toBe(false)
  })
})

const unitDoc = (over: Partial<UnitPlanDoc> = {}): UnitPlanDoc => ({
  unitSlug: 'u1',
  courseSlug: 'c',
  title: L('U1'),
  arc: L('lessons build up'),
  objectives: [L('obj')],
  lessons: [
    { slug: 'l1', title: L('L1'), role: L('introduce'), teaches: ['kc1'], order: 0 },
    { slug: 'l2', title: L('L2'), role: L('practise'), teaches: ['kc2'], order: 1 },
  ],
  assessmentStrategy: L('quiz'),
  successCriteria: [L('can do')],
  ...over,
})

describe('unitPlanQuality', () => {
  it('đủ + phủ đúng bài → approvable', () => {
    expect(unitPlanQuality(unitDoc(), ['l1', 'l2']).approvable).toBe(true)
  })

  it('thiếu bài của unit → LESSON_NOT_COVERED', () => {
    expect(unitPlanQuality(unitDoc(), ['l1', 'l2', 'l3']).issues.map((i) => i.code)).toContain(
      'LESSON_NOT_COVERED',
    )
  })

  it('thiếu mạch học → chặn duyệt', () => {
    const q = unitPlanQuality(unitDoc({ arc: { en: '' } }), ['l1', 'l2'])
    expect(q.issues.map((i) => i.code)).toContain('NO_ARC')
    expect(q.approvable).toBe(false)
  })
})
