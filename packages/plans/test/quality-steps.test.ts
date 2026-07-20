// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * planQuality kiểm CẤU TRÚC theo từng KC (kcArcs) — hai ràng buộc QUAN TRỌNG:
 *   ① mỗi KC phải được DẠY và ĐƯỢC ĐO (arc có bước teach + assessment);
 *   ② arc xếp theo TIÊN QUYẾT (KC nền trước KC phụ thuộc).
 */

import { describe, expect, it } from 'vitest'
import { planQuality } from '../src/quality'
import type { CoursePlan, KcArc, LessonInstructionPlan, LessonStep } from '../src/model'
import type { SkillGraph } from '@bingoo.ai/knowledge-engine'

const mkGraph = (prereqs: Record<string, string[]> = {}): SkillGraph =>
  ({
    has: (s: string) => ['count-to-10', 'add-within-20'].includes(s),
    prereqsOf: (kc: string) => (prereqs[kc] ?? []).map((from) => ({ from, mode: 'REQUIRED' })),
    mapsTo: () => [],
    alignedWith: () => [],
    descendants: () => [],
    unlockedBy: () => [],
    nodes: () => [],
  }) as unknown as SkillGraph

const kp = (kc: string) => ({
  slug: `kp-${kc}`,
  version: 1,
  targets: [kc],
  misconceptions: [{ id: 'm', type: 'conceptual' as const, wrong: { en: 'x' }, targetsKc: kc }],
  representations: [{ stage: 'pictorial' as const, model: { en: 'x' } }],
  successCriteria: [{ text: { en: 'x' } }],
})

const step = (role: string, kind: LessonStep['deliveryKind']): LessonStep => ({
  slug: `s-${role}`,
  role,
  title: { en: role },
  durationMin: 5,
  deliveryKind: kind,
  brief: { en: `specific brief for ${role}` }, // có brief cụ thể → không STEP_VAGUE
})

const fullArc = (kc: string): KcArc => ({
  kc,
  steps: [step('teach', 'explainer'), step('practice', 'practice'), step('assessment', 'assessment')],
})

const courseOf = (lesson: LessonInstructionPlan): CoursePlan => ({
  slug: 'c',
  title: { en: 'c' },
  objectives: [],
  units: [{ slug: 'u', version: 1, title: { en: 'u' }, concepts: lesson.teaches, lessons: [lesson] }],
})

const base: LessonInstructionPlan = {
  slug: 'lesson-1',
  version: 1,
  title: { en: 'L' },
  teaches: ['count-to-10', 'add-within-20'],
  knowledgePoints: [kp('count-to-10'), kp('add-within-20')],
  assessment: {
    slug: 'a',
    mode: 'LEARN',
    objectives: ['count-to-10', 'add-within-20'],
    blueprint: [
      { concept: 'count-to-10', itemCount: 3 },
      { concept: 'add-within-20', itemCount: 3 },
    ],
  },
}

const codes = (l: LessonInstructionPlan, g: SkillGraph = mkGraph()): string[] =>
  planQuality(courseOf(l), g).issues.map((i) => i.code)

