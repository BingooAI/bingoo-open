// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  CONTRACT_VERSION,
  alignmentProposal,
  domainProfile,
  frameworkVersion,
  gap,
  graphData,
  observation,
  requiresHuman,
  skillEdge,
  skillState,
  slug,
  suggestion,
} from '../src/index.js'

describe('slugs', () => {
  it('accepts the dotted grammar and a variant', () => {
    expect(slug.safeParse('math.number.addition.combine-within-10').success).toBe(true)
    expect(slug.safeParse('math.number.subtraction.regroup@borrow').success).toBe(true)
    expect(slug.safeParse('fw.cambridge-primary-maths-0845.1nc8').success).toBe(true)
    expect(slug.safeParse('disp.attention-to-detail').success).toBe(true)
  })

  it('rejects anything a human would have typed by hand', () => {
    // Slugs are minted, never authored. Uppercase, spaces and diacritics all indicate someone
    // typed a title into an identifier field.
    expect(slug.safeParse('Math.Number.Addition').success).toBe(false)
    expect(slug.safeParse('add within 20').success).toBe(false)
    expect(slug.safeParse('phép-cộng').success).toBe(false)
    expect(slug.safeParse('math..addition').success).toBe(false)
  })
})

describe('the graph', () => {
  it('parses a small real graph', () => {
    const parsed = graphData.parse({
      nodes: [
        {
          slug: 'math.number.counting.count-to-10',
          title: { en: 'Count to 10', vi: 'Đếm đến 10' },
          kind: 'KNOWLEDGE',
          altitude: 'concept',
          subject: 'math',
          facets: { object: 'counting', scope: { max: 10 } },
        },
        {
          slug: 'math.number.addition.combine-within-10',
          title: { en: 'Add within 10', vi: 'Cộng trong phạm vi 10' },
          kind: 'KNOWLEDGE',
          altitude: 'concept',
          subject: 'math',
          facets: { object: 'addition', scope: { max: 10 } },
        },
      ],
      edges: [
        {
          from: 'math.number.counting.count-to-10',
          to: 'math.number.addition.combine-within-10',
          relType: 'PREREQUISITE',
        },
      ],
    })

    expect(parsed.nodes[0]?.facets?.scope).toEqual({ max: 10 })
    expect(parsed.edges[0]?.mode).toBe('REQUIRED')
    expect(parsed.edges[0]?.weight).toBe(1)
  })

  it('defaults an edge to REQUIRED, the mode that gates', () => {
    // The safer default: an author who forgets to think about mode gets the conservative
    // reading, and loosening it later is a deliberate act.
    const parsed = skillEdge.parse({ from: 'a.b', to: 'a.c' })
    expect(parsed.mode).toBe('REQUIRED')
  })

  it('keeps taxonomy separate from prerequisites', () => {
    // `parent` groups for browsing. Nothing may traverse it as learning order.
    const parsed = graphData.parse({
      nodes: [
        {
          slug: 'math.number.addition.combine-within-10',
          title: { en: 'Add within 10' },
          kind: 'KNOWLEDGE',
          parent: 'math.number',
        },
      ],
    })

    expect(parsed.nodes[0]?.parent).toBe('math.number')
    expect(parsed.edges).toEqual([])
  })
})

describe('mastery is a vector, not a number', () => {
  it('carries the signals a Dreyfus band is derived from', () => {
    const parsed = skillState.parse({
      learnerId: 'an',
      skillSlug: 'math.number.addition.combine-within-10',
      pKnown: 0.86,
      ability: 1120,
      attempts: 24,
      correct: 20,
      fluency: 0.7,
      transfer: 0.55,
      independence: 0.9,
      level: 'competent',
      lastSeenMs: 1_784_000_000_000,
    })

    // A learner who answers correctly but slowly, only on familiar phrasings, and only with
    // hints is not in the same place as one who does it cold — and a scalar cannot say so.
    expect(parsed.fluency).toBe(0.7)
    expect(parsed.level).toBe('competent')
  })

  it('allows a state with no derived band yet', () => {
    // The band requires acquisition *and* the signals. Absent is the honest value before then.
    const parsed = skillState.parse({
      learnerId: 'an',
      skillSlug: 'math.number.addition.combine-within-10',
      pKnown: 0.31,
      ability: 1000,
    })

    expect(parsed.level).toBeUndefined()
    expect(parsed.lastSeenMs).toBeNull()
  })
})

