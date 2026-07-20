// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'
import { id, license, localizedText, semverParts, slug, unitInterval } from './refs.js'

/**
 * Frameworks — the standards layer that sits *over* the concept graph.
 *
 * ## The idea that makes multi-standard work
 *
 * There is **one** concept graph, shared across every curriculum and every country. A national
 * standard is not a separate graph; it is an overlay of `OBJECTIVE` nodes that `MAPS_TO` the
 * same underlying concepts.
 *
 * ```
 * obj Cambridge 0845 ──MAPS_TO──┐
 * obj GDPT 2018      ──MAPS_TO──┼──▶ kc-carry-write, kc-carry-add …   (shared concepts)
 * obj Common Core    ──MAPS_TO──┘
 * ```
 *
 * A learner moving from a Vietnamese school to a Cambridge one **keeps their mastery**, because
 * mastery attaches to the concept and not to the standard. Nothing is translated, because there
 * is nothing between the two standards to translate — they were always pointing at the same
 * atoms. *Học một lần, báo cáo theo nhiều chuẩn.*
 *
 * ## Two records, and the difference is load-bearing
 *
 * `Framework` is a **stable identity line** — "Cambridge Primary Mathematics 0845", the thing
 * that persists across editions. `FrameworkVersion` is an **immutable release snapshot**.
 *
 * Content and learner state pin the *version*, never the line. Pinning the line would mean a
 * publisher's revision silently changed what a cohort was measured against.
 */

export const frameworkKind = z.enum(['CURRICULUM', 'CREDENTIAL', 'JOB_PROFILE'])
export type FrameworkKind = z.infer<typeof frameworkKind>

/**
 * How much a release changes, and therefore what has to happen to everything pinned to the old
 * one.
 *
 * | | Courses pinned to the old version | Learner state |
 * |---|---|---|
 * | `PATCH` | drift automatically | kept as-is |
 * | `MINOR` | opt in | carried forward |
 * | `MAJOR` | opt in | re-baselined |
 *
 * A `PATCH` is a clarification or a typo — nothing an author meant changed, so dragging everyone
 * through a migration would be ceremony. A `MAJOR` restructures, so carrying state forward
 * unexamined would credit learners against objectives that no longer mean what they did.
 */
export const frameworkReleaseType = z.enum(['PATCH', 'MINOR', 'MAJOR'])
export type FrameworkReleaseType = z.infer<typeof frameworkReleaseType>

export const frameworkVersionStatus = z.enum(['DRAFT', 'PUBLISHED', 'DEPRECATED'])
export type FrameworkVersionStatus = z.infer<typeof frameworkVersionStatus>

/** The stable line. Never pinned to directly by content or state. */
export const framework = z.object({
  id: id.optional(),
  slug,
  name: localizedText,
  kind: frameworkKind.default('CURRICULUM'),
  /** The locale the standard is *written* in — not the language it is taught in. */
  locale: z.string().min(2).max(35).default('en'),
  license: license.optional(),
  /** Where it came from: a file, a URL, a registry entry. */
  source: z.string().max(2000).optional(),
})
export type Framework = z.infer<typeof framework>

/**
 * An immutable release.
 *
 * Once `PUBLISHED`, nothing in it changes. A correction is a new `PATCH`, because a learner
 * measured against `1.2.0` must still be able to find out what `1.2.0` said.
 */
export const frameworkVersion = z.object({
  id: id.optional(),
  frameworkSlug: slug,
  version: semverParts,
  releaseType: frameworkReleaseType.default('MAJOR'),
  status: frameworkVersionStatus.default('DRAFT'),
  label: localizedText.optional(),
  notes: localizedText.optional(),
  source: z.string().max(2000).optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  /** The release this one replaces, for lineage. */
  supersedes: semverParts.optional(),
})
export type FrameworkVersion = z.infer<typeof frameworkVersion>

/**
 * What a learner has attained, expressed against one framework.
 *
 * This is a **projection**, computed on request, never stored. The stored truth is concept-level
 * mastery; a framework report is that truth read through one standard's objectives. Two reports
 * against two standards for the same learner are two views of one set of evidence, which is why
 * neither can drift from the other.
 *
 * `coverage` is the `MAPS_TO` weight — how much of the objective this concept accounts for. An
 * objective certified by four concepts where the learner has three is not three-quarters
 * achieved; whether it counts at all depends on whether the missing one was `REQUIRED`.
 */
export const objectiveStatus = z.enum(['achieved', 'partial', 'none'])
export type ObjectiveStatus = z.infer<typeof objectiveStatus>

export const objectiveReport = z.object({
  objectiveSlug: slug,
  /** The standard's own code — what a certificate or a report card prints. */
  code: z.string().max(128).nullable().default(null),
  title: localizedText,
  strand: z.string().max(128).nullable().default(null),
  /** Mastery rolled up from the concepts this objective maps to. */
  mastery: unitInterval,
  coverage: unitInterval.default(1),
  status: objectiveStatus,
})
export type ObjectiveReport = z.infer<typeof objectiveReport>

export const frameworkReport = z.object({
  framework: z.object({ slug, name: localizedText, kind: frameworkKind }),
  version: semverParts.optional(),
  objectives: z.array(objectiveReport).default([]),
  summary: z.object({
    achieved: z.number().int().min(0),
    partial: z.number().int().min(0),
    total: z.number().int().min(0),
    percent: unitInterval,
  }),
})
export type FrameworkReport = z.infer<typeof frameworkReport>
