// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Regression guard: the `/apply` request schema MUST keep the fields that carry a KC's identity.
 *
 * The bug this catches: `GraphBody.nodes` once declared only slug/title/kind/parent/level, and Zod
 * strips unknown keys, so `facets`/`stage`/`strand`/`subject` sent by the client were silently
 * dropped before `persistGraph` (which writes them) and `checkInvariants` (I1/I2/I8, which read
 * them) ever saw them. The graph was written without the very fields its invariants guard, with no
 * error raised. These tests fail if a node's identity fields stop surviving a parse.
 */
import { describe, expect, it } from 'vitest'
import { GraphBody } from '../src/routes/authoring.schema'

describe('GraphBody — identity fields survive parsing', () => {
  it('keeps facets/subject/strand on a concept node', () => {
    const parsed = GraphBody.parse({
      nodes: [
        {
          slug: 'add-within-20',
          title: { en: 'Add within 20', vi: 'Cộng trong phạm vi 20' },
          kind: 'SKILL',
          subject: 'math',
          strand: 'Number',
          facets: { object: 'addition', scope: { max: 20 }, bloom: 'apply' },
        },
      ],
      edges: [],
    })
    const node = parsed.nodes[0]!
    expect(node.subject).toBe('math')
    expect(node.strand).toBe('Number')
    // facets is what distinguishes "add within 20" from "add within 100" — it must survive.
    expect(node.facets).toEqual({ object: 'addition', scope: { max: 20 }, bloom: 'apply' })
  })

  it('keeps stage on an OBJECTIVE node (curriculum scoping)', () => {
    const parsed = GraphBody.parse({
      nodes: [
        {
          slug: '1nc-02',
          title: { en: 'Recognise numbers to 10', vi: 'Nhận biết số đến 10' },
          kind: 'OBJECTIVE',
          stage: '1',
        },
      ],
      edges: [],
    })
    expect(parsed.nodes[0]!.stage).toBe('1')
  })

  it('still accepts a minimal node with none of the identity fields', () => {
    const parsed = GraphBody.parse({
      nodes: [{ slug: 'k', title: { en: 'K' }, kind: 'KNOWLEDGE' }],
      edges: [],
    })
    const node = parsed.nodes[0]!
    expect(node.facets).toBeUndefined()
    expect(node.stage).toBeUndefined()
  })

  it('two concepts differing only by facet scope both survive (not collapsible on title alone)', () => {
    const parsed = GraphBody.parse({
      nodes: [
        {
          slug: 'add-within-20',
          title: { en: 'Add within 20' },
          kind: 'SKILL',
          facets: { object: 'addition', scope: { max: 20 } },
        },
        {
          slug: 'add-within-100',
          title: { en: 'Add within 100' },
          kind: 'SKILL',
          facets: { object: 'addition', scope: { max: 100 } },
        },
      ],
      edges: [],
    })
    expect(parsed.nodes[0]!.facets).toEqual({ object: 'addition', scope: { max: 20 } })
    expect(parsed.nodes[1]!.facets).toEqual({ object: 'addition', scope: { max: 100 } })
  })
})
