// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Versioning khung (SPEC §9) — trước đây là code CHẾT (không consumer, không test). Nay `authoring.repo`
 * gọi `nextSemver` + `cloneObjectivesForward` để "tạo version mới" nhân objective sang bản mới thay vì
 * ra bản RỖNG. Các test này canh đúng hai tính chất load-bearing: bump semver đúng, và cạnh clone TRỎ
 * VỀ CÙNG concept nền (nhờ đó SkillState của người học không phải di trú).
 */
import { describe, expect, it } from 'vitest'
import {
  cloneObjectivesForward,
  nextSemver,
  slugForVersion,
  type LateralEdgeRef,
  type SourceObjective,
} from '../src/index'

describe('nextSemver (SPEC §9.1)', () => {
  it('không có bản trước → 1.0.0', () => {
    expect(nextSemver(null, 'MAJOR')).toEqual({ major: 1, minor: 0, patch: 0 })
  })

  it('MAJOR/MINOR/PATCH bump đúng, không mâu thuẫn', () => {
    const base = { major: 1, minor: 2, patch: 3 }
    expect(nextSemver(base, 'MAJOR')).toEqual({ major: 2, minor: 0, patch: 0 })
    expect(nextSemver(base, 'MINOR')).toEqual({ major: 1, minor: 3, patch: 0 })
    expect(nextSemver(base, 'PATCH')).toEqual({ major: 1, minor: 2, patch: 4 })
  })
})

describe('cloneObjectivesForward (SPEC §9.2)', () => {
  const to = { major: 1, minor: 1, patch: 0 }
  const objectives: SourceObjective[] = [
    { id: 'o1', slug: '1nc-01', version: 1 },
    { id: 'o2', slug: '1nc-02', version: 1 },
  ]
  const edges: LateralEdgeRef[] = [
    { fromSlug: '1nc-01', toSlug: 'count-to-10', relType: 'MAPS_TO', mode: 'REQUIRED', weight: 1 },
  ]

  it('nhân objective: slug@x.y.z, version+1, supersedesId=nguồn, ghim version mới', () => {
    const plan = cloneObjectivesForward(objectives, edges, to, 'V2', new Set())
    expect(plan.objectives).toHaveLength(2)
    const o1 = plan.objectives.find((o) => o.sourceSlug === '1nc-01')!
    expect(o1.newSlug).toBe(slugForVersion('1nc-01', to))
    expect(o1.newSlug).toBe('1nc-01@1.1.0')
    expect(o1.newVersion).toBe(2)
    expect(o1.supersedesId).toBe('o1')
    expect(o1.frameworkVersionId).toBe('V2')
  })

  it('cạnh clone TRỎ VỀ CÙNG concept nền (toSlug giữ nguyên) — SkillState khỏi di trú', () => {
    const plan = cloneObjectivesForward(objectives, edges, to, 'V2', new Set())
    expect(plan.edges).toEqual([
      { fromSlug: '1nc-01@1.1.0', toSlug: 'count-to-10', relType: 'MAPS_TO', mode: 'REQUIRED', weight: 1 },
    ])
  })

  it('idempotent: slug bản mới đã tồn tại → bỏ qua, và cạnh của nó cũng không clone', () => {
    const plan = cloneObjectivesForward(objectives, edges, to, 'V2', new Set(['1nc-01@1.1.0']))
    expect(plan.objectives.map((o) => o.sourceSlug)).toEqual(['1nc-02'])
    expect(plan.skipped).toContain('1nc-01@1.1.0')
    expect(plan.edges).toHaveLength(0)
  })
})
