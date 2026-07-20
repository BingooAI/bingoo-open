// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'
import type { competencyKind } from './competency.js'
import { dreyfusLevel } from './competency.js'
import { elo, id, millis, semverParts, slug, unitInterval } from './refs.js'

/**
 * Evidence, and what is derived from it.
 *
 * ## Three tiers, and only the first is the truth
 *
 * ```
 * Observation    append-only, immutable          ← THE SOURCE OF TRUTH
 *      │ fold
 * SkillState     materialised "where am I now"   ← rebuildable by replay
 *      │ sample
 * SkillSnapshot  time series, for learning curves
 * ```
 *
 * `SkillState` is a cache. Delete it and it can be rebuilt from the observation log; that is the
 * property that makes a disputed estimate re-derivable a year later, and it is why nothing may
 * write a `SkillState` that no observation supports.
 *
 * ## Evidence lands only on concepts
 *
 * A fold targets an atomic concept and nothing else. Objective and competency mastery are
 * **computed** from concept mastery on demand. Storing a number at any higher altitude creates
 * a second place for the truth to live, and the two will disagree.
 */

/** Where the evidence came from. */
export const evidenceSource = z.enum(['QUIZ', 'PROJECT', 'RUBRIC', 'PEER', 'OBSERVATION', 'TIME'])
export type EvidenceSource = z.infer<typeof evidenceSource>

/**
 * Who recorded it.
 *
 * Kept because calibration differs sharply by role — a teacher's rubric and a peer's rating are
 * not equally strong evidence, and averaging them as though they were is how a class's
 * measurements quietly become noise.
 */
export const evidenceActor = z.enum(['LEARNER_SELF', 'TEACHER', 'SUPPORTER', 'PEER', 'ASSESSOR', 'SYSTEM'])
export type EvidenceActor = z.infer<typeof evidenceActor>

/**
 * Which lane an observation belongs to.
 *
 * **Only `LEARNER` folds into a learner's state.** `TEACHER` and `CURRICULUM` are separate
 * measurement lanes — used to evaluate teaching or a curriculum — and must never touch a
 * child's mastery. Without the distinction, measuring how well a lesson worked would silently
 * rewrite the record of who learned what.
 */
export const observationSubject = z.enum(['LEARNER', 'TEACHER', 'CURRICULUM'])
export type ObservationSubject = z.infer<typeof observationSubject>

/**
 * Teaching or measuring — the two change engine behaviour, not just presentation.
 *
 * `LEARN` allows hints, remediation and evidence spilling across multiple tagged concepts.
 * `MEASURE` locks: no hints, no spill. A certificate earned under `LEARN` conditions would
 * certify something other than what it claims.
 */
export const assessmentMode = z.enum(['LEARN', 'MEASURE'])
export type AssessmentMode = z.infer<typeof assessmentMode>

/**
 * One piece of evidence. **Append-only and immutable.**
 *
 * `outcome` is `[0,1]` rather than a boolean so partial credit, rubric levels and Beta-Binomial
 * frequency all use one shape. A binary answer is simply `0` or `1`.
 *
 * `attemptId` is the idempotency key. The same submission arriving twice — a retried request, a
 * phone flushing an offline session it already flushed — must fold once.
 */
export const observation = z.object({
  id: id.optional(),
  /** Which lane. Defaults to the only one that folds into learner mastery. */
  subjectType: observationSubject.default('LEARNER'),
  /** The learner, teacher or curriculum being measured. */
  subjectId: z.string().max(128).optional(),
  /** The atomic concept this is evidence about. Never an objective or a competency. */
  skillSlug: slug,
  outcome: unitInterval,
  /**
   * How much this observation is worth. A graded multiple-choice answer is near 1; a single
   * behavioural sighting for a disposition is near 0.2, because one sighting is weak evidence
   * of a habit.
   */
  confidence: unitInterval.default(1),
  source: evidenceSource.default('QUIZ'),
  actor: evidenceActor,
  mode: assessmentMode.default('LEARN'),
  /** Item difficulty on the Elo scale, when the item is calibrated. */
  difficulty: elo.optional(),
  itemKey: z.string().max(256).optional(),
  latencyMs: z.number().int().min(0).optional(),
  hintsUsed: z.number().int().min(0).optional(),
  retries: z.number().int().min(0).optional(),
  /** Set when the observation was made under invigilation — a precondition for `MEASURE`. */
  proctored: z.boolean().optional(),
  /** Which framework release the attempt was framed by. Provenance; does not affect the fold. */
  frameworkVersion: semverParts.optional(),
  /** Which teaching unit produced it. Provenance — the fold still targets `skillSlug`. */
  knowledgePointId: id.optional(),
  /** Idempotency key. */
  attemptId: z.string().max(128).optional(),
  lang: z.string().max(35).optional(),
  at: millis,
})
export type Observation = z.infer<typeof observation>

/**
 * What is currently believed about one learner and one concept.
 *
 * **Mastery is a vector, not a number.** `pKnown` is a probability of knowing; `ability` is
 * position on the difficulty scale; the three signals below feed the Dreyfus band. A learner
 * who answers everything correctly but slowly, only on familiar phrasings, and only with hints,
 * is not in the same place as one who does it cold — and a single scalar cannot tell them apart.
 *
 * **`pKnown` is not `level`.** The first is acquisition; the second is a derived band that
 * requires acquisition *and* the signals. Reporting one as the other is the most common way
 * this model gets misread.
 */
