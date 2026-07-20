// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'

/**
 * Facets — the axes that decide whether two concepts are the same thing.
 *
 * ## The problem this solves
 *
 * Two authors, working from two curricula, both write a concept called "phép cộng". Are those
 * one node or two? Get it wrong in one direction and a learner's evidence splits across
 * duplicates, so neither ever reaches threshold. Get it wrong in the other and two genuinely
 * different skills are merged, so a learner is credited with something they cannot do.
 *
 * String similarity cannot answer it. "Add within 10" and "Add within 100" are nearly identical
 * as text and are different concepts; "phép cộng có nhớ" and "column addition with regrouping"
 * share almost no characters and are the same one.
 *
 * So identity is decided by **structured data**: what the concept is about, at what scope, in
 * what representation. Comparing those is mechanical where the facets differ, and where they
 * are identical the honest answer is *"the machine cannot tell"* — which routes to a person
 * rather than to a guess.
 *
 * ## Three axes are closed, three are open — deliberately
 *
 * `bloom`, `transfer` and `fluency` are small fixed enums: they are the pedagogical spine and
 * do not vary by subject. `object`, `channel`, `representation` and the keys of `scope` are free
 * strings, because their vocabulary *is* the subject — "parity" and "arc welding" and "past
 * simple" cannot live in one enum without that enum becoming a subject registry.
 *
 * The consequence is the design goal: **adding a subject is adding a `DomainProfile` row, never
 * editing this file.**
 */

/** Cognitive demand. Bloom's revised taxonomy, in the usual order. */
export const bloom = z.enum(['recall', 'understand', 'apply', 'analyse', 'evaluate', 'create'])
export type Bloom = z.infer<typeof bloom>

/** How far the situation is from the one it was taught in. */
export const transfer = z.enum(['familiar', 'near', 'far'])
export type Transfer = z.infer<typeof transfer>

/** How automatic the performance is — the axis Dreyfus banding leans on. */
export const fluency = z.enum(['emerging', 'accurate', 'fluent', 'automatic'])
export type Fluency = z.infer<typeof fluency>

/**
 * The six axes.
 *
 * Every field is optional because a draft is incomplete by nature, and refusing to hold a
 * half-described concept would push authors to invent values to get past validation. Which
 * axes a given subject *requires* is a `DomainProfile` decision, checked at review time.
 */
export const facets = z.object({
  /**
   * What the concept is *about* — the single most identifying axis.
   *
   * `addition`, `parity`, `past-simple`, `arc-welding`. Free-form because this is where the
   * subject's own vocabulary lives.
   */
  object: z.string().min(1).max(128).optional(),

  /** How it is exercised: `read`, `write`, `listen`, `speak`, `manipulate`. Free-form. */
  channel: z.string().min(1).max(64).optional(),

  bloom: bloom.optional(),

  /**
   * The bound that narrows it: `{ max: 100 }`, `{ lexis: 2000 }`, `{ tempoBpm: 120 }`.
   *
   * The second identity axis, and the one that most often separates two concepts sharing an
   * `object`. "Add within 10" and "add within 100" differ here and nowhere else.
   *
   * **Comparison is not naive.** For an upper bound a larger number is wider; for a lower bound
   * a larger number is *narrower* — `[5,100]` does not contain `[0,20]` even though 100 > 20.
   * Any code comparing scopes has to know which kind of bound each key is.
   */
  scope: z.record(z.string().min(1).max(64), z.union([z.string().max(128), z.number()])).optional(),

  /** The form it is met in: `number-line`, `array`, `bar-model`, `symbolic`. Free-form. */
  representation: z.string().min(1).max(64).optional(),

  transfer: transfer.optional(),
  fluency: fluency.optional(),
})
export type Facets = z.infer<typeof facets>

export const FACET_AXES = [
  'object',
  'channel',
  'bloom',
  'scope',
  'representation',
  'transfer',
  'fluency',
] as const
export const facetAxis = z.enum(FACET_AXES)
export type FacetAxis = z.infer<typeof facetAxis>

/**
 * What a subject requires, and which axes are allowed to decide identity.
 *
 * `identityAxes` is the load-bearing field and is deliberately **narrower** than `requiredAxes`.
 * Requiring `representation` on every maths concept is reasonable authoring hygiene; letting a
 * difference in `representation` alone declare two nodes distinct is not — the same addition
 * met on a number line and in an array is one concept taught two ways, and splitting it would
 * halve the evidence behind it.
 *
 * Default identity axes are `object` and `scope`: what it is about, and how far it goes.
 */
export const domainProfile = z.object({
  /** A key from the controlled domain registry: `math`, `lang.en`, `sci`, `disp`. */
  domain: z.string().min(1).max(64),
  /** Axes an author must fill before a concept in this domain can be published. */
  requiredAxes: z.array(facetAxis).default([]),
  /** Axes a machine may use to conclude "these are different concepts". */
  identityAxes: z.array(facetAxis).default(['object', 'scope']),
  /** Per-axis synonym folding, e.g. `{ object: { "plus": "addition" } }`. */
  aliases: z.record(z.string(), z.record(z.string(), z.string())).optional(),
})
export type DomainProfile = z.infer<typeof domainProfile>

/**
 * The verdict when two concepts are compared.
 *
 * `SAME`, `OVERLAP` and `UNKNOWN` **require a person**. The first two because merging or
 * relating nodes changes what a learner is credited with; the last because "the machine cannot
 * tell" is an answer, and treating it as `NEW` silently manufactures duplicates.
 *
 * `SUBSET`/`SUPERSET` can be derived mechanically from `scope` when the bound direction is
 * known, and become a `PREREQUISITE` edge from the narrower to the wider.
 */
export const alignVerdict = z.enum(['SAME', 'SUBSET', 'SUPERSET', 'OVERLAP', 'NEW', 'UNKNOWN'])
export type AlignVerdict = z.infer<typeof alignVerdict>

/** Verdicts a machine may not act on alone. */
export const HUMAN_REQUIRED_VERDICTS = ['SAME', 'OVERLAP', 'UNKNOWN'] as const

export function requiresHuman(verdict: AlignVerdict): boolean {
  return (HUMAN_REQUIRED_VERDICTS as readonly string[]).includes(verdict)
}

/**
 * A comparison, with the one thing that makes it reviewable.
 *
 * `discriminator` is the test: **is there a task a learner could get right on one and wrong on
 * the other?** If nobody can state one, the honest verdict is `SAME`. A similarity score is not
 * a substitute — two concepts scoring 0.94 may be a duplicate or may be the three meanings of
 * subtraction (take-away, difference, count-back), which a child can genuinely master one of
 * and fail another.
 */
export const alignmentProposal = z.object({
  verdict: alignVerdict,
  /** Present for anything other than `SAME`. Absent means the verdict needs re-examining. */
  discriminator: z.string().max(2000).optional(),
  /** Retrieval similarity, if one was computed. Never the basis of the verdict on its own. */
  similarity: z.number().min(0).max(1).optional(),
  rationale: z.string().min(1).max(4000),
})
export type AlignmentProposal = z.infer<typeof alignmentProposal>
