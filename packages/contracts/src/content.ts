// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'
import { dreyfusLevel } from './competency.js'
import { slug, languageTag, lifecycle, semver, timestamp, unitInterval, uri } from './refs.js'

/**
 * Content: the items that measure a competency and the media that explain it.
 *
 * Produced by Content Studio and Explainer Studio, consumed by Pedagogy Engine, Learning
 * Player and Assessment Studio. Maps to 1EdTech **QTI** for items and **C2PA** for
 * provenance; both codecs live outside this package (§C10).
 *
 * Two commitments are encoded here rather than left to each repo's discretion:
 *
 * - **Nothing reaches a child without a human having approved it** (A7 §4). `Item.review`
 *   is required on a published item, and `reviewedBy` is a person's identity — see
 *   `ReviewRecord`.
 * - **Every item declares its shape** (§E3). A format cannot select content it can render
 *   unless the content says what it is. `shape` is not a rendering hint; it is what makes
 *   the format library work at all.
 */

/**
 * The physical form of an item — what it looks like to a learner and which format can host
 * it (§E3).
 *
 * A registry key rather than a frozen enum would be more extensible, but this one is
 * deliberately closed: every value here has a corresponding renderer obligation in Learning
 * Player, and a shape no player can draw is a broken lesson rather than a new capability.
 * Adding one is a minor version and a coordinated change — which is the honest cost.
 */
export const itemShape = z.enum([
  /** Short multiple choice, timed. Arena, trivia. */
  'mcq-fast',
  /** Multiple choice sized for a projector, with a countdown. Kahoot-style. */
  'mcq-big-timer',
  /** A single concept, tip or short passage. Feed. */
  'micro-card',
  /** A fully worked example — the model solution, shown. Traditional, scaffolding. */
  'worked',
  /** A conventional exercise. Traditional. */
  'task',
  /** A word problem: prose the learner must translate into an operation. */
  'worded-task',
  /** A prompt/answer pair for spaced repetition. Flashcard. */
  'qa-pair',
  /** A multi-step, open-ended brief. Project. */
  'complex-task',
  /** An interactive model the learner manipulates. Story-sim. */
  'simulation',
  /** Narrated explanation — video or audio. Produced by Explainer Studio. */
  'explainer',
])
export type ItemShape = z.infer<typeof itemShape>

/** Which of the QTI interaction families the item uses. */
export const responseKind = z.enum([
  'choice',
  'multiple-choice',
  'text-entry',
  'numeric-entry',
  'match',
  'order',
  'extended-text',
  'upload',
  'custom',
])
export type ResponseKind = z.infer<typeof responseKind>

/** A reference to a media asset. Never a bucket-specific URL — storage is the deployer's choice. */
export const mediaRef = z.object({
  id: z.string().min(1).max(128),
  kind: z.enum(['image', 'audio', 'video', 'captions', 'document']),
  /**
   * A logical locator the deployment's storage adapter resolves — not an `https://` link to
   * our bucket. A document that embedded one would stop working the day a school moved its
   * storage, which is a thing schools do.
   */
  locator: z.string().min(1).max(2048),
  mimeType: z.string().max(255).optional(),
  durationSec: z.number().min(0).optional(),
  language: languageTag.optional(),
  /** Required on images conveying meaning. Accessibility is a contract term, not a review note. */
  alt: z.string().max(1000).optional(),
})
export type MediaRef = z.infer<typeof mediaRef>

/**
 * A C2PA provenance manifest: who and what made this, and in what order.
 *
 * Held as a reference plus a summary rather than the full signed manifest. Verification
 * needs the real thing and belongs in `@bingoo.ai/codecs/c2pa`; what a *contract* needs is enough
 * for a reviewer to see at a glance that an item was model-generated and by which model.
 */
export const c2paManifest = z.object({
  /** Where the signed manifest lives. Verification reads this, not the fields below. */
  manifestRef: z.string().min(1).max(2048),
  claimGenerator: z.string().max(256).optional(),
  /** The chain: generated → edited → approved. Summary only; the signature is authoritative. */
  actions: z
    .array(
      z.object({
        action: z.string().max(128),
        by: z.string().max(256).optional(),
        softwareAgent: z.string().max(256).optional(),
        at: timestamp.optional(),
      }),
    )
    .default([]),
  verified: z.boolean().optional(),
})
export type C2paManifest = z.infer<typeof c2paManifest>

/**
 * A tag linking an item to what it measures.
 *
 * `confidence` and `confirmedBy` together carry the whole review story: a machine-proposed
 * tag has a confidence and no confirmer; a human-confirmed tag has both. An item published
 * with unconfirmed tags is measuring something nobody checked, which quietly poisons every
 * mastery estimate downstream.
 */
export const competencyTag = z.object({
  skillSlug: slug,
  level: dreyfusLevel.optional(),
  confidence: unitInterval.optional(),
  confirmedBy: z.string().max(256).optional(),
})
export type CompetencyTag = z.infer<typeof competencyTag>

/**
 * A human's decision at the review gate (§D2 gate 3).
 *
 * `by` is a person. Not a service account, not "system", not the model that drafted it —
 * the point of the gate is that somebody is accountable for what a child sees, and an
 * accountable party has a name.
 */
