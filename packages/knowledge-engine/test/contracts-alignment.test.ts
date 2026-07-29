// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest'
import * as contracts from '@bingoo.ai/contracts'
import {
  EVIDENCE_ACTORS,
  LEARNABLE_KINDS,
  ORDERING_RELS,
  isFrequencyMeasured,
  isOrdering,
} from '../src/domain'

/**
 * This package re-exports its enums and identity primitives from `@bingoo.ai/contracts`, so
 * those cannot drift — the compiler resolves one definition.
 *
 * Three runtime constants are still duplicated, deliberately. Re-exporting a *value* would make
 * `contracts` a runtime dependency and pull zod in behind it, and this engine's whole point is
 * that it runs anywhere with nothing installed. Types are erased at compile time; values are not.
 *
 * The duplication is therefore a considered trade rather than an oversight, and this is the
 * check that keeps it honest.
 */
describe('duplicated constants still match contracts', () => {
  it('LEARNABLE_KINDS', () => {
    expect([...LEARNABLE_KINDS]).toEqual([...contracts.LEARNABLE_KINDS])
  })

  it('ORDERING_RELS', () => {
    expect([...ORDERING_RELS]).toEqual([...contracts.ORDERING_RELS])
  })

  /**
   * `FREQUENCY_KINDS` is this package's short answer to a question `contracts` answers the long
   * way, through `methodFor`. Drift here is not cosmetic: the two places that consult it decide
   * whether a child's habit gets pushed into a review queue for "forgetting", and whether a thin
   * observation count is rendered to a teacher as a score. Both are correctness, not tuning.
   */
  it('FREQUENCY_KINDS is exactly what methodFor calls BETA_BINOMIAL', () => {
    const all = [
      'OBJECTIVE',
      'OUTCOME',
      'SKILL',
      'KNOWLEDGE',
      'PROCEDURE',
      'BEHAVIOR',
      'ATTITUDE',
      'DISPOSITION',
    ] as const
    // Guards the list above against a kind being added to contracts and forgotten here.
    expect([...all].sort()).toEqual([...contracts.competencyKind.options].sort())
    for (const kind of all) {
      expect(isFrequencyMeasured(kind), `kind=${kind}`).toBe(contracts.methodFor(kind) === 'BETA_BINOMIAL')
    }
  })

  it('isOrdering agrees on every relation type, including the undefined default', () => {
    const all = ['PREREQUISITE', 'ENABLES', 'COMPOSES', 'ALIGNS', 'VARIANT_OF', 'MAPS_TO', undefined] as const
    for (const rel of all) {
      expect(isOrdering(rel), `rel=${rel ?? 'undefined'}`).toBe(contracts.isOrdering(rel))
    }
  })
})

describe('what this package still owns', () => {
  /**
   * `EVIDENCE_ACTORS` has no counterpart in contracts. It is the write-permission matrix's
   * vocabulary — who may record which kind of evidence — and until contracts models that
   * matrix, duplicating it there would be copying a list without its meaning.
   */
  it('EVIDENCE_ACTORS is local, and contracts does not define a rival', () => {
    expect(EVIDENCE_ACTORS.length).toBeGreaterThan(0)
    expect(contracts).not.toHaveProperty('EVIDENCE_ACTORS')
  })
})
