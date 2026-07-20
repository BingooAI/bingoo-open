// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'
import { timestamp, unitInterval } from './refs.js'

/**
 * The shape of a machine proposal, and of the checks that stand between one and a learner.
 *
 * Every repo that uses a model produces `Suggestion<T>` rather than `T`. That is a small
 * type-level decision with a large consequence: **there is no code path in this system where
 * a model's output arrives already accepted.** A reviewer's approval is a state transition
 * on a suggestion, not an inference from its existence.
 *
 * This is the human-in-the-loop rule (A7 §4) expressed where it is hardest to route around.
 * A convention that says "please have someone check the output" is followed until the sprint
 * is short. A return type of `Suggestion<CompetencyFramework>` has to be dealt with.
 */

/** Where a proposal stands. `proposed` until a person moves it. */
export const suggestionStatus = z.enum(['proposed', 'accepted', 'rejected', 'superseded'])
export type SuggestionStatus = z.infer<typeof suggestionStatus>

/**
 * Why the machine thinks so — the part a reviewer actually reads.
 *
 * `rationale` is required; everything else is optional because different suggesters can
 * justify themselves differently. An embedding aligner offers a similarity score; a
 * retrieval-grounded generator offers sources. A suggester that can offer neither should
 * still have to write a sentence explaining itself, and now it does.
 */
export const suggestionEvidence = z.object({
  /** Documents, page references, item ids the proposal was grounded on. */
  sources: z.array(z.string().max(2000)).default([]),
  /** What it was matched against, for alignment and tagging suggestions. */
  similarTo: z.array(z.string().max(512)).default([]),
  /** Similarity or model score, where one exists. */
  score: z.number().optional(),
  /** Required. In the reviewer's language, not the model's. */
  rationale: z.string().min(1).max(4000),
})
export type SuggestionEvidence = z.infer<typeof suggestionEvidence>

/**
 * A machine proposal awaiting a human.
 *
 * Generic over what is proposed, so a framework, a KSD decomposition, a prerequisite edge and
 * a draft item all travel with the same review metadata and can share one review queue.
 *
 * `zod` has no generic schemas, so this is a factory: call it with the schema of the thing
 * being proposed. The exported `Suggestion<T>` type is the one consumers annotate with.
 */
export const suggestion = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    confidence: unitInterval,
    evidence: suggestionEvidence,
    status: suggestionStatus.default('proposed'),
    /** Which model produced it, for audit and for re-running later (§A6 provenance). */
    generatedBy: z.string().max(256).optional(),
    generatedAt: timestamp.optional(),
    /** Set when a person moved it out of `proposed`. */
    reviewedBy: z.string().max(256).optional(),
    reviewedAt: timestamp.optional(),
  })

export interface Suggestion<T> {
  value: T
  confidence: number
  evidence: SuggestionEvidence
  status: SuggestionStatus
  generatedBy?: string
  generatedAt?: string
  reviewedBy?: string
  reviewedAt?: string
}

/** How serious a validation finding is. `error` blocks publication; `warning` informs it. */
export const severity = z.enum(['error', 'warning', 'info'])
export type Severity = z.infer<typeof severity>

export const validationIssue = z.object({
  severity,
  /** A stable machine code, e.g. `framework.cycle`, `item.untagged`. Consumers switch on this. */
  code: z.string().min(1).max(128),
  message: z.string().min(1).max(2000),
  /** Path into the validated document, for pointing an editor at the problem. */
  path: z.array(z.string().max(128)).default([]),
  /** What to do about it. An error message without a next step wastes the reader's time. */
  hint: z.string().max(2000).optional(),
})
export type ValidationIssue = z.infer<typeof validationIssue>

/**
 * The result of validating an artefact — a framework, a plan, a content package.
 *
 * `ok` is derived from the absence of errors, but it is carried explicitly because every
 * consumer would otherwise recompute it, and one of them would get it wrong by counting
 * warnings.
 */
export const validationReport = z.object({
  ok: z.boolean(),
  issues: z.array(validationIssue).default([]),
  /** Coverage-style metrics: `completeness`, `competencyCoverage`, `methodVariety`. */
  metrics: z.record(z.string(), z.number()).default({}),
  checkedAt: timestamp.optional(),
})
export type ValidationReport = z.infer<typeof validationReport>

/**
 * A moderation gate's decision on a piece of content (§D2, the five gates).
 *
 * `by` names the gate — `format`, `ai-review`, `human`, `pilot`, `monitor` — so a rejection
 * is traceable to the stage that made it. The `human` gate is the one that cannot be
 * disabled; the type cannot enforce that on its own, but naming the gates is what lets each
 * repo's CI assert it.
 *
 * `acceptability` is the specifically educational check (§B5): a simplification must not
 * become false. Models simplify past the point of truth cheerfully and fluently, so it is a
 * named flag rather than a note in the reasons.
 */
export const moderationVerdict = z.object({
  decision: z.enum(['pass', 'needs-fix', 'reject']),
  /** The gate that decided. */
  by: z.string().min(1).max(128),
  at: timestamp,
  reasons: z.array(z.string().max(2000)).default([]),
  riskScore: unitInterval.optional(),
  /** False when the content has been simplified into inaccuracy (§B5). */
  acceptability: z.boolean().optional(),
  /** True when this verdict was produced by a model rather than a person. */
  automated: z.boolean().default(false),
})
export type ModerationVerdict = z.infer<typeof moderationVerdict>
