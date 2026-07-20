// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * The vocabulary this codec reads and writes.
 *
 * xAPI is deliberately open: anyone may coin a verb or an extension. That freedom is why an
 * LRS can hold data from a dozen tools, and also why two tools can describe the same event in
 * ways neither can read. A **profile** — an agreed set of IRIs and what they mean — is the
 * thing that makes the data useful afterwards.
 *
 * This file is that agreement. Two rules govern it:
 *
 * **Reuse ADL's vocabulary wherever it exists.** `answered`, `attempted`, `completed`,
 * `experienced` are standard, widely implemented, and already understood by every LRS and
 * reporting tool on the market. Coining `https://bingoo.ai/xapi/verbs/answered` would produce
 * data that only our own tools could report on, which is the opposite of the point.
 *
 * **Coin only what is genuinely ours.** Competency URIs and KSD components have no standard
 * extension, so they get ours. These IRIs are a public commitment: once a school's LRS holds
 * a year of statements using them, changing one silently orphans that history.
 */

/** ADL's standard verbs. Not ours — do not add to this list without checking the registry. */
export const VERBS = Object.freeze({
  answered: 'http://adlnet.gov/expapi/verbs/answered',
  attempted: 'http://adlnet.gov/expapi/verbs/attempted',
  completed: 'http://adlnet.gov/expapi/verbs/completed',
  experienced: 'http://adlnet.gov/expapi/verbs/experienced',
  passed: 'http://adlnet.gov/expapi/verbs/passed',
  failed: 'http://adlnet.gov/expapi/verbs/failed',
  /** ADL's `asked` is the closest standard verb for a hint being requested. */
  asked: 'http://adlnet.gov/expapi/verbs/asked',
} as const)

/**
 * Our extensions. Stable identifiers — treat a change as a breaking one for every LRS holding
 * our data, because it is.
 */
export const EXTENSIONS = Object.freeze({
  /** The competency this statement is evidence about. A CASE URI. */
  competency: 'https://bingoo.ai/xapi/extensions/competency',
  /** Which KSD component, where the evidence is finer than the competency. */
  ksdItem: 'https://bingoo.ai/xapi/extensions/ksd-item',
  /** The framework version the competency URI was read against. */
  frameworkVersion: 'https://bingoo.ai/xapi/extensions/framework-version',
  /** True when the learner took a hint — the attempt is then weaker evidence. */
  hintUsed: 'https://bingoo.ai/xapi/extensions/hint-used',
  /** The learning format the attempt happened in: arena, trivia, traditional… */
  format: 'https://bingoo.ai/xapi/extensions/format',
} as const)

/** ADL's activity types, for the `object.definition.type` of an item. */
export const ACTIVITY_TYPES = Object.freeze({
  question: 'http://adlnet.gov/expapi/activities/question',
  assessment: 'http://adlnet.gov/expapi/activities/assessment',
  media: 'http://adlnet.gov/expapi/activities/media',
  lesson: 'http://adlnet.gov/expapi/activities/lesson',
} as const)

export type VerbId = (typeof VERBS)[keyof typeof VERBS]
