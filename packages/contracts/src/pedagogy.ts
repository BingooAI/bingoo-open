// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'
import { dreyfusLevel } from './competency.js'
import { itemShape } from './content.js'
import { socialForm, teachingStep } from './format.js'
import { explanation } from './evidence.js'
import { slug, formatRef, itemRef, learnerId, lifecycle, methodRef, semver, uri } from './refs.js'

/**
 * Teaching: the plan a teacher authors, and the move an engine makes from it.
 *
 * `TeachingPlan` is design-time, produced by Pedagogy Studio. `PedagogicalMove` is runtime,
 * produced by Pedagogy Engine and executed by Learning Player. Both live here because they
 * are two ends of one contract: the plan says what a teacher will permit, the move says what
 * the engine chose within that permission.
 *
 * **The ordering claim this file encodes (§A5, §C3):** content is produced *after* the plan,
 * not before. A `PlanNode` may carry a `ContentRequirement` — an order for content that does
 * not exist yet — instead of `contentRefs`. You cannot generate a well-fitted question until
 * you know which competency, at which level, in which format, it is for. Most authoring
 * tools get this backwards and end up with a library of items nobody can teach from.
 */

/** How far a plan node reaches. A plan is one recursive tree, not four different documents. */
export const planScope = z.enum(['course', 'module', 'lesson', 'activity'])
export type PlanScope = z.infer<typeof planScope>

/** The three tiers of the method library (§B7) — macro, meso, micro. */
export const methodLevel = z.enum(['perspective', 'method', 'technique'])
export type MethodLevel = z.infer<typeof methodLevel>

/**
 * An entry in the teaching-method library.
 *
 * `groundedIn` cites the pedagogy this comes from. It is not academic decoration: when the
 * Engine tells a teacher "I chose think-pair-share here", the teacher's reasonable next
 * question is "on what basis", and a citation is a better answer than a confidence score.
 */
export const teachingMethod = z.object({
  id: methodRef,
  level: methodLevel,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** What it is good for, in the author's words. Matched loosely by the suggester. */
  goodFor: z.array(z.string().max(200)).default([]),
  socialForms: z.array(socialForm).default([]),
  steps: z.array(teachingStep).default([]),
  /** e.g. "Vygotsky, ZPD" or "Nguyễn Văn Cường & Meier §4.2". */
  groundedIn: z.string().max(500).optional(),
})
export type TeachingMethod = z.infer<typeof teachingMethod>

/**
 * An order for content that does not exist yet — the plan's request to the content studios.
 *
 * This is the mechanism behind the ordering claim above. A teacher plans "consolidate word
 * problems, arena format, six questions, around θ 0.4"; Content Studio fills the order; the
 * runtime may top it up on demand per learner. Nobody writes forty questions and then
 * wonders which lesson they belong to.
 */
export const contentRequirement = z.object({
  skillSlug: slug,
  /** Which KSD component is being taught or measured. `D` is teachable but never scored. */
  ksd: z.enum(['K', 'S', 'D']).optional(),
  shape: itemShape,
  level: dreyfusLevel.optional(),
  /** Target IRT difficulty (θ). */
  difficulty: z.number().optional(),
  format: formatRef.optional(),
  count: z.number().int().min(1).max(1000).optional(),
  /** Free-text guidance for the author or generator: context, vocabulary, things to avoid. */
  notes: z.string().max(2000).optional(),
})
export type ContentRequirement = z.infer<typeof contentRequirement>

/** How much latitude the teacher grants the Engine at this node. */
export const autonomy = z.enum(['strict', 'guided', 'free'])
export type Autonomy = z.infer<typeof autonomy>

/**
 * A branch for a group who need something different (§D4).
 *
 * This is *coarse* differentiation — by group, decided by the teacher at design time. Fine
 * differentiation, per learner, is the Engine's job at runtime. Conflating the two is how
 * you get a system that either ignores the teacher or ignores the child.
 */