export const skillState = z.object({
  learnerId: z.string().min(1).max(128),
  skillSlug: slug,
  /** BKT posterior. Starts at the prior, moves with every fold. */
  pKnown: unitInterval,
  /** Elo, on the same scale as item difficulty. */
  ability: elo,
  attempts: z.number().int().min(0).default(0),
  correct: z.number().int().min(0).default(0),
  /** Automaticity, derived from latency. */
  fluency: unitInterval.optional(),
  /** Success on harder or unfamiliar items. */
  transfer: unitInterval.optional(),
  /** Inverse of hint reliance. */
  independence: unitInterval.optional(),
  /** Derived band. Absent until acquisition is reached — never stored on the node. */
  level: dreyfusLevel.optional(),
  /** Which node version this state was last folded against. */
  nodeVersion: z.number().int().min(1).optional(),
  lastSeenMs: millis.nullable().default(null),
  updatedAtMs: millis.optional(),
})
export type SkillState = z.infer<typeof skillState>

/** A sample, for drawing a learning curve without replaying the whole log. */
export const skillSnapshot = z.object({
  learnerId: z.string().min(1).max(128),
  skillSlug: slug,
  pKnown: unitInterval,
  ability: elo,
  level: dreyfusLevel.optional(),
  atMs: millis,
})
export type SkillSnapshot = z.infer<typeof skillSnapshot>

/** Community difficulty statistics for one item, as calibration accumulates. */
export const itemStat = z.object({
  itemKey: z.string().min(1).max(256),
  difficulty: elo,
  attempts: z.number().int().min(0).default(0),
  correct: z.number().int().min(0).default(0),
})
export type ItemStat = z.infer<typeof itemStat>

/**
 * A gap — a concept below threshold, and whether it can be started.
 *
 * `blockedBy` lists only **unmet `REQUIRED`** prerequisites. A `RECOMMENDED` one never blocks,
 * so it appears in `suggestedFirst` instead: a hint, not a wall.
 */
export const gap = z.object({
  learnerId: z.string().min(1).max(128),
  skillSlug: slug,
  current: unitInterval,
  target: unitInterval,
  /** `target - current`, precomputed because every consumer sorts by it. */
  size: unitInterval,
  blockedBy: z.array(slug).default([]),
  suggestedFirst: z.array(slug).default([]),
  computedAtMs: millis,
})
export type Gap = z.infer<typeof gap>

/**
 * One supporting line of an explanation.
 *
 * A small tagged union rather than prose so a client can render each kind properly — a formula
 * in a disclosure, evidence as a link back to the attempt. Prose would force every consumer to
 * re-parse what was already known.
 */
export const explanationPart = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fact'), text: z.string().min(1).max(2000) }),
  z.object({
    kind: z.literal('evidence'),
    text: z.string().min(1).max(2000),
    observationId: id.optional(),
    atMs: millis.optional(),
  }),
  z.object({
    kind: z.literal('formula'),
    expression: z.string().min(1).max(2000),
    /** The values substituted in, so a reviewer can check the arithmetic. */
    inputs: z.record(z.string(), z.number()).optional(),
    result: z.number().optional(),
  }),
])
export type ExplanationPart = z.infer<typeof explanationPart>

/** Who the explanation is being written for. The same belief needs different sentences. */
export const explanationAudience = z.enum(['learner', 'teacher', 'parent', 'expert'])
export type ExplanationAudience = z.infer<typeof explanationAudience>

/**
 * Why the system believes, or decided, what it did.
 *
 * The glass-box obligation: any figure this family publishes must be unfoldable into the
 * evidence and the arithmetic behind it. A claim a teacher can argue with is a claim they can
 * trust; one they cannot check is one they will eventually ignore.
 */
export const explanation = z.object({
  claim: z.string().min(1).max(1000),
  subject: z.object({
    learnerId: z.string().max(128).optional(),
    skillSlug: slug.optional(),
  }),
  parts: z.array(explanationPart).default([]),
  counterfactual: z.string().max(2000).optional(),
  nextStep: z.string().max(2000).optional(),
  audience: explanationAudience.default('teacher'),
  generatedAtMs: millis,
})
export type Explanation = z.infer<typeof explanation>

/**
 * An abstract candidate the sequencer may choose.
 *
 * The engine never sees content. It sees a key, the concepts an item exercises, and a
 * difficulty — enough to choose, and not enough to know what a question says. That is what
 * keeps the engine content-agnostic and the item bank replaceable.
 */
export const candidate = z.object({
  key: z.string().min(1).max(256),
  skills: z.array(slug).min(1),
  difficulty: elo,
  /** A presentation tag for de-clumping — `mcq`, `drag`. Not a `CompetencyKind`. */
  kind: z.string().max(64).optional(),
  lessonSlug: slug.optional(),
})
export type Candidate = z.infer<typeof candidate>

/** The instrument a node's kind implies. Which adapter folds an observation for it. */
export const measurementMethod = z.enum(['BKT_ELO', 'BETA_BINOMIAL', 'RUBRIC'])
export type MeasurementMethod = z.infer<typeof measurementMethod>

/**
 * How each kind is measured.
 *
 * One Bayesian core, three adapters. Dispositions use frequency rather than correctness — there
 * is no right answer to "engages with books", only how often it is observed — which is why they
 * carry low per-observation confidence and need many sightings before they say anything.
 */
export function methodFor(kind: z.infer<typeof competencyKind>): MeasurementMethod {
  switch (kind) {
    case 'KNOWLEDGE':
    case 'PROCEDURE':
      return 'BKT_ELO'
    case 'SKILL':
      return 'RUBRIC'
    case 'DISPOSITION':
    case 'BEHAVIOR':
    case 'ATTITUDE':
      return 'BETA_BINOMIAL'
    case 'OBJECTIVE':
    case 'OUTCOME':
      // Reporting overlays are never measured directly; their mastery is rolled up through
      // MAPS_TO from the concepts that certify them.
      return 'BKT_ELO'
  }
}
