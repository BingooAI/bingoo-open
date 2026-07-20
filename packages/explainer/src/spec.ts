// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * spec.ts — the explainer's REQUIRED INPUT CONTRACT (explainer-spec/v1).
 *
 * The explainer does NOT own pedagogy: the skill graph (@bingoo.ai/knowledge-engine),
 * the instruction plan (@bingoo.ai/plans) and the source ingest (@bingoo.ai/authoring)
 * do. What the explainer owns is a hard boundary: it REFUSES to generate unless
 * the upstream supplies everything needed to make a *verifiably* good lesson.
 *
 * Every required field below exists because a specific failure mode appears
 * without it — see `validateSpec` for the one-to-one mapping. The rule of thumb:
 *
 *   if the LLM would have to INVENT it, the upstream must SUPPLY it.
 *
 * Design notes on what this deliberately does NOT trust:
 *  • `planQuality` only proves referential integrity (slugs exist, objectives are
 *    covered) — NOT truth. So we additionally require GROUNDING (source quotes)
 *    and we verify every produced answer key by CODE (see gen's key-check).
 *  • The plan layer currently drops the evidence quotes that @bingoo.ai/authoring
 *    extracted (ConceptDraft.evidence). Until `KnowledgePoint` carries them, the
 *    caller must pass them here as `grounding` — otherwise narration would be
 *    written two hops away from the textbook.
 */
import { z } from 'zod'

/* ------------------------------------------------------------------ shared */

export const LocalizedText = z.record(z.string(), z.string())

/** A traceable quote from the source material (mirrors @bingoo.ai/authoring EvidenceRef). */
export const SourceEvidence = z.object({
  chunkId: z.string(),
  quote: z.string().min(1),
})
export type SourceEvidence = z.infer<typeof SourceEvidence>

/* ------------------------------------------- ① WHAT TO TEACH (the plan) */

/** Mirrors @bingoo.ai/plans `Representation` — the seed that tells the explainer
 *  WHICH visual register to use for a knowledge point. Without it the model must
 *  guess between a manipulative, a picture and bare symbols. */
export const Representation = z.object({
  stage: z.enum(['concrete', 'pictorial', 'abstract']),
  model: LocalizedText,
  note: LocalizedText.optional(),
})

/** Mirrors @bingoo.ai/plans `Misconception` — the REAL wrong answers, anchored to a
 *  KC, with diagnostic + remediation. These become the distractors; without them
 *  the model invents plausible-but-fake wrong answers. */
export const Misconception = z.object({
  id: z.string(),
  type: z.enum(['conceptual', 'procedural', 'incomplete', 'formatting']),
  wrong: LocalizedText,
  targetsKc: z.string(),
  diagnostic: LocalizedText.optional(),
  remediation: LocalizedText.optional(),
})

export const SuccessCriterion = z.object({
  text: LocalizedText,
  kc: z.string().optional(),
})

/** The atomic teaching unit. One KP → one (or a few) exposition scenes. */
export const KnowledgePointSpec = z.object({
  slug: z.string(),
  targets: z.array(z.string()).min(1),
  representations: z.array(Representation).min(1),
  successCriteria: z.array(SuccessCriterion).min(1),
  misconceptions: z.array(Misconception),
  hintLevels: z.array(z.string()).optional(),
})
export type KnowledgePointSpec = z.infer<typeof KnowledgePointSpec>

/** Which interaction to mount at an activity beat. `primitiveKinds` are
 *  @bingoo.ai/core quiz types (or `manip:<kit>`); the generator never picks a type. */
export const ActivitySpec = z.object({
  slug: z.string(),
  purpose: z.enum(['teach', 'practice', 'assess']),
  primitiveKinds: z.array(z.string()).min(1),
  concepts: z.array(z.string()).min(1),
  difficultyBand: z.enum(['easy', 'core', 'stretch']).optional(),
  itemCount: z.number().int().positive().optional(),
})

export const AssessmentSpec = z.object({
  slug: z.string(),
  mode: z.enum(['LEARN', 'MEASURE']),
  objectives: z.array(z.string()).min(1),
  blueprint: z
    .array(
      z.object({
        concept: z.string(),
        itemCount: z.number().int().positive(),
        difficulty: z.enum(['easy', 'core', 'stretch']).optional(),
        primitiveKind: z.string().optional(),
      }),
    )
    .min(1),
  passRatio: z.number().min(0).max(1).optional(),
})

export const PlanSpec = z.object({
  slug: z.string(),
  version: z.number().int().nonnegative(),
  title: LocalizedText,
  teaches: z.array(z.string()).min(1),
  prerequisites: z.array(z.string()).optional(),
  outcomes: z.array(SuccessCriterion).optional(),
  knowledgePoints: z.array(KnowledgePointSpec).min(1),
  activities: z.array(ActivitySpec).optional(),
  assessment: AssessmentSpec.optional(),
})
export type PlanSpec = z.infer<typeof PlanSpec>

/* ------------------------------------------------- ② GROUNDING (the source) */

/**
 * The textbook the lesson must be written FROM. `strict` means every factual
 * claim in the narration must be traceable to one of these quotes — the generator
 * cites a `chunkId` per scene and un-cited scenes are rejected. `open` is only
 * legitimate for content that has no source (a warm-up, a game) and forces the
 * output to DRAFT for human review.
 */
export const GroundingSpec = z.object({
  mode: z.enum(['strict', 'open']),
  /** the source chunks the writer may quote from. */
  sources: z.array(z.object({ chunkId: z.string(), text: z.string().min(1), label: z.string().optional() })),
  /** which quotes support which KC — the writer gets only the relevant ones. */
  evidenceByKc: z.record(z.string(), z.array(SourceEvidence)),
})
export type GroundingSpec = z.infer<typeof GroundingSpec>

/* --------------------------------------------------- ③ WHO (learner/teacher) */

export const LearnerSpec = z.object({
  level: z.enum(['L1', 'L2', 'L3']),
  language: z.string().min(1),
  age: z.number().int().positive().optional(),
  interests: z.array(z.string()).optional(),
  accessibility: z.array(z.string()).optional(),
})

export const TeacherSpec = z.object({
  style: z.string().optional(),
  minutes: z.number().int().positive().optional(),
})

/** What the learner already knows — drives recap vs skip. */
export const SnapshotSpec = z.object({
  mastered: z.array(z.string()).optional(),
  fading: z.array(z.string()).optional(),
  frontier: z.array(z.string()).optional(),
})

/* ------------------------------------------------------------- the contract */

export const ExplainerSpec = z.object({
  version: z.literal('explainer-spec/v1'),
  plan: PlanSpec,
  /** planQuality() from @bingoo.ai/plans — the explainer refuses a low-scoring plan. */
  planQuality: z.object({ score: z.number(), errors: z.number().int().nonnegative().optional() }),
  grounding: GroundingSpec,
  learner: LearnerSpec,
  teacher: TeacherSpec.optional(),
  snapshot: SnapshotSpec.optional(),
  /** which locales to author (narration + strings). */
  locales: z.array(z.string()).min(1),
  /** true when a media library is reachable (illustration-first); else the
   *  generator must not author image elements it cannot resolve. */
  mediaLibraryAvailable: z.boolean().default(false),
})
export type ExplainerSpec = z.infer<typeof ExplainerSpec>

/* ------------------------------------------------------------- the boundary */

export type SpecIssue = {
  level: 'error' | 'warn'
  code: string
  message: string
  /** what the UPSTREAM must fix (this is not the explainer's job to repair). */
  fix: string
}

/** Minimum plan score the explainer will generate from. */
export const MIN_PLAN_SCORE = 70

/**
 * Validate the input at the boundary. ERRORS block generation — the explainer
 * does NOT repair a bad brief, it reports precisely what the upstream must
 * supply. Each rule below names the failure it prevents.
 */
export function validateSpec(raw: unknown, isKnownPrimitive?: (kind: string) => boolean): SpecIssue[] {
  const parsed = ExplainerSpec.safeParse(raw)
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({
      level: 'error' as const,
      code: 'spec-shape',
      message: `${i.path.join('.') || '(root)'}: ${i.message}`,
      fix: 'Send an explainer-spec/v1 payload with all required fields.',
    }))
  }
  const s = parsed.data
  const issues: SpecIssue[] = []
  const err = (code: string, message: string, fix: string) =>
    issues.push({ level: 'error', code, message, fix })
  const warn = (code: string, message: string, fix: string) =>
    issues.push({ level: 'warn', code, message, fix })

  // ── the plan must be trustworthy enough to build on ───────────────────────
  if (s.planQuality.score < MIN_PLAN_SCORE) {
    err(
      'plan-quality',
      `planQuality ${s.planQuality.score} < ${MIN_PLAN_SCORE}`,
      'Fix the plan (anchor/coverage/prereq/assess) before asking for a lesson — a lesson cannot be better than its plan.',
    )
  }

  const kcsWithEvidence = new Set(Object.keys(s.grounding.evidenceByKc))

  for (const kp of s.plan.knowledgePoints) {
    // FAILS WITHOUT: the model has to guess whether to show a manipulative, a
    // picture or bare symbols — the single biggest driver of "crude" lessons.
    if (kp.representations.length === 0) {
      err(
        'kp-representation',
        `KP "${kp.slug}" has no representation`,
        'Give each KP ≥1 representation (concrete | pictorial | abstract) — it selects the visual register.',
      )
    }
    // FAILS WITHOUT: nothing measurable to gate on; the lesson teaches but never checks.
    if (kp.successCriteria.length === 0) {
      err(
        'kp-criteria',
        `KP "${kp.slug}" has no successCriteria`,
        'Give each KP ≥1 measurable success criterion — it defines what the activity beat must test.',
      )
    }
    // FAILS WITHOUT: the model invents plausible-but-fake wrong answers.
    if (kp.misconceptions.length === 0) {
      warn(
        'kp-misconception',
        `KP "${kp.slug}" has no misconceptions`,
        'Supply real misconceptions (they become the distractors + the wrong-answer feedback). Without them distractors are invented.',
      )
    }
    // FAILS WITHOUT: narration is written from an LLM's summary of an LLM's
    // extraction — two hops from the textbook. This is the main hallucination surface.
    if (s.grounding.mode === 'strict') {
      const grounded = kp.targets.some((kc) => (s.grounding.evidenceByKc[kc]?.length ?? 0) > 0)
      if (!grounded) {
        err(
          'kp-grounding',
          `KP "${kp.slug}" has no source evidence for any of its KCs (${kp.targets.join(', ')})`,
          'Pass the EvidenceRef quotes that @bingoo.ai/authoring extracted for these KCs. (Note: @bingoo.ai/plans currently drops them — carry them through.)',
        )
      }
    }
  }

  if (s.grounding.mode === 'strict' && s.grounding.sources.length === 0) {
    err(
      'grounding-empty',
      'grounding.mode is strict but no sources were supplied',
      "Send the source chunks the narration must be written from, or set mode:'open' (which forces human review).",
    )
  }
  if (s.grounding.mode === 'open') {
    warn(
      'grounding-open',
      'ungrounded generation — every factual claim is unverifiable',
      'Output must land as DRAFT and pass human review before reaching a learner (R5).',
    )
  }
  for (const kc of kcsWithEvidence) {
    if (!s.plan.teaches.includes(kc) && !s.plan.knowledgePoints.some((k) => k.targets.includes(kc))) {
      warn(
        'evidence-orphan',
        `evidence supplied for KC "${kc}" which this lesson does not teach`,
        'Drop it or add the KC to the plan.',
      )
    }
  }

  // ── the interactions must be real, not invented ───────────────────────────
  const kinds = [
    ...(s.plan.activities ?? []).flatMap((a) => a.primitiveKinds),
    ...(s.plan.assessment?.blueprint ?? []).map((b) => b.primitiveKind).filter((k): k is string => !!k),
  ]
  if (isKnownPrimitive) {
    for (const k of kinds) {
      if (!k.startsWith('manip:') && !isKnownPrimitive(k)) {
        err(
          'unknown-primitive',
          `unknown primitiveKind "${k}"`,
          'Use a primitive the platform can render AND grade (a @bingoo.ai/core quiz type, or manip:<kit>).',
        )
      }
    }
  }

  // ── the lesson must actually check what it taught ─────────────────────────
  if (!s.plan.assessment && !(s.plan.activities ?? []).some((a) => a.purpose !== 'teach')) {
    warn(
      'no-assessment',
      'the plan has no assessment and no practice/assess activity',
      'Add an assessment blueprint or a practice activity — otherwise the lesson teaches but never checks, and produces no evidence for mastery.',
    )
  }

  // ── personalization hints (non-blocking) ──────────────────────────────────
  const mastered = new Set(s.snapshot?.mastered ?? [])
  const unmetPrereqs = (s.plan.prerequisites ?? []).filter((p) => !mastered.has(p))
  if (s.snapshot && unmetPrereqs.length) {
    warn(
      'prereq-gap',
      `learner has not mastered prerequisites: ${unmetPrereqs.join(', ')}`,
      'The lesson should open with a recap scene for these (or the sequencer should teach them first).',
    )
  }

  return issues
}

/** Convenience: does this spec pass the boundary? */
export function specAccepted(issues: SpecIssue[]): boolean {
  return !issues.some((i) => i.level === 'error')
}
