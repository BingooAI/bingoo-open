// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * BRIDGE explainer-step → LessonBrief. Canh: brief ra HỢP LỆ (parseBrief nhận) + đúng điểm nối:
 * skills=[kc] (feed bank), facts (chống bịa), durationMin→sceneCount, brief/mustCover→notes,
 * misconceptions từ KP. Thuần, offline.
 */

import { describe, expect, it } from 'vitest'
import { parseBrief } from '@bingoo.ai/explainer'
import type { KnowledgePoint, LessonStep } from '@bingoo.ai/plans'
import { lessonStepToBrief, type ExplainerBridgeInput } from '../src/services/explainer-bridge'

const step: LessonStep = {
  slug: 'teach-count',
  role: 'teach',
  title: { en: 'Teach counting', vi: 'Dạy đếm' },
  durationMin: 5,
  deliveryKind: 'explainer',
  brief: {
    en: 'use a ten-frame to combine 7+5, make the ten explicitly',
    vi: 'dùng ten-frame gộp 7+5',
  },
  mustCover: [{ en: 'show the carry step', vi: 'chỉ bước nhớ' }],
}

const kp: KnowledgePoint = {
  slug: 'kp-count',
  version: 1,
  targets: ['count-to-20'],
  misconceptions: [
    {
      id: 'm1',
      type: 'conceptual',
      wrong: { en: 'counts the last number twice' },
      targetsKc: 'count-to-20',
    },
  ],
  representations: [],
  successCriteria: [],
}

const base: ExplainerBridgeInput = {
  step,
  kcSlug: 'count-to-20',
  kcTitle: 'Count within 20',
  language: 'vi',
  subject: 'math',
  audience: { stage: 'primary', grade: 'Stage 1' },
  representationStage: 'concrete',
  band: 'core',
  knowledgePoints: [kp],
  prerequisites: ['count-to-10'],
  facts: [{ id: 'f1', statement: '7 + 5 = 12', value: 12 }],
  successCriteria: ['Learner can count objects within 20'],
}

describe('lessonStepToBrief', () => {
  it('ra LessonBrief HỢP LỆ (parseBrief nhận)', () => {
    const parsed = parseBrief(lessonStepToBrief(base))
    expect(parsed.ok, parsed.ok ? '' : JSON.stringify((parsed as { issues: unknown }).issues)).toBe(true)
  })

  it('ĐIỂM NỐI BANK: objective.skills = [kcSlug] (explainer kéo câu đã duyệt)', () => {
    const b = lessonStepToBrief(base)
    expect(b.objectives[0]?.skills).toEqual(['count-to-20'])
    expect(b.objectives[0]?.id).toBe('count-to-20')
  })

  it('facts đã kiểm được mang sang (chống bịa số)', () => {
    const b = lessonStepToBrief(base)
    expect(b.facts).toEqual([{ id: 'f1', statement: '7 + 5 = 12', value: 12 }])
  })

  it('brief + mustCover → subject.notes (nội dung cụ thể)', () => {
    const b = lessonStepToBrief(base)
    expect(b.subject.notes).toContain('ten-frame')
    expect(b.subject.notes).toContain('carry step')
  })

  it('misconceptions lấy từ KP', () => {
    expect(lessonStepToBrief(base).misconceptions).toContain('counts the last number twice')
  })

  it('durationMin → sceneCount (~32s/cảnh, kẹp 3–12)', () => {
    // 5 phút = 300s / 32 ≈ 9
    expect(lessonStepToBrief(base).constraints.sceneCount).toBe(9)
    // 20 phút → kẹp 12
    expect(lessonStepToBrief({ ...base, step: { ...step, durationMin: 20 } }).constraints.sceneCount).toBe(12)
    // 1 phút → kẹp 3
    expect(lessonStepToBrief({ ...base, step: { ...step, durationMin: 1 } }).constraints.sceneCount).toBe(3)
  })

  it('representation concrete → imagePolicy rich; abstract → sparing', () => {
    expect(lessonStepToBrief(base).constraints.imagePolicy).toBe('rich')
    expect(lessonStepToBrief({ ...base, representationStage: 'abstract' }).constraints.imagePolicy).toBe(
      'sparing',
    )
  })

  it('band → assessment.difficulty', () => {
    expect(lessonStepToBrief({ ...base, band: 'easy' }).assessment.difficulty).toBe('intro')
    expect(lessonStepToBrief({ ...base, band: 'stretch' }).assessment.difficulty).toBe('challenge')
  })
})
