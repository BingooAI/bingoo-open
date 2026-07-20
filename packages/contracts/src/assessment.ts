// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'
import { dreyfusLevel } from './competency.js'
import { itemRef, slug, learnerId, semver, timestamp, unitInterval, uri } from './refs.js'

/**
 * Summative assessment: blueprints, sittings, grades and credentials.
 *
 * Assessment Studio's territory. Distinct from the continuous, formative measurement the
 * Competency Engine performs — that produces a belief, this produces a *record*. The
 * difference matters procedurally: a belief can be revised silently as more evidence
 * arrives; a grade goes on a report and a credential travels to another institution.
 *
 * Because the outputs are consequential, two guarantees are structural here rather than
 * procedural: a model's marking never becomes a grade unaided, and a credential cannot be
 * minted without the threshold it claims.
 */

/**
 * One cell of a test blueprint: this competency, at this level, this many questions.
 *
 * A blueprint built from cells rather than a flat item list is what makes a test *about*
 * something. It also survives the item bank changing — the blueprint is the intent, the
 * assembled forms are one realisation of it, and next term's assembly from the same
 * blueprint is comparable.
 */
export const blueprintCell = z.object({
  skillSlug: slug,
  ksd: z.enum(['K', 'S']).optional(),
  level: dreyfusLevel,
  count: z.number().int().min(1).max(200),
  /** Share of `totalScore` this cell carries. */
  weight: z.number().min(0).max(1),
})
export type BlueprintCell = z.infer<typeof blueprintCell>

/**
 * The specification a test is assembled from — Vietnam's *ma trận đề*, and the same idea
 * everywhere else.
 *
 * Note `ksd` here admits only `K` and `S`. A summative test cannot examine dispositions,
 * for the same reason mastery cannot score them (A7 §1): there is no honest way to mark
 * a child's diligence out of ten.
 */
export const testBlueprint = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(500),
  frameworkUri: uri,
  frameworkVersion: semver.optional(),
  cells: z.array(blueprintCell).min(1),
  totalScore: z.number().min(0),
  durationMin: z.number().int().min(1).max(600),
})
export type TestBlueprint = z.infer<typeof testBlueprint>

/**
 * An assembled test: one blueprint, one or more equivalent forms.
 *
 * `noHints` is `true` and cannot be otherwise. Scaffolding is right in every other part of
 * this system and wrong here — a hinted answer under exam conditions is not evidence of what
 * the learner can do alone, which is the only thing a summative test claims to measure.
 *
 * Multiple `forms` exist for invigilation, not variety: neighbours get different papers.
 * They are assembled from the same blueprint, so scores remain comparable.
 */
export const assessmentTest = z.object({
  id: z.string().min(1).max(128),
  blueprint: testBlueprint,
  forms: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        items: z.array(itemRef).min(1),
      }),
    )
    .min(1),
  config: z.object({
    shuffleItems: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    /** Not a setting. See above. */
    noHints: z.literal(true).default(true),
    /** Lockdown / restricted-browser mode, where the deployment supports it. */
    secure: z.boolean().default(false),
    attempts: z.number().int().min(1).max(10).default(1),
  }),
  /** QTI `assessmentTest` payload, produced and parsed by `@bingoo.ai/codecs/qti`. */
  qti: z.string().optional(),
})
export type AssessmentTest = z.infer<typeof assessmentTest>

/**
 * Who or what marked an answer.
 *
 * `llm` is a legitimate value — machine marking of extended responses is genuinely useful,
 * and pretending otherwise would just push it outside the record where nobody can audit it.
 * What is not legitimate is `llm` reaching a report card unreviewed; see `grade`.
 */
export const gradedBy = z.enum(['auto', 'llm', 'human'])
export type GradedBy = z.infer<typeof gradedBy>

/**
 * A result: total, and the per-competency breakdown that makes it teachable.
 *
 * The `refine` enforces the marking invariant (§D8): a `final` grade marked by a model must
 * carry a human approver. A provisional LLM grade is fine and useful — it is most of the
 * work — but the person whose name is on the report is a person.
 *
 * `perCompetency` is what feeds back into the Competency Engine. A single number tells a
 * learner they got 62%; the breakdown tells them which two skills to work on, which is the
 * only part they can act on.
 */
export const grade = z
  .object({
    learnerId,
    testId: z.string().min(1).max(128),
    formId: z.string().max(128).optional(),
    score: z.number(),
    maxScore: z.number().min(0),
    perCompetency: z
      .array(
        z.object({
          skillSlug: slug,
          score: z.number(),
          maxScore: z.number().min(0),
        }),
      )
      .default([]),
    gradedBy,
    /** Required when `gradedBy` is `llm` and `status` is `final`. */
    approvedBy: z.string().max(256).optional(),
    status: z.enum(['provisional', 'final']).default('provisional'),
    gradedAt: timestamp,
  })
  .refine((g) => !(g.status === 'final' && g.gradedBy === 'llm' && !g.approvedBy), {
    message: 'a model-marked grade needs a human approver before it is final (§D8)',
    path: ['approvedBy'],
  })
export type Grade = z.infer<typeof grade>

/**
 * A portable claim that a learner has attained something — W3C VC or Open Badge.
 *
 * This is the artefact that makes §C9's curriculum switch work: it is signed, it names
 * competency URIs rather than a course title, and it is readable by any institution that
 * speaks the standard. A credential naming "Bingoo Level 3" would be worthless the moment
 * the learner left; one naming a CASE URI is not.
 *
 * `evidence` is required. A credential without a trail of what was actually done is an
 * assertion with a signature on it — which is worse than no credential, because it looks
 * like proof.
 */
export const credential = z.object({
  id: uri,
  learnerId,
  /** What is claimed, as framework URIs. */
  competencies: z.array(slug).min(1),
  frameworkUri: uri,
  frameworkVersion: semver.optional(),
  level: dreyfusLevel.optional(),
  /** The attainment level reached, where the credential reports one. */
  attainment: unitInterval.optional(),
  issuedAs: z.enum(['W3C-VC', 'OpenBadge']),
  issuer: z.string().min(1).max(500),
  issuedAt: timestamp,
  expiresAt: timestamp.optional(),
  /** What was actually done to earn it: test ids, grade ids, evidence references. */
  evidence: z.array(z.string().max(2048)).min(1),
  /** Detached proof. Verified by `@bingoo.ai/codecs/credentials`, never by a consumer by hand. */
  signature: z.string().max(8192).optional(),
})
export type Credential = z.infer<typeof credential>
