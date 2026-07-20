// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest'
import {
  LEARNABLE_KINDS,
  ORDERING_RELS,
  isLearnable,
  isOrdering,
  interactionDesign,
  methodFor,
  observation,
  skillNode,
  wellbeingPolicy,
  type CompetencyKind,
  type RelType,
} from '../src/index.js'

/**
 * The invariants, as executable tests.
 *
 * Each asserts that a specific mistake is **caught at the boundary** rather than left to a
 * reviewer. A rule that lives only in a document erodes; a rule with a failing test does not.
 */

describe('a concept is framework-neutral', () => {
  const concept = {
    slug: 'math.number.addition.combine-within-20',
    title: { en: 'Add within 20', vi: 'Cộng trong phạm vi 20' },
    kind: 'KNOWLEDGE' as const,
    altitude: 'concept' as const,
  }

  it('refuses a stage on a concept', () => {
    // "Add within 20" is Cambridge Stage 2 *and* Vietnamese Grade 1. A concept that carried one
    // stage would be lying about the other, and every framework after the first would need its
    // own duplicate node — which splits a learner's evidence in half.
    const result = skillNode.safeParse({ ...concept, stage: 'Stage 2' })

    expect(result.success).toBe(false)
  })

  it('allows a stage on an objective, which is what a stage describes', () => {
    const result = skillNode.safeParse({
      slug: 'fw.cambridge-primary-maths-0845.1nc8',
      title: { en: 'Add within 20' },
      kind: 'OBJECTIVE',
      stage: 'Stage 2',
      code: '1Nc8',
    })

    expect(result.success).toBe(true)
  })

  it('accepts the concept itself with no stage', () => {
    expect(skillNode.safeParse(concept).success).toBe(true)
  })
})

describe('standards overlays are never offered as something to learn', () => {
  it('excludes OBJECTIVE and OUTCOME from learnable kinds', () => {
    // A standard's code is a way of naming a target, not a thing to practise. Offering one as
    // "learn next" sends a learner at a bureaucratic label instead of at a concept.
    expect(isLearnable('OBJECTIVE')).toBe(false)
    expect(isLearnable('OUTCOME')).toBe(false)
  })

  it('includes exactly knowledge, skills and dispositions', () => {
    expect([...LEARNABLE_KINDS]).toEqual(['KNOWLEDGE', 'SKILL', 'DISPOSITION'])
  })
})

describe('ordering and lateral relations stay apart', () => {
  it('treats only the three ordering types as ordering', () => {
    expect([...ORDERING_RELS]).toEqual(['PREREQUISITE', 'ENABLES', 'COMPOSES'])
  })

  it('never treats a lateral relation as learning order', () => {
    // If ALIGNS were traversed as ordering, an equivalence between two national standards
    // would become a prerequisite, and a learner would be blocked by a curriculum they are not
    // studying.
    for (const lateral of ['ALIGNS', 'VARIANT_OF', 'MAPS_TO'] satisfies RelType[]) {
      expect(isOrdering(lateral)).toBe(false)
    }
  })

  it('defaults an unlabelled edge to PREREQUISITE', () => {
    // Edge data written before relTypes existed means what it always meant.
    expect(isOrdering(undefined)).toBe(true)
  })
})

describe('dispositions are measured, by frequency rather than correctness', () => {
  // Ruled in ADR 0005, reversing what 0.1.0 shipped. Real curricula need it: Cambridge Primary
  // English has "Enjoy and engage with books" as an objective.
  it('routes dispositional kinds to Beta-Binomial', () => {
    for (const kind of ['DISPOSITION', 'BEHAVIOR', 'ATTITUDE'] satisfies CompetencyKind[]) {
      expect(methodFor(kind)).toBe('BETA_BINOMIAL')
    }
  })

  it('routes knowledge to BKT/Elo and skills to a rubric', () => {
    expect(methodFor('KNOWLEDGE')).toBe('BKT_ELO')
    expect(methodFor('SKILL')).toBe('RUBRIC')
  })

  it('accepts a disposition observation at the low confidence one sighting deserves', () => {
    const parsed = observation.parse({
      skillSlug: 'disp.reading.enjoys-books',
      outcome: 1,
      confidence: 0.2,
      source: 'OBSERVATION',
      actor: 'TEACHER',
      at: 1_784_000_000_000,
    })

    // One sighting is weak evidence of a habit, and the shape has to be able to say so.
    expect(parsed.confidence).toBe(0.2)
  })
})

describe('evidence lanes do not mix', () => {
  it('defaults an observation to the learner lane', () => {
    const parsed = observation.parse({
      skillSlug: 'math.number.addition.combine-within-10',
      outcome: 1,
      actor: 'SYSTEM',
      at: 1_784_000_000_000,
    })

    expect(parsed.subjectType).toBe('LEARNER')
  })

  it('can record a teacher or curriculum measurement without touching a learner', () => {
    // Measuring how well a lesson worked must never rewrite the record of who learned what.
    for (const subjectType of ['TEACHER', 'CURRICULUM'] as const) {
      const parsed = observation.parse({
        subjectType,
        skillSlug: 'math.number.addition.combine-within-10',
        outcome: 0.6,
        actor: 'ASSESSOR',
        at: 1_784_000_000_000,
      })
      expect(parsed.subjectType).toBe(subjectType)
    }
  })

  it('defaults to LEARN mode, where hints and remediation are allowed', () => {
    const parsed = observation.parse({
      skillSlug: 'math.number.addition.combine-within-10',
      outcome: 1,
      actor: 'SYSTEM',
      at: 1_784_000_000_000,
    })

    expect(parsed.mode).toBe('LEARN')
  })
})

describe('wellbeing guarantees survive the model change', () => {
  it('refuses to expose rank', () => {
    expect(wellbeingPolicy.safeParse({ exposeRank: true }).success).toBe(false)
  })

  it('defaults to the protective policy when nothing is specified', () => {
    // The default matters more than the validation: most callers pass `{}`.
    const parsed = wellbeingPolicy.parse({})

    expect(parsed.exposeRank).toBe(false)
    expect(parsed.exposeScores).toBe(false)
    expect(parsed.celebrate).toBe('progress')
  })

  it("keeps a child's privacy out of configuration", () => {
    expect(interactionDesign.safeParse({ parent: { childPrivacy: 'relaxed' } }).success).toBe(false)
    expect(interactionDesign.parse({ parent: {} }).parent?.childPrivacy).toBe('strict')
  })
})
