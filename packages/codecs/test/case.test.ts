// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest'
import { decodeCase, slugifyPath, slugifySegment } from '../src/case/index.js'

/**
 * Decoding CASE into a capability graph.
 *
 * The shapes here come from the real Common Core State Standards for Math package published by
 * CCSSO (746 items, via OpenSALT), not from anything hand-invented. That distinction has already
 * earned itself once: the first version of this decoder reported the framework's five top-level
 * categories as dangling references, and no hand-written fixture caught it, because they were
 * written to fit the decoder.
 */

const realShape = {
  CFDocument: {
    identifier: 'c6496676-d7cb-11e8-824f-0242ac160002',
    uri: 'https://example.org/ccss/math',
    title: 'Common Core State Standards for Math',
    creator: 'CCSSO',
    language: 'en',
    adoptionStatus: 'Draft',
  },
  CFItems: [
    {
      identifier: 'item-oa',
      humanCodingScheme: '1.OA',
      fullStatement: 'Operations and Algebraic Thinking',
      CFItemType: 'Domain',
      educationLevel: ['01'],
    },
    {
      identifier: 'item-oa-a-1',
      humanCodingScheme: '1.OA.A.1',
      fullStatement: 'Use addition and subtraction within 20 to solve word problems.',
      CFItemType: 'Standard',
      educationLevel: ['01'],
    },
  ],
  CFAssociations: [
    {
      identifier: 'a-root',
      associationType: 'isChildOf',
      originNodeURI: { identifier: 'item-oa' },
      // Points at the CFDocument — how CASE marks a root item.
      destinationNodeURI: { identifier: 'c6496676-d7cb-11e8-824f-0242ac160002' },
    },
    {
      identifier: 'a-child',
      associationType: 'isChildOf',
      originNodeURI: { identifier: 'item-oa-a-1' },
      destinationNodeURI: { identifier: 'item-oa' },
    },
    {
      identifier: 'a-exemplar',
      associationType: 'exemplar',
      originNodeURI: { identifier: 'item-oa-a-1' },
      destinationNodeURI: { identifier: 'item-oa' },
    },
  ],
}

describe('a published framework becomes an objective overlay', () => {
  const { graph } = decodeCase(realShape)

  it('makes every item an OBJECTIVE, whatever the publisher called it', () => {
    // "Domain", "Cluster", "Standard" say where an item sits in *their* document, not what a
    // learner does with it. Reading CFItemType as our `kind` would let a publisher's editorial
    // vocabulary decide which instrument measures a child.
    expect(graph.nodes).toHaveLength(2)
    for (const node of graph.nodes) expect(node.kind).toBe('OBJECTIVE')
  })

  it('namespaces objectives away from the shared concept space', () => {
    // An objective is one country's phrasing of an aim. Concepts are shared across all of them,
    // so the two must not collide in one namespace.
    for (const node of graph.nodes) expect(node.slug.startsWith('fw.')).toBe(true)
  })

  it('keeps the standard code, which is what a certificate prints', () => {
    const standard = graph.nodes.find((n) => n.code === '1.OA.A.1')

    expect(standard).toBeDefined()
    expect(standard?.slug).toContain('1-oa-a-1')
  })

  it('allows stage on an objective, which is the one kind that may carry it', () => {
    // A concept could not: "add within 20" is Cambridge Stage 2 and Vietnamese Grade 1 at once.
    expect(graph.nodes[0]?.stage).toBe('01')
  })

  it('mints no concepts', () => {
    // Splitting an objective into the atoms it certifies needs judgement and a human. Doing it
    // mechanically yields one concept per objective — the flat, unteachable graph that importing
    // a national framework is supposed to avoid.
    expect(graph.nodes.every((n) => n.kind === 'OBJECTIVE')).toBe(true)
  })
})

describe('hierarchy is composition, never learning order', () => {
  const { graph } = decodeCase(realShape)

  it('maps isChildOf to COMPOSES', () => {
    // Mapping it to PREREQUISITE would assert that a learner must master the whole domain before
    // its first standard — an ordering nobody authored, gating every learner behind everything.
    const edge = graph.edges.find((e) => e.from.includes('1-oa-a-1'))

    expect(edge?.relType).toBe('COMPOSES')
    expect(edge?.mode).toBe('RECOMMENDED')
  })

  it('produces no prerequisites from a framework that declares none', () => {
    // Common Core has 746 associations and not one `precedes`. Inventing order from hierarchy
    // would be the single most damaging thing this importer could do.
    expect(graph.edges.filter((e) => e.relType === 'PREREQUISITE')).toHaveLength(0)
  })
})

describe('what the decoder reports', () => {
  const { report } = decodeCase(realShape)

  it('does not call a root item a dangling reference', () => {
    expect(report.issues.map((i) => i.code)).not.toContain('case.association.dangling')
  })

  it('reports an unmapped association type once, not once per edge', () => {
    const unmapped = report.issues.filter((i) => i.code === 'case.association.unmapped')

    expect(unmapped).toHaveLength(1)
    expect(unmapped[0]?.message).toContain('exemplar')
  })

  it('counts what it read, including the absent prerequisites', () => {
    expect(report.metrics['objectives']).toBe(2)
    // The number a curriculum expert needs to see before teaching from an imported framework.
    expect(report.metrics['prerequisites']).toBe(0)
  })

  it('warns when it had to assume a language', () => {
    const { report: r } = decodeCase({
      CFDocument: { identifier: 'd', title: 'A framework' },
      CFItems: [],
    })

    expect(r.issues.map((i) => i.code)).toContain('case.language.missing')
  })
})

describe('slugs are minted, never typed', () => {
  it('strips Vietnamese diacritics rather than leaving them in a key', () => {
    // Two systems disagreeing about whether `phép` equals `phép` is a class of bug nobody
    // should have to debug.
    expect(slugifySegment('Phép cộng có nhớ')).toBe('phep-cong-co-nho')
    expect(slugifySegment('Đếm đến 10')).toBe('dem-den-10')
  })

  it('keeps the structure a code already has', () => {
    expect(slugifyPath('CCSS.MATH.CONTENT.1.OA.A.1')).toBe('ccss.math.content.1.oa.a.1')
  })

  it('never returns an empty segment', () => {
    expect(slugifySegment('!!!')).toBe('node')
    expect(slugifyPath('')).toBe('node')
  })

  it('cuts at a word boundary, because a slug is permanent', () => {
    const long = slugifySegment('a very long objective statement about multiplication and division facts')

    expect(long.length).toBeLessThanOrEqual(56)
    expect(long.endsWith('-')).toBe(false)
  })
})

describe('malformed input', () => {
  it('rejects a package with no CFDocument', () => {
    expect(() => decodeCase({ CFItems: [] })).toThrow(/Not a readable CASE package/)
  })

  it('rejects an item with no fullStatement — there would be nothing to display', () => {
    expect(() =>
      decodeCase({ CFDocument: { identifier: 'd', title: 'T' }, CFItems: [{ identifier: 'i' }] }),
    ).toThrow()
  })
})
