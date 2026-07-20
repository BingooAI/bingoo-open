// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'
import { itemShape } from './content.js'
import { formatRef } from './refs.js'

/**
 * Learning formats — the engagement dimension (Part E).
 *
 * A format is not a teaching method and not a grouping. Method is *how it is taught*
 * (dialogue, role-play); social form is *who learns with whom*; format is *what it feels
 * like* — a feed, a duel, a quiz on the projector. A format wraps a method and a social form
 * and gives them a shape a child wants to open.
 *
 * Designed in Pedagogy Studio, selected by Pedagogy Engine, run by Learning Player, and fed
 * by whichever `ItemShape` it declares. Those four repos agree here and nowhere else.
 */

/**
 * The default format library.
 *
 * Closed, like `ItemShape` and for the same reason: each value is a runtime obligation on
 * Learning Player. A third party adds a format by shipping a `FormatRuntime` plugin *and*
 * a minor release here — the coupling is real, and pretending otherwise with an open string
 * would move the failure from a type error to a blank screen in a classroom.
 */
export const formatKind = z.enum([
  'traditional',
  'feed',
  'trivia',
  'arena',
  'kahoot-live',
  'flashcard',
  'project',
  'story-sim',
])
export type FormatKind = z.infer<typeof formatKind>

/** Who is in the room. */
export const socialForm = z.enum(['whole-class', 'group', 'pair', 'individual'])
export type SocialForm = z.infer<typeof socialForm>

/** Where in a lesson's arc an activity sits (§B7). */
export const teachingStep = z.enum(['entry', 'new-material', 'consolidate', 'practice', 'apply', 'assess'])
export type TeachingStep = z.infer<typeof teachingStep>

/**
 * The wellbeing guarantees a competitive format must honour (A7 §2, §E5).
 *
 * **Three of these five fields are literals, not booleans.** `exposeRank`, `exposeScores`
 * and `protectStrugglers` cannot be set to the harmful value, because the harmful value is
 * not in the type. That is deliberate and it is the whole design:
 *
 * A configurable guardrail is a guardrail that gets configured off — under deadline, by
 * someone who was not in the conversation, to satisfy a customer who wants a leaderboard.
 * The child who ranks 28th of 30 every week is not protected by our good intentions; they
 * are protected by there being no field in which to put the ranking.
 *
 * The two remaining booleans are genuine pedagogical choices: whether competition is
 * available at all, and whether matching is by ability. Both have defensible settings.
 * "Show the class who is worst" does not.
 */
export const wellbeingPolicy = z.object({
  /** Competition is entered, never assigned. */
  competitionOptIn: z.boolean().default(true),
  /** Match on ability (θ) so the weakest learner is not fed a losing streak. */
  matchedDifficulty: z.boolean().default(true),
  /** Celebrate movement, not position. */
  celebrate: z.literal('progress').default('progress'),
  /** A losing streak triggers a supportive format instead. Not negotiable. */
  protectStrugglers: z.literal(true).default(true),
  /** No public ranking. Ever. There is no `true` to assign. */
  exposeRank: z.literal(false).default(false),
  /** No public mastery figures. A child's standing is theirs and their teacher's. */
  exposeScores: z.literal(false).default(false),
})
export type WellbeingPolicy = z.infer<typeof wellbeingPolicy>

/**
 * One entry in the format library.
 *
 * `contentShapes` is the load-bearing field: it is how Pedagogy Engine filters the item bank
 * when it picks a format. Declare a format that wants `mcq-fast` and the Engine will never
 * hand it a `complex-task` — not by convention, but because the query cannot return one.
 */
export const learningFormat = z.object({
  id: formatRef,
  kind: formatKind,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sync: z.enum(['async', 'live']),
  social: socialForm,
  competition: z.enum(['none', '1v1', 'group', 'class']),
  /** Item shapes this format can actually render. At least one, or it can host nothing. */
  contentShapes: z.array(itemShape).min(1),
  /** Motivational devices in play: `streak`, `points`, `timer`, `story`. Free-form by design. */
  engagement: z.array(z.string().max(64)).default([]),
  /** Which parts of a lesson arc it suits. Used by `selectFormat`'s goal-fit term. */
  goodForSteps: z.array(teachingStep).default([]),
  /**
   * Required, not optional. A format without a wellbeing policy would default to whatever
   * the consumer felt like — which is how the guarantee dies quietly rather than loudly.
   */
  wellbeing: wellbeingPolicy,
})
export type LearningFormat = z.infer<typeof learningFormat>
