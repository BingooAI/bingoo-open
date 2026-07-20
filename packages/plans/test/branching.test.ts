/**
 * PLAN ĐA NHÁNH theo trạng thái người học — nền adaptive. Canh: chọn nhánh đúng theo trạng thái
 * (stepsForState), bước mặc định phục vụ mọi trạng thái, cảnh báo thiếu nhánh novice. Thuần, offline.
 */

import { describe, expect, it } from 'vitest'
import { stepServesState, stepsForState } from '../src/worklist'
import { planQuality } from '../src/quality'
import type { CoursePlan, KcArc, LessonStep } from '../src/model'
import type { SkillGraph } from '@bingoo/knowledge-engine'

const graph = {
  has: () => true,
  prereqsOf: () => [],
  mapsTo: () => [],
  alignedWith: () => [],
  descendants: () => [],
  unlockedBy: () => [],
  nodes: () => [],
} as unknown as SkillGraph

const step = (
  slug: string,
  kind: LessonStep['deliveryKind'],
  forStates?: LessonStep['forStates'],
): LessonStep => ({
  slug,
  role: kind,
  title: { en: slug },
  durationMin: 5,
  deliveryKind: kind,
  brief: { en: `brief ${slug}` },
  ...(forStates ? { forStates } : {}),
})

describe('stepsForState — chọn nhánh theo trạng thái', () => {
  const arc: KcArc = {
    kc: 'k',
    steps: [
      step('intro', 'explainer'), // mặc định — mọi trạng thái
      step('remediate', 'practice', ['gap']), // chỉ người hổng
      step('challenge', 'assessment', ['proficient']), // chỉ người khá
      step('assess', 'assessment'), // mặc định
    ],
  }

  it('novice: chỉ bước mặc định (intro + assess)', () => {
    expect(stepsForState(arc, 'novice').map((s) => s.slug)).toEqual(['intro', 'assess'])
  })
  it('gap: mặc định + bước vá', () => {
    expect(stepsForState(arc, 'gap').map((s) => s.slug)).toEqual(['intro', 'remediate', 'assess'])
  })
  it('proficient: mặc định + thử thách', () => {
    expect(stepsForState(arc, 'proficient').map((s) => s.slug)).toEqual(['intro', 'challenge', 'assess'])
  })
  it('bước không forStates phục vụ MỌI trạng thái', () => {
    expect(stepServesState(step('x', 'content'), 'mastered')).toBe(true)
  })
})

describe('quality — nhánh novice bắt buộc', () => {
  const courseOf = (arc: KcArc): CoursePlan => ({
    slug: 'c',
    title: { en: 'c' },
    objectives: [],
    units: [
      {
        slug: 'u',
        version: 1,
        title: { en: 'u' },
        concepts: ['k'],
        lessons: [
          {
            slug: 'l',
            version: 1,
            title: { en: 'L' },
            teaches: ['k'],
            knowledgePoints: [
              {
                slug: 'kp',
                version: 1,
                targets: ['k'],
                misconceptions: [{ id: 'm', type: 'conceptual', wrong: { en: 'x' }, targetsKc: 'k' }],
                representations: [{ stage: 'pictorial', model: { en: 'x' } }],
                successCriteria: [{ text: { en: 'x' } }],
              },
            ],
            kcArcs: [arc],
          },
        ],
      },
    ],
  })
  const codes = (arc: KcArc) => planQuality(courseOf(arc), graph).issues.map((i) => i.code)

  it('arc phân nhánh mà KHÔNG có novice → ARC_NO_NOVICE_PATH', () => {
    const arc: KcArc = {
      kc: 'k',
      steps: [step('teach', 'explainer', ['proficient']), step('assess', 'assessment', ['proficient'])],
    }
    expect(codes(arc)).toContain('ARC_NO_NOVICE_PATH')
  })

  it('arc có bước mặc định (không forStates) → luôn qua (đường novice mặc định)', () => {
    const arc: KcArc = {
      kc: 'k',
      steps: [
        step('teach', 'explainer'),
        step('assess', 'assessment'),
        step('challenge', 'practice', ['proficient']),
      ],
    }
    expect(codes(arc)).not.toContain('ARC_NO_NOVICE_PATH')
  })
})
