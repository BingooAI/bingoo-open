// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Nhà máy nội dung phải để CẤU TRÚC GIÁO ÁN (kcArcs) LÁI SINH: đi theo từng bước, dispatch đúng
 * deliveryKind, bỏ explainer/reflection, sinh MỌI nhánh forStates, và brief bám đúng ngôn ngữ người
 * học. Bài chưa dựng kcArcs thì lùi về per-KC. Chạy OFFLINE bằng port giả — không gọi LLM, không DB.
 */
import { describe, expect, it } from 'vitest'
import type { AuthoredItem } from '@bingoo.ai/authored-item'
import type { StepBrief } from '@bingoo.ai/content-gen'
import type { Slug } from '@bingoo.ai/knowledge-engine'
import type { GenerationSpec, LearnerPersona } from '@bingoo.ai/personalization'
import type { LessonInstructionPlan, LessonStep } from '@bingoo.ai/plans'
import { generateLessonContent } from '../src/services/content-generate.service'

interface Call {
  readonly kc: string
  readonly step?: StepBrief
}
function recorder() {
  const calls: Call[] = []
  const port = {
    generate(_spec: GenerationSpec, kc: Slug, step?: StepBrief): Promise<readonly AuthoredItem[]> {
      calls.push({ kc, ...(step ? { step } : {}) })
      return Promise.resolve([])
    },
  }
  return { calls, port }
}

const learner: LearnerPersona = { level: 'L2', language: 'vi' }
const step = (
  slug: string,
  role: string,
  deliveryKind: LessonStep['deliveryKind'],
  extra: Partial<LessonStep> = {},
): LessonStep => ({ slug, role, title: { vi: '', en: '' }, durationMin: 5, deliveryKind, ...extra })

function lessonWithArcs(): LessonInstructionPlan {
  return {
    slug: 'l1',
    version: 1,
    title: { vi: 'Bài 1', en: 'Lesson 1' },
    teaches: ['kc-a', 'kc-b'],
    knowledgePoints: [
      {
        slug: 'kp-a',
        version: 1,
        targets: ['kc-a'],
        misconceptions: [],
        representations: [],
        successCriteria: [],
      },
      {
        slug: 'kp-b',
        version: 1,
        targets: ['kc-b'],
        misconceptions: [],
        representations: [],
        successCriteria: [],
      },
    ],
    kcArcs: [
      {
        kc: 'kc-a',
        steps: [
          step('s1', 'teach', 'content', { brief: { vi: 'dạy A', en: 'teach A' } }),
          step('s2', 'explain', 'explainer'),
          step('s3', 'practice', 'practice', { brief: { vi: 'luyện A', en: 'practice A' } }),
          step('s4', 'assess', 'assessment'),
          step('s5', 'reflect', 'reflection'),
          step('s6', 'remediate', 'content', {
            forStates: ['gap'],
            brief: { vi: 'vá A cho gap', en: 'fix A gap' },
          }),
        ],
      },
      { kc: 'kc-b', steps: [step('t1', 'teach', 'assessment')] },
    ],
  }
}

describe('generateLessonContent — kcArcs lái sinh', () => {
  it('dispatch đúng deliveryKind, bỏ explainer/reflection', async () => {
    const e = recorder()
    const a = recorder()
    const f = recorder()
    await generateLessonContent({
      lesson: lessonWithArcs(),
      learner,
      persist: false,
      ports: { exposition: e.port, assessor: a.port, flashcards: f.port },
    })
    expect(e.calls.map((c) => c.step?.role)).toEqual(['teach', 'remediate']) // content steps
    expect(a.calls.map((c) => c.step?.role)).toEqual(['practice', 'assess', 'teach']) // practice/assessment
    // slug bước phải chảy tới port → itemKey phân biệt được hai bước content cùng KC (khỏi persist đè).
    expect(e.calls.map((c) => c.step?.slug)).toEqual(['s1', 's6'])
    const all = [...e.calls, ...a.calls]
    expect(all.some((c) => c.step?.role === 'explain' || c.step?.role === 'reflect')).toBe(false)
  })

  it('nhánh gap-only VẪN được sinh (mọi nhánh forStates), brief theo tiếng Việt', async () => {
    const e = recorder()
    const a = recorder()
    const f = recorder()
    await generateLessonContent({
      lesson: lessonWithArcs(),
      learner,
      persist: false,
      ports: { exposition: e.port, assessor: a.port, flashcards: f.port },
    })
    const gap = e.calls.find((c) => c.step?.forStates?.includes('gap'))
    expect(gap?.step?.brief).toBe('vá A cho gap')
    expect(e.calls[0]?.step?.brief).toBe('dạy A')
  })

  it('bài KHÔNG kcArcs → lùi về per-KC (không step)', async () => {
    const e = recorder()
    const a = recorder()
    const f = recorder()
    const lesson: LessonInstructionPlan = { ...lessonWithArcs(), kcArcs: undefined }
    await generateLessonContent({
      lesson,
      learner,
      persist: false,
      ports: { exposition: e.port, assessor: a.port, flashcards: f.port },
    })
    expect(e.calls.map((c) => c.kc).sort()).toEqual(['kc-a', 'kc-b'])
    expect(a.calls.map((c) => c.kc).sort()).toEqual(['kc-a', 'kc-b'])
    expect(e.calls.every((c) => c.step === undefined)).toBe(true)
  })
})