describe('planQuality — cấu trúc theo từng KC', () => {
  it('không có arc nào → NO_ARCS', () => {
    expect(codes(base)).toContain('NO_ARCS')
  })

  it('mỗi KC một arc đầy đủ (dạy + đo) → không cảnh báo cấu trúc', () => {
    const l = { ...base, kcArcs: [fullArc('count-to-10'), fullArc('add-within-20')] }
    const c = codes(l)
    for (const code of ['NO_ARCS', 'KC_NO_ARC', 'KC_NOT_TAUGHT', 'KC_NOT_ASSESSED', 'ARC_PREREQ_ORDER'])
      expect(c).not.toContain(code)
  })

  it('một KC không có arc → KC_NO_ARC (mỗi KC phải được quản lý riêng)', () => {
    const l = { ...base, kcArcs: [fullArc('count-to-10')] }
    expect(codes(l)).toContain('KC_NO_ARC') // thiếu add-within-20
  })

  it('KC chỉ luyện, không bước DẠY → KC_NOT_TAUGHT', () => {
    const l = {
      ...base,
      kcArcs: [
        {
          kc: 'count-to-10',
          steps: [step('practice', 'practice'), step('assessment', 'assessment')],
        },
        fullArc('add-within-20'),
      ],
    }
    expect(codes(l)).toContain('KC_NOT_TAUGHT')
  })

  it('KC được dạy nhưng không bước ĐO → KC_NOT_ASSESSED', () => {
    const l = {
      ...base,
      kcArcs: [
        { kc: 'count-to-10', steps: [step('teach', 'explainer'), step('practice', 'practice')] },
        fullArc('add-within-20'),
      ],
    }
    expect(codes(l)).toContain('KC_NOT_ASSESSED')
  })

  it('arc KC phụ thuộc đứng TRƯỚC arc tiên quyết → ARC_PREREQ_ORDER', () => {
    // add-within-20 cần count-to-10; nếu arc add đứng trước arc count → sai thứ tự.
    const l = { ...base, kcArcs: [fullArc('add-within-20'), fullArc('count-to-10')] }
    expect(codes(l, mkGraph({ 'add-within-20': ['count-to-10'] }))).toContain('ARC_PREREQ_ORDER')
  })

  it('arc đúng thứ tự tiên quyết → không cảnh báo', () => {
    const l = { ...base, kcArcs: [fullArc('count-to-10'), fullArc('add-within-20')] }
    expect(codes(l, mkGraph({ 'add-within-20': ['count-to-10'] }))).not.toContain('ARC_PREREQ_ORDER')
  })

  it('bước THIẾU brief cụ thể → STEP_VAGUE (nội dung sẽ chung chung)', () => {
    const vague: LessonStep = {
      slug: 's',
      role: 'teach',
      title: { en: 'teach' },
      durationMin: 5,
      deliveryKind: 'explainer',
    }
    const l = {
      ...base,
      kcArcs: [
        { kc: 'count-to-10', steps: [vague, step('assessment', 'assessment')] },
        fullArc('add-within-20'),
      ],
    }
    expect(codes(l)).toContain('STEP_VAGUE')
  })
})

describe('BALANCE — plan kcArcs KHÔNG bị CONCEPT_UNDERSERVED oan (fix)', () => {
  it('KC có bước practice/assessment trong arc → coi là "đã phục vụ", không cảnh báo', () => {
    const full = (kc: string): KcArc => ({
      kc,
      steps: [step('teach', 'explainer'), step('practice', 'practice'), step('assess', 'assessment')],
    })
    const l: LessonInstructionPlan = {
      ...base,
      kcArcs: [full('count-to-10'), full('add-within-20')],
    }
    // Không activities, chỉ kcArcs — trước fix sẽ CONCEPT_UNDERSERVED cả 2 KC.
    expect(codes(l)).not.toContain('CONCEPT_UNDERSERVED')
  })
})

describe('GATE — plan kcArcs đầy đủ phải DUYỆT được (không lỗi coverage oan)', () => {
  it('2 KC, arc đầy đủ (teach+practice+assess), KP đủ, assessment nhắm KC → 0 error, approvable', () => {
    const full = (kc: string): KcArc => ({
      kc,
      steps: [step('teach', 'explainer'), step('practice', 'practice'), step('assess', 'assessment')],
    })
    const l: LessonInstructionPlan = {
      ...base,
      kcArcs: [full('count-to-10'), full('add-within-20')],
    }
    const q = planQuality(courseOf(l), mkGraph())
    expect(q.issues.filter((i) => i.severity === 'error')).toEqual([]) // KHÔNG lỗi coverage oan
    expect(q.approvable).toBe(true)
  })
})