describe('gaps distinguish blocked from merely advised', () => {
  it('separates REQUIRED blockers from RECOMMENDED suggestions', () => {
    const parsed = gap.parse({
      learnerId: 'an',
      skillSlug: 'math.number.addition.combine-within-20',
      current: 0.2,
      target: 0.8,
      size: 0.6,
      blockedBy: ['math.number.addition.combine-within-10'],
      suggestedFirst: ['math.number.counting.count-to-20'],
      computedAtMs: 1_784_000_000_000,
    })

    // A RECOMMENDED prerequisite must never appear in `blockedBy`, or a soft hint silently
    // becomes a wall.
    expect(parsed.blockedBy).toHaveLength(1)
    expect(parsed.suggestedFirst).toHaveLength(1)
  })
})

describe('framework releases', () => {
  it('parses a published release with structured semver', () => {
    const parsed = frameworkVersion.parse({
      frameworkSlug: 'cambridge-primary-maths-0845',
      version: { major: 1, minor: 0, patch: 0 },
      releaseType: 'MAJOR',
      status: 'PUBLISHED',
      publishedAt: '2026-07-20T09:00:00Z',
    })

    expect(parsed.version.major).toBe(1)
    expect(parsed.status).toBe('PUBLISHED')
  })

  it('defaults a new release to DRAFT', () => {
    // Nothing becomes authoritative by being created.
    const parsed = frameworkVersion.parse({
      frameworkSlug: 'gdpt-2018-math',
      version: { major: 1, minor: 0, patch: 0 },
    })

    expect(parsed.status).toBe('DRAFT')
  })
})

describe('concept identity', () => {
  it('defaults identity axes to what a concept is about and how far it goes', () => {
    const parsed = domainProfile.parse({ domain: 'math' })

    // Not `representation`: the same addition met on a number line and in an array is one
    // concept taught two ways, and splitting it would halve the evidence behind it.
    expect(parsed.identityAxes).toEqual(['object', 'scope'])
  })

  it('sends the three ambiguous verdicts to a person', () => {
    expect(requiresHuman('SAME')).toBe(true)
    expect(requiresHuman('OVERLAP')).toBe(true)
    // "The machine cannot tell" is an answer. Treating it as NEW manufactures duplicates.
    expect(requiresHuman('UNKNOWN')).toBe(true)
    expect(requiresHuman('SUBSET')).toBe(false)
    expect(requiresHuman('NEW')).toBe(false)
  })

  it('carries the discriminator that makes a verdict reviewable', () => {
    const parsed = alignmentProposal.parse({
      verdict: 'SUBSET',
      discriminator: 'A learner who can add within 10 may still fail 47 + 38.',
      similarity: 0.94,
      rationale: 'Same object (addition); scope max 10 versus 100.',
    })

    // A similarity score alone cannot settle it: 0.94 describes both a duplicate and the three
    // meanings of subtraction, which a child can master one of and fail another.
    expect(parsed.discriminator).toBeDefined()
  })
})

describe('observations', () => {
  it('accepts partial credit on the same scale as a binary answer', () => {
    const parsed = observation.parse({
      skillSlug: 'math.number.addition.combine-within-10',
      outcome: 0.75,
      source: 'RUBRIC',
      actor: 'TEACHER',
      attemptId: 'sub-1',
      at: 1_784_000_000_000,
    })

    expect(parsed.outcome).toBe(0.75)
    // The idempotency key: the same flush arriving twice must fold once.
    expect(parsed.attemptId).toBe('sub-1')
  })

  it('rejects an outcome outside [0,1]', () => {
    const result = observation.safeParse({
      skillSlug: 'a.b',
      outcome: 75,
      actor: 'SYSTEM',
      at: 1,
    })

    // A percentage passed where a proportion belongs is the classic silent corruption.
    expect(result.success).toBe(false)
  })
})

describe('suggestions', () => {
  it('starts a machine proposal unaccepted', () => {
    const schema = suggestion(z.object({ slug: z.string() }))
    const parsed = schema.parse({
      value: { slug: 'math.number.addition.combine-within-10' },
      confidence: 0.82,
      evidence: { rationale: 'Matches SGK Toán 1, chapter 3.' },
    })

    expect(parsed.status).toBe('proposed')
  })
})

describe('contract version', () => {
  it('is 2 — the model changed', () => {
    expect(CONTRACT_VERSION).toBe(2)
  })
})