export const reviewRecord = z.object({
  by: z.string().min(1).max(256),
  at: timestamp,
  decision: z.enum(['approved', 'needs-fix', 'rejected']),
  notes: z.string().max(4000).optional(),
  /** Sensitive material takes two approvers (A7 §4). Both are recorded. */
  secondApprover: z.string().max(256).optional(),
})
export type ReviewRecord = z.infer<typeof reviewRecord>

/**
 * An assessment item — the unit of measurement.
 *
 * The `refine` below is the only place in this package where a rule is checked rather than
 * made unrepresentable, and it earns the exception: it is the human-approval invariant
 * (A7 §4), the one whose violation is least recoverable. A malformed plan wastes a lesson;
 * unreviewed content reaches a child.
 */
export const item = z
  .object({
    id: z.string().min(1).max(128),
    version: semver.optional(),
    shape: itemShape,
    responseKind: responseKind.optional(),
    language: languageTag,
    /** What it measures. At least one tag — an untagged item cannot inform mastery. */
    competencies: z.array(competencyTag).min(1),
    /** IRT difficulty on the θ scale. Absent until calibrated; estimated on authoring. */
    difficulty: z.number().optional(),
    /** Discrimination (IRT `a`). Absent until there is response data to fit. */
    discrimination: z.number().min(0).optional(),
    /** Whether `difficulty` came from real responses or from a model's guess. */
    difficultySource: z.enum(['estimated', 'piloted', 'calibrated']).optional(),
    media: z.array(mediaRef).default([]),
    provenance: c2paManifest.optional(),
    /** Sources the generator grounded on. Required by the acceptability rule (§B5). */
    citations: z.array(z.string().max(2000)).default([]),
    lifecycle,
    review: reviewRecord.optional(),
    createdAt: timestamp.optional(),
  })
  .refine((it) => it.lifecycle !== 'published' || it.review?.decision === 'approved', {
    message: 'a published item must carry an approving human review (gate 3, A7 §4)',
    path: ['review'],
  })
export type Item = z.infer<typeof item>

/**
 * An item plus its QTI payload.
 *
 * The payload is opaque here on purpose. Modelling QTI's interaction types in this package
 * would mean every consumer recompiling when 1EdTech publishes an erratum, and it would put
 * a second, worse QTI implementation in the one place that must never fork. `@bingoo.ai/codecs/qti`
 * owns that; this type says only "there is QTI in here, and here is what it measures".
 */
export const qtiItem = z.object({
  item,
  /** QTI 3.0 XML, or the JSON binding. `@bingoo.ai/codecs/qti` parses it. */
  qti: z.string().min(1),
  qtiVersion: z.string().max(32).default('3.0'),
})
export type QtiItem = z.infer<typeof qtiItem>

/**
 * A learner's answer to one item, as captured by Learning Player.
 *
 * `raw` is deliberately unstructured — it is whatever the interaction produced. Scoring is
 * the Player's or the Grader's job, and both write `correct` and `score`; nothing infers
 * correctness from `raw` after the fact, because only the item's own scoring rules can.
 */
export const response = z.object({
  itemId: z.string().min(1).max(128),
  itemVersion: semver.optional(),
  raw: z.unknown(),
  correct: z.boolean().optional(),
  score: z.number().optional(),
  maxScore: z.number().optional(),
  latencySec: z.number().min(0).optional(),
  /** True when the learner took a hint. Affects what the attempt is evidence *of*. */
  hintUsed: z.boolean().default(false),
  at: timestamp,
})
export type Response = z.infer<typeof response>

/**
 * An explainer asset: narrated teaching content, as produced by Explainer Studio.
 *
 * Modelled here only as far as other repos need it — enough for Pedagogy Engine to choose
 * one and Learning Player to play it. The `explainer/v1` document format itself is specified
 * in the Explainer Studio repo and referenced by `documentRef`; duplicating it here would
 * create two definitions of one format, and they would drift.
 */
export const explainerAsset = z.object({
  id: z.string().min(1).max(128),
  /** Locator for the `explainer/v1` document. Resolved by the deployment's storage adapter. */
  documentRef: z.string().min(1).max(2048),
  language: languageTag,
  competencies: z.array(competencyTag).min(1),
  /** What kind of explanation this is — which decides when the Engine reaches for it. */
  role: z.enum(['concept', 'worked-example', 'hint', 'misconception', 'summary']),
  durationSec: z.number().min(0).optional(),
  media: z.array(mediaRef).default([]),
  provenance: c2paManifest.optional(),
  lifecycle,
  /** Explainers default to two approvers: a wrong explanation does more harm than a wrong question (§D3). */
  review: reviewRecord.optional(),
})
export type ExplainerAsset = z.infer<typeof explainerAsset>

/** A versioned, licensed bundle of items — what an item bank or a publisher ships. */
export const contentPackage = z.object({
  uri,
  version: semver,
  title: z.string().min(1).max(500),
  language: languageTag,
  frameworkUri: uri.optional(),
  items: z.array(item).default([]),
  lifecycle,
})
export type ContentPackage = z.infer<typeof contentPackage>