export const differentiationBranch = z.object({
  id: z.string().min(1).max(128),
  /** Who this branch is for, in the teacher's words — never a mastery band. */
  label: z.string().min(1).max(200),
  /** Applied when a learner's mastery on these competencies is below the framework threshold. */
  whenBelowThresholdOn: z.array(slug).default([]),
  method: methodRef.optional(),
  format: formatRef.optional(),
  contentReq: contentRequirement.optional(),
})
export type DifferentiationBranch = z.infer<typeof differentiationBranch>

/**
 * How learners work with each other and with home (§B10 axis 3).
 *
 * Both sub-objects carry a hard-wired guarantee. `exposeScores: false` means peer grouping
 * cannot become a visible ability sort — pairing a strong learner with a weaker one is good
 * pedagogy, and telling them which is which is not. `childPrivacy: 'strict'` means the parent
 * channel carries explained progress, never surveillance (A7 §3).
 */
export const interactionDesign = z.object({
  peer: z
    .object({
      /** `complementary` pairs on strength/weakness — the pairing the Engine can act on. */
      grouping: z.enum(['complementary', 'random', 'homogeneous', 'interest']),
      peerTutoring: z.boolean().default(false),
      peerFeedback: z.boolean().default(false),
      groupSize: z.number().int().min(2).max(12).optional(),
      /** Grouping by ability never reveals the ability. No `true` exists. */
      exposeScores: z.literal(false).default(false),
    })
    .optional(),
  parent: z
    .object({
      /** What goes home. `progress-explained` is the default and the point (§A2). */
      share: z.enum(['progress-explained', 'summary', 'none']).default('progress-explained'),
      homeSupportTips: z.boolean().default(true),
      coGoalSetting: z.boolean().default(false),
      /** The child's data does not become a monitoring feed. Not configurable. */
      childPrivacy: z.literal('strict').default('strict'),
    })
    .optional(),
})
export type InteractionDesign = z.infer<typeof interactionDesign>

/** When and how a node is assessed. Cuts across every scope. */
export const assessmentPlan = z.object({
  kind: z.enum(['formative', 'summative', 'diagnostic']),
  competencies: z.array(slug).default([]),
  /** Weight toward a reported grade. Formative assessment usually carries none. */
  weight: z.number().min(0).max(1).optional(),
  notes: z.string().max(2000).optional(),
})
export type AssessmentPlan = z.infer<typeof assessmentPlan>

/**
 * A node in the plan tree: a course, a module, a lesson or a single activity.
 *
 * Recursive rather than four separate types, because the alternative is four near-identical
 * schemas and a consumer that must switch on depth. `zod` needs the explicit annotation and
 * `z.lazy` to express the recursion; that ceremony is the price of one type instead of four.
 */
/**
 * The optional properties are written `?: T | undefined` rather than `?: T` because the repo
 * runs with `exactOptionalPropertyTypes`. Under that flag the two differ, and only the
 * explicit form matches what `z.optional()` produces — so this is what makes the hand-written
 * interface and the schema below provably the same type rather than approximately the same.
 */
export interface PlanNode {
  id: string
  scope: PlanScope
  title: string
  /** What this node teaches. Empty at organisational levels; meaningful nodes name at least one. */
  competencyRefs: string[]
  method?: string | undefined
  socialForm?: SocialFormValue | undefined
  format?: string | undefined
  step?: TeachingStepValue | undefined
  /** An order for content to be generated. Mutually intelligible with `contentRefs`. */
  contentReq?: ContentRequirement | undefined
  /** Existing content to reuse. A node may have neither, either, or both. */
  contentRefs?: ItemRefValue[] | undefined
  durationMin?: number | undefined
  assessment?: AssessmentPlan | undefined
  differentiation?: DifferentiationBranch[] | undefined
  interaction?: InteractionDesign | undefined
  /** How much the Engine may deviate here. Inherited from the parent when absent. */
  autonomy?: Autonomy | undefined
  children: PlanNode[]
}

type ItemRefValue = z.infer<typeof itemRef>

type SocialFormValue = z.infer<typeof socialForm>
type TeachingStepValue = z.infer<typeof teachingStep>

