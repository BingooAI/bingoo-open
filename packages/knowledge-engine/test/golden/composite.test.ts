// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest'
import { buildGraph, compositeMastery, type GraphData, type SkillMastery } from '../../src/index'

/** SPEC Phụ lục C.4 — rollup composite trên graph nhỏ. */

const data: GraphData = {
  nodes: ['p1', 'p2', 'whole', 'a', 'b', 'role'].map((slug) => ({
    slug,
    title: {},
    kind: 'KNOWLEDGE' as const,
  })),
  edges: [
    { from: 'p1', to: 'whole', relType: 'COMPOSES', mode: 'RECOMMENDED', weight: 2 },
    { from: 'p2', to: 'whole', relType: 'COMPOSES', mode: 'RECOMMENDED', weight: 1 },
    { from: 'a', to: 'role', relType: 'COMPOSES', mode: 'REQUIRED' },
    { from: 'b', to: 'role', relType: 'COMPOSES', mode: 'REQUIRED' },
  ],
}

const graph = buildGraph(data)
const states = new Map<string, SkillMastery>([
  ['p1', { skill: 'p1', pKnown: 0.9, ability: 1000, attempts: 1, correct: 1, lastSeenMs: null }],
  ['p2', { skill: 'p2', pKnown: 0.4, ability: 1000, attempts: 1, correct: 0, lastSeenMs: null }],
  ['a', { skill: 'a', pKnown: 0.9, ability: 1000, attempts: 1, correct: 1, lastSeenMs: null }],
  ['b', { skill: 'b', pKnown: 0.5, ability: 1000, attempts: 1, correct: 0, lastSeenMs: null }],
])

const r4 = (x: number): number => Math.round(x * 1e4) / 1e4

describe('C.4 compositeMastery', () => {
  it('whole = 0.7333 (RECOMMENDED → weighted mean)', () => {
    expect(r4(compositeMastery(graph, states, 'whole'))).toBe(0.7333)
  })
  it('role = 0.5000 (REQUIRED → min mắt xích yếu nhất)', () => {
    expect(r4(compositeMastery(graph, states, 'role'))).toBe(0.5)
  })
  it('p1 = 0.9000 (lá: direct)', () => {
    expect(r4(compositeMastery(graph, states, 'p1'))).toBe(0.9)
  })
  it('role, unseenPrior:0 = 0.5000', () => {
    expect(r4(compositeMastery(graph, states, 'role', { unseenPrior: 0 }))).toBe(0.5)
  })
})
