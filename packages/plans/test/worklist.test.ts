/** Flattener arcs→steps: giữ THỨ TỰ + đầy đủ; bước nào đổ bank. Thuần, offline. */

import { describe, expect, it } from 'vitest'
import { lessonStepWork, stepEmitsBankItems } from '../src/worklist'
import type { LessonInstructionPlan, LessonStep } from '../src/model'

const step = (slug: string, kind: LessonStep['deliveryKind']): LessonStep => ({
  slug,
  role: kind,
  title: { en: slug },
  durationMin: 5,
  deliveryKind: kind,
})

const lesson: LessonInstructionPlan = {
  slug: 'l',
  version: 1,
  title: { en: 'L' },
  teaches: ['a', 'b'],
  knowledgePoints: [],
  kcArcs: [
    { kc: 'a', steps: [step('a-teach', 'explainer'), step('a-assess', 'assessment')] },
    { kc: 'b', steps: [step('b-teach', 'content'), step('b-practice', 'practice')] },
  ],
}

describe('lessonStepWork', () => {
  it('làm phẳng theo ĐÚNG thứ tự arc→step, đủ mọi bước, gắn đúng KC', () => {
    const w = lessonStepWork(lesson)
    expect(w.map((x) => `${x.kc}:${x.step.slug}`)).toEqual([
      'a:a-teach',
      'a:a-assess',
      'b:b-teach',
      'b:b-practice',
    ])
    expect(w.map((x) => x.arcIndex)).toEqual([0, 0, 1, 1])
  })

  it('bài không kcArcs → rỗng', () => {
    expect(lessonStepWork({ ...lesson, kcArcs: undefined })).toEqual([])
  })
})

describe('stepEmitsBankItems', () => {
  it('content/practice/assessment → đổ bank; explainer/reflection → không', () => {
    expect(stepEmitsBankItems(step('x', 'content'))).toBe(true)
    expect(stepEmitsBankItems(step('x', 'practice'))).toBe(true)
    expect(stepEmitsBankItems(step('x', 'assessment'))).toBe(true)
    expect(stepEmitsBankItems(step('x', 'explainer'))).toBe(false)
    expect(stepEmitsBankItems(step('x', 'reflection'))).toBe(false)
  })
})
