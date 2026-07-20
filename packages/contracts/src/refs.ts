// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'

/**
 * Identity primitives — the vocabulary every other module is spelled in.
 *
 * ## Four representations, never conflated
 *
 * | | For whom | How it is made | Exposed to a learner? |
 * |---|---|---|---|
 * | `Id` | machine, database | generated (cuid/ULID) | never |
 * | `Slug` | author, runtime | derived from the English title | never |
 * | `title.{locale}` | learner, parent | authored, multilingual | **yes** |
 * | `Code` | outside world, reports, certificates | imported from a framework | **yes** |
 *
 * **The rule: a slug and an id never leave the system.** A learner sees `title`; a report or a
 * certificate speaks in `code`. Leaking `math.number.addition.combine-within-10` onto a screen
 * is a bug, not a cosmetic issue — it teaches people to depend on a string we reserve the right
 * to keep stable but never to display.
 *
 * The engine runs on **slug**; relations reference **id**. That split lets a node be renamed for
 * display without breaking a single edge, and lets edges survive a re-slug that the id bridge
 * absorbs at graph-build time.
 */

/**
 * The runtime key for a concept.
 *
 * Grammar: `<domain>.<subdomain>[.<topic>].<concept>[@<variant>]` — lowercase, kebab-case within
 * a segment, `.` separating namespaces, `@` marking a variant. Objectives are namespaced under
 * `fw.<framework>.<code>`.
 *
 * **Derived from the English title, always.** "Phép cộng trong phạm vi 20" and "Add within 20"
 * must produce the same slug, or one piece of knowledge becomes two concepts and a learner's
 * evidence is split in half. Display stays Vietnamese; the key does not.
 *
 * **Never encode a mutable attribute.** Type, level, framework, age band are fields. A slug that
 * says `grade1-` is a slug that lies the moment a curriculum moves the topic.
 *
 * Immutable once issued. Changing meaning means a new node plus a supersede edge; retired slugs
 * are never reissued, because historical evidence still points at them.
 */
export const slug = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*(?:@[a-z0-9]+(?:-[a-z0-9]+)*)?$/,
    'is a dotted lowercase slug, e.g. "math.number.addition.combine-within-10" or "…regroup@borrow"',
  )
export type Slug = z.infer<typeof slug>

/**
 * A stable machine identifier — what relations reference.
 *
 * Opaque by design. Nothing may parse it, sort by it or infer anything from it; a store is free
 * to use cuid, ULID or a UUID.
 */
export const id = z.string().min(1).max(64)
export type Id = z.infer<typeof id>

/**
 * A code from an outside standard: `1Nc8`, `CCSS.MATH.1.OA.A.1`, `CEFR B2`, `ISCO 2511`.
 *
 * **Display and reporting only, never logic.** The moment a branch reads a code, the engine has
 * learned that "Cambridge" exists, and it stops being curriculum-agnostic. Imported, never
 * typed by hand.
 */
export const code = z.string().min(1).max(128)
export type Code = z.infer<typeof code>

/**
 * Human-readable text in every locale it has been authored in.
 *
 * `en` is the canonical entry: slugs derive from it, and cross-framework alignment compares it.
 * A node with no English title cannot be reliably deduplicated against a framework written in
 * another language, which is why the authoring invariants make it an error rather than a
 * warning.
 */
export const localizedText = z.record(z.string().min(2).max(35), z.string().min(1).max(4000))
export type LocalizedText = z.infer<typeof localizedText>

/** Semantic version of a published artefact. */
export const semver = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/,
    'is a semantic version, e.g. "1.4.0"',
  )
export type Semver = z.infer<typeof semver>

/** Structured semver, as a framework release carries it. */
export const semverParts = z.object({
  major: z.number().int().min(0),
  minor: z.number().int().min(0),
  patch: z.number().int().min(0),
})
export type SemverParts = z.infer<typeof semverParts>

/**
 * An SPDX identifier, or a URL for bespoke terms.
 *
 * Frameworks and content are licensed separately from the code that reads them: a repo is
 * Apache-2.0, the Vietnamese framework it loads may not be.
 */
export const license = z.string().min(1).max(256)
export type License = z.infer<typeof license>

/**
 * Epoch milliseconds.
 *
 * Time is **always** passed in, never read. Nothing in this family calls the clock inside a
 * measurement path: the same evidence in the same order has to produce the same result, or a
 * disputed estimate can never be re-derived.
 */
export const millis = z.number().int()
export type Millis = z.infer<typeof millis>

/** ISO-8601 with an offset, for artefacts that travel outside the system. */
export const timestamp = z.string().datetime({ offset: true })
export type Timestamp = z.infer<typeof timestamp>

/** BCP-47. Loose on purpose: strict grammar validation rejects valid rare tags. */
export const languageTag = z
  .string()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z0-9-]+$/)
export type LanguageTag = z.infer<typeof languageTag>

/**
 * An Elo rating, centred on 1000.
 *
 * Learner ability and item difficulty live on the **same** scale, which is the whole point:
 * their difference is what predicts success, so selecting an item near a learner's ability is a
 * subtraction rather than a model.
 */
export const elo = z.number()
export type Elo = z.infer<typeof elo>

/** A normalised value in `[0, 1]` — a probability, a weight, a coverage. */
export const unitInterval = z.number().min(0).max(1)
export type UnitInterval = z.infer<typeof unitInterval>

/**
 * An opaque learner identifier, as the deployment's roster issues it.
 *
 * Opaque is the point: nothing here parses it, and no personal data rides in it (see
 * `profile.ts` for what a profile deliberately omits).
 */
export const learnerId = z.string().min(1).max(128)
export type LearnerId = z.infer<typeof learnerId>

/**
 * An absolute URI, for artefacts that live outside the concept graph — a framework's public
 * address, a media locator, a credential id.
 *
 * Concepts are keyed by `Slug`, not by this. Kept loose because published identifiers in the
 * wild are HTTP URLs, URNs and bare GUIDs, and rejecting a real one is a worse failure than
 * accepting an odd-looking string.
 */
export const uri = z.string().min(1).max(2048)
export type Uri = z.infer<typeof uri>

/** Where an artefact sits in its editorial life. `published` is immutable. */
export const lifecycle = z.enum(['draft', 'in-review', 'published', 'deprecated', 'retired'])
export type Lifecycle = z.infer<typeof lifecycle>

/** A pointer to an assessment item held by a content repository. */
export const itemRef = z.object({
  id: z.string().min(1).max(128),
  /** Items are revised; evidence must stay attributable to what was actually answered. */
  version: z.string().min(1).max(64).optional(),
})
export type ItemRef = z.infer<typeof itemRef>

/** A key into the teaching-method library. */
export const methodRef = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9-]*$/, 'is a lowercase library key, e.g. "think-pair-share"')
export type MethodRef = z.infer<typeof methodRef>

/** A key into the learning-format library. */
export const formatRef = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9-]*$/, 'is a lowercase library key, e.g. "kahoot-live"')
export type FormatRef = z.infer<typeof formatRef>