export const planNode: z.ZodType<PlanNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(128),
    scope: planScope,
    title: z.string().min(1).max(500),
    competencyRefs: z.array(slug).default([]),
    method: methodRef.optional(),
    socialForm: socialForm.optional(),
    format: formatRef.optional(),
    step: teachingStep.optional(),
    contentReq: contentRequirement.optional(),
    contentRefs: z.array(itemRef).optional(),
    durationMin: z.number().int().min(1).max(600).optional(),
    assessment: assessmentPlan.optional(),
    differentiation: z.array(differentiationBranch).optional(),
    interaction: interactionDesign.optional(),
    autonomy: autonomy.optional(),
    children: z.array(planNode).default([]),
  }),
)

/**
 * A published teaching plan — Pedagogy Studio's output, Pedagogy Engine's input.
 *
 * Vietnamese deployments carry the Ministry's lesson-plan structure (Công văn 5512) in
 * `khbd`. It is optional and additive rather than baked into `PlanNode`: a Singaporean or
 * Cambridge deployment should not have to carry a Vietnamese administrative form, and a
 * Vietnamese one must not have to abandon it.
 */
export const teachingPlan = z.object({
  uri,
  version: semver,
  title: z.string().min(1).max(500),
  frameworkUri: uri,
  /** Framework version this plan was written against — plans outlive framework revisions. */
  frameworkVersion: semver.optional(),
  root: planNode,
  /** Methods this plan draws on, so it travels without the studio's library. */
  methods: z.array(teachingMethod).default([]),
  lifecycle,
  author: z.string().max(256).optional(),
  /** Optional national lesson-plan metadata, e.g. Vietnam's CV 5512 fields. */
  khbd: z.record(z.string(), z.unknown()).optional(),
})
export type TeachingPlan = z.infer<typeof teachingPlan>

/**
 * What the Engine decided to do next, for one learner, right now.
 *
 * `rationale` is required and `explanation` is expected. A move the system cannot justify is
 * a move this system does not make (§A1) — and the obligation is enforced at the type level
 * by making the field non-optional rather than by hoping implementers fill it in.
 *
 * Note what a move contains: an action, a method, a format, and a *reference* to content.
 * Pedagogy Engine decides; it does not run anything and it does not emit evidence. Running
 * is Learning Player's job (§D6) — keeping the decision separable from the stage is what
 * lets a school replace either one.
 */
export const moveAction = z.enum([
  'practice',
  'worked-example',
  'hint',
  'review',
  'explain',
  'consolidate',
  'assess',
  /** Yes, stopping is a pedagogical decision. A tired learner is not a learning learner. */
  'break',
])
export type MoveAction = z.infer<typeof moveAction>

export const pedagogicalMove = z.object({
  learnerId,
  action: moveAction,
  /** Which competency this move serves. Absent only for `break`. */
  skillSlug: slug.optional(),
  method: methodRef.optional(),
  format: formatRef.optional(),
  /** Content to run. Empty for `break`; usually one item, sometimes a short set. */
  content: z.array(itemRef).default([]),
  /** The plan node this move sits under, when the Engine is executing a plan. */
  planNodeId: z.string().max(128).optional(),
  /** Target success probability. ~0.7 is the usual flow-state aim (§D6). */
  targetSuccess: z.number().min(0).max(1).optional(),
  /** Required. One sentence, for the teacher. */
  rationale: z.string().min(1).max(2000),
  /** The full glass-box account, when the caller asked for one. */
  explanation: explanation.optional(),
})
export type PedagogicalMove = z.infer<typeof pedagogicalMove>

/**
 * A grouping the Engine proposes for an activity.
 *
 * There is no field for each member's mastery, and that is not an oversight. The Engine
 * groups *using* mastery and reports only the grouping; a payload carrying both would sooner
 * or later be rendered, and then a nine-year-old learns they are in the bottom group
 * (A7 §2, §B11).
 */
export const groupAssignment = z.object({
  planNodeId: z.string().max(128).optional(),
  groups: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        members: z.array(learnerId).min(1),
        /** Set when this group pairs complementary strengths — not who is strong. */
        rationale: z.string().max(500).optional(),
      }),
    )
    .default([]),
})
export type GroupAssignment = z.infer<typeof groupAssignment>
