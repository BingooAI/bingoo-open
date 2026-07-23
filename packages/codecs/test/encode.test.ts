// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest'
import type { GraphData } from '@bingoo.ai/contracts'
import { decodeCase, encodeCase } from '../src/case/index.js'

/**
 * Encoding a capability graph into CASE, and round-tripping it back.
 *
 * `encode` is the inverse of `decode`: only OBJECTIVE nodes become CFItems, a concept edge
 * (MAPS_TO) is left out, and an imported `precedes` comes back RECOMMENDED — never a hard gate
 * invented from a foreign standard.
 */

const graph: GraphData = {
  nodes: [
    {
      slug: '1nc-01',
      title: { en: 'Count to 10' },
      kind: 'OBJECTIVE',
      code: '1Nc.01',
      stage: '1',
      strand: 'Number',
      version: 1,
    },
    {
      slug: '1nc-02',
      title: { en: 'Recognise patterns' },
      kind: 'OBJECTIVE',
      code: '1Nc.02',
      stage: '1',
      version: 1,
    },
    // A concept the objective maps to — must NOT be exported (a package is an objectives overlay).
    { slug: 'count-to-10', title: { en: 'count to ten' }, kind: 'KNOWLEDGE', version: 1 },
  ],
  edges: [
    { from: '1nc-01', to: '1nc-02', relType: 'PREREQUISITE', mode: 'REQUIRED', weight: 1 },
    // objective → concept: Bingoo's decomposition, left out of the standard's package.
    { from: '1nc-01', to: 'count-to-10', relType: 'MAPS_TO', mode: 'REQUIRED', weight: 1 },
  ],
}
const framework = { slug: 'demo-maths', title: 'Demo Maths', language: 'en', version: '1.0.0' }
const T = '2026-07-23T00:00:00Z'

describe('encodeCase', () => {
  it('exports only OBJECTIVE nodes as CFItems, keeping code / stage / strand', () => {
    const { package: pkg } = encodeCase({ framework, graph, lastChangeDateTime: T })
    expect(pkg.CFItems).toHaveLength(2)
    const item = pkg.CFItems.find((i) => i.humanCodingScheme === '1Nc.01')
    expect(item?.fullStatement).toBe('Count to 10')
    expect(item?.educationLevel).toBe('1')
    expect(item?.conceptKeywords).toEqual(['Number'])
  })

  it('leaves out edges that touch a concept, keeps objective↔objective edges', () => {
    const { package: pkg, report } = encodeCase({ framework, graph, lastChangeDateTime: T })
    expect(pkg.CFAssociations).toHaveLength(1)
    expect(pkg.CFAssociations[0]?.associationType).toBe('precedes')
    // MAPS_TO to a concept is filtered by endpoint — expected, not a dropped-for-no-counterpart edge.
    expect(report.metrics['droppedEdges']).toBe(0)
    expect(report.metrics['danglingEdges']).toBe(0)
  })

  it('reports an edge that dangles to a slug not in the graph', () => {
    const withDangling: GraphData = {
      nodes: graph.nodes,
      edges: [
        ...graph.edges,
        { from: '1nc-01', to: 'ghost', relType: 'PREREQUISITE', mode: 'REQUIRED', weight: 1 },
      ],
    }
    const { report } = encodeCase({ framework, graph: withDangling, lastChangeDateTime: T })
    expect(report.metrics['danglingEdges']).toBe(1)
    expect(report.issues.some((i) => i.code === 'case.encode.dangling')).toBe(true)
  })
})

describe('round-trip encode → decode', () => {
  it('preserves code / kind / relType; imported precedes is RECOMMENDED (decision #1)', () => {
    const { package: pkg } = encodeCase({ framework, graph, lastChangeDateTime: T })
    const decoded = decodeCase(pkg)

    expect(decoded.graph.nodes).toHaveLength(2)
    expect(decoded.graph.nodes.every((n) => n.kind === 'OBJECTIVE')).toBe(true)
    expect(decoded.graph.nodes.map((n) => n.code).sort()).toEqual(['1Nc.01', '1Nc.02'])

    expect(decoded.graph.edges).toHaveLength(1)
    const edge = decoded.graph.edges[0]
    expect(edge?.relType).toBe('PREREQUISITE')
    expect(edge?.mode).toBe('RECOMMENDED')
  })
})
