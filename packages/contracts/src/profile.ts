// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'
import { dreyfusLevel } from './competency.js'
import { millis, slug, unitInterval } from './refs.js'

/**
 * The portable attainment profile.
 *
 * ## Why this file is small
 *
 * An earlier draft carried crosswalk machinery: map a learner's profile from framework A to
 * framework B, count what transferred exactly, what could only be estimated, what became a new
 * gap. It was careful, and it was solving a problem the model does not have.
 *
 * Mastery attaches to **concepts**, and every standard's objectives `MAPS_TO` the same shared
 * concepts. So a learner moving from a Vietnamese school to a Cambridge one does not need their
 * profile translated — the two curricula were always pointing at the same atoms. What changes is
 * which objectives are read off them, and that is a *report*, computed on demand
 * (`framework.ts`), not a migration.
 *
 * A profile is therefore a list of concept attainments and the evidence behind them. That is
 * all it needs to be, and every hop it avoids is fidelity it does not lose.
 *
 * ## What it deliberately does not contain
 *
 * No name, no date of birth, no class, no teacher, no behaviour note. A profile is a record of
 * attainment, not a student file — and the narrower it is, the safer it is to hand to another
 * institution. That narrowness is the feature.
 */

/** One concept attainment, with enough provenance to be re-examined. */
export const profileEntry = z.object({
  skillSlug: slug,
  /** Probability of mastery at export time. */
  pKnown: unitInterval,
  /** Derived band, where acquisition was reached. */
  level: dreyfusLevel.optional(),
  attempts: z.number().int().min(0).default(0),
  /** When the last supporting observation was made. */
  lastSeenMs: millis.nullable().default(null),
})
export type ProfileEntry = z.infer<typeof profileEntry>

/**
 * Everything one system knows about one learner's attainment.
 *
 * Exports as a W3C Verifiable Credential or an Open Badge. What makes it readable by a school
 * that has never heard of us is that it speaks in concept slugs and standard codes, not in
 * course names — a credential naming "Bingoo Level 3" is worthless the moment the learner
 * leaves.
 */
export const learnerProfile = z.object({
  learnerId: z.string().min(1).max(128),
  entries: z.array(profileEntry).default([]),
  issuedAtMs: millis,
  /** The issuing school or system, so a receiver knows whose measurement this is. */
  issuer: z.string().max(500).optional(),
})
export type LearnerProfile = z.infer<typeof learnerProfile>
