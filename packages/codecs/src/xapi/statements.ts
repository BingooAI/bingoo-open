// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import type { Observation } from '@bingoo.ai/contracts'
import { ACTIVITY_TYPES, EXTENSIONS, VERBS } from './profile.js'
import { type XapiStatement, xapiStatement } from './schema.js'

/**
 * Building and reading xAPI statements.
 *
 * Learning Player emits; Competency Engine ingests. This codec sits between them so that both
 * agree on the shape without either importing the other, and so a third party's player can
 * feed our engine by emitting the same statements.
 *
 * ## Two directions, different strictness
 *
 * **Emitting is strict.** What we write goes into a school's LRS and outlives us; it is
 * validated before it leaves.
 *
 * **Ingesting is forgiving.** What we read comes from an LRS that may hold statements from a
 * dozen other tools, most of which know nothing about competencies. `ingest` returns what it
 * could understand and says what it could not, rather than rejecting the batch — one
 * unreadable statement must not cost a learner a session's worth of evidence.
 *
 * Everything here is pure: timestamps and statement ids are supplied by the caller. An
 * emitter that reached for the clock would make a player's output untestable and a replay
 * impossible.
 */

export interface Actor {
  learnerId: string
  /** The issuing system, so an LRS holding several schools can tell learners apart. */
  homePage: string
  /** Optional display name. Omit it for children unless the LRS is inside the school. */
  name?: string
}

export interface AttemptEvent {
  actor: Actor
  /** The item attempted. Its IRI is what the statement's object points at. */
  itemUri: string
  correct: boolean
  competencyUri?: string
  ksdItemId?: string
  frameworkVersion?: string
  /** Seconds. Emitted as an ISO-8601 duration. */
  latencySec?: number
  hintUsed?: boolean
  format?: string
  /** ISO-8601 with offset. Supplied, never read from a clock. */
  timestamp: string
  /** A UUID from the caller. Supplied for the same reason as the timestamp. */
  id?: string
  /** The learner's raw response, when it is safe and useful to record. */
  response?: string
}

/**
 * A learner answered an item.
 *
 * This is the statement that carries almost all of the system's evidence, so it is worth
 * knowing exactly what goes where: `result.success` carries correctness, the competency rides
 * in a context extension, and `result.duration` carries latency. Nothing meaningful is put in
 * `object.definition.name` — display text belongs to the content, not the evidence.
 */
export function answered(event: AttemptEvent): XapiStatement {
  const statement: XapiStatement = {
    ...(event.id !== undefined ? { id: event.id } : {}),
    actor: {
      objectType: 'Agent',
      ...(event.actor.name !== undefined ? { name: event.actor.name } : {}),
      account: { homePage: event.actor.homePage, name: event.actor.learnerId },
    },
    verb: { id: VERBS.answered, display: { 'en-US': 'answered' } },
    object: {
      id: event.itemUri,
      objectType: 'Activity',
      definition: { type: ACTIVITY_TYPES.question },
    },
    result: {
      success: event.correct,
      ...(event.latencySec !== undefined ? { duration: toIsoDuration(event.latencySec) } : {}),
      ...(event.response !== undefined ? { response: event.response } : {}),
    },
    context: { extensions: contextExtensions(event) },
    timestamp: event.timestamp,
  }

  // Validated on the way out: this is about to be persisted somewhere we do not control.
  return xapiStatement.parse(statement)
}

/** A learner watched or read an explainer. Evidence of exposure, not of mastery. */
export function experienced(
  event: Omit<AttemptEvent, 'correct' | 'response'> & { durationSec?: number },
): XapiStatement {
  return xapiStatement.parse({
    ...(event.id !== undefined ? { id: event.id } : {}),
    actor: {
      objectType: 'Agent',
      ...(event.actor.name !== undefined ? { name: event.actor.name } : {}),
      account: { homePage: event.actor.homePage, name: event.actor.learnerId },
    },
    verb: { id: VERBS.experienced, display: { 'en-US': 'experienced' } },
    object: {
      id: event.itemUri,
      objectType: 'Activity',
      definition: { type: ACTIVITY_TYPES.media },
    },
    ...(event.durationSec !== undefined ? { result: { duration: toIsoDuration(event.durationSec) } } : {}),
    context: { extensions: contextExtensions(event) },
    timestamp: event.timestamp,
  })
}

/**
 * What a statement meant, as far as this codec can tell.
 *
 * An earlier draft returned a codec-local shape and left the consumer to convert it. That was a
 * second definition of "a piece of evidence" in a family whose whole premise is having one, so
 * `ingest` now yields `Observation` — the family's own evidence type — and reports what it
 * could not read rather than inventing a parallel vocabulary.
 *
 * A statement missing the competency extension still becomes nothing: an observation must name
 * the concept it is evidence about, and guessing which one from an activity IRI is exactly the
 * kind of quiet inference that corrupts a learner's record.
 */
export interface IngestResult {
  /** Statements that carried enough to be evidence, as the family's own observation type. */
  observations: Observation[]
  /** Everything else, with the reason. Never silently discarded. */
  skipped: { statement: unknown; reason: string }[]
}

/**
 * Read a batch of statements into observations.
 *
 * Takes an array because the offline case is the normal case: a phone in a rural classroom
 * accumulates a session and flushes it when it next sees a network. Shaping this around one
 * statement at a time would have made the common path the awkward one.
 *
 * Forgiving by design. An LRS holds statements from a dozen tools that know nothing about
 * competencies, and one unreadable statement must not cost a learner a session's evidence — so
 * this never throws, and says why for each thing it could not use.
 */
export function ingest(statements: readonly unknown[]): IngestResult {
  const observations: Observation[] = []
  const skipped: IngestResult['skipped'] = []

  for (const candidate of statements) {
    const parsed = xapiStatement.safeParse(candidate)
    if (!parsed.success) {
      skipped.push({ statement: candidate, reason: 'not a well-formed xAPI statement' })
      continue
    }

    const statement = parsed.data
    const learnerId = statement.actor.account?.name
    if (learnerId === undefined) {
      // An mbox-identified actor is valid xAPI and useless here: learners are keyed by account
      // name, and inferring an identity from an email address is not something to do quietly.
      skipped.push({ statement: candidate, reason: 'actor has no account.name to identify the learner' })
      continue
    }

    const at = statement.timestamp === undefined ? undefined : Date.parse(statement.timestamp)
    if (at === undefined || Number.isNaN(at)) {
      skipped.push({
        statement: candidate,
        reason: 'no usable timestamp; evidence must be placeable in time',
      })
      continue
    }

    const extensions = (statement.context?.['extensions'] ?? {}) as Record<string, unknown>
    const skillSlug = extensions[EXTENSIONS.competency]
    if (typeof skillSlug !== 'string') {
      // Evidence must name the concept it is about. Guessing one from an activity IRI is the
      // kind of quiet inference that corrupts a record nobody can then explain.
      skipped.push({ statement: candidate, reason: 'no competency extension; nothing to fold evidence into' })
      continue
    }

    const outcome = outcomeOf(statement)
    if (outcome === undefined) {
      skipped.push({ statement: candidate, reason: 'no success or score; carries no outcome to record' })
      continue
    }

    const ksd = extensions[EXTENSIONS.ksdItem]
    const hintUsed = extensions[EXTENSIONS.hintUsed]
    const latency =
      statement.result?.duration === undefined ? undefined : fromIsoDuration(statement.result.duration)

    observations.push({
      subjectType: 'LEARNER',
      subjectId: learnerId,
      skillSlug: typeof ksd === 'string' ? ksd : skillSlug,
      outcome,
      confidence: 1,
      source: 'QUIZ',
      actor: 'SYSTEM',
      mode: 'LEARN',
      ...(statement.id !== undefined ? { attemptId: statement.id } : {}),
      ...(latency?.latencySec !== undefined ? { latencyMs: Math.round(latency.latencySec * 1000) } : {}),
      ...(hintUsed === true ? { hintsUsed: 1 } : {}),
      // `object.id` is required by the schema, so there is nothing to guard against here.
      itemKey: statement.object.id,
      at,
    })
  }

  return { observations, skipped }
}

/**
 * The outcome, in the `[0,1]` shape observations use.
 *
 * `result.success` is the common case. A scaled score is used when present and success is not,
 * because partial credit is real evidence — but a raw score is deliberately ignored: without its
 * scale it cannot be normalised, and assuming a maximum is how a 7-out-of-10 silently becomes a
 * 7-out-of-100.
 */
function outcomeOf(statement: XapiStatement): number | undefined {
  if (statement.result?.success !== undefined) return statement.result.success ? 1 : 0

  const scaled = statement.result?.score?.scaled
  if (scaled !== undefined) return Math.min(1, Math.max(0, scaled))

  return undefined
}

// ── internals ────────────────────────────────────────────────────────────────────────────

function contextExtensions(event: {
  competencyUri?: string
  ksdItemId?: string
  frameworkVersion?: string
  hintUsed?: boolean
  format?: string
}): Record<string, unknown> {
  return {
    ...(event.competencyUri !== undefined ? { [EXTENSIONS.competency]: event.competencyUri } : {}),
    ...(event.ksdItemId !== undefined ? { [EXTENSIONS.ksdItem]: event.ksdItemId } : {}),
    ...(event.frameworkVersion !== undefined
      ? { [EXTENSIONS.frameworkVersion]: event.frameworkVersion }
      : {}),
    ...(event.hintUsed !== undefined ? { [EXTENSIONS.hintUsed]: event.hintUsed } : {}),
    ...(event.format !== undefined ? { [EXTENSIONS.format]: event.format } : {}),
  }
}

/**
 * Seconds → ISO-8601 duration.
 *
 * Kept to whole and fractional seconds (`PT12.5S`) rather than decomposing into hours and
 * minutes. It is valid, every LRS parses it, and a single unit cannot be assembled wrongly —
 * `PT1M75S` is legal and means something no one intended to write.
 */
export function toIsoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError(`Duration must be a non-negative number of seconds, received ${seconds}`)
  }
  return `PT${Math.round(seconds * 1000) / 1000}S`
}

/** The inverse, for the subset we emit plus the common `PTnMnS` shape others emit. */
export function fromIsoDuration(duration: string): { latencySec?: number } {
  const match =
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      duration,
    )
  if (!match) return {}

  const [, days, hours, minutes, secs] = match
  const total =
    Number(days ?? 0) * 86_400 + Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(secs ?? 0)

  return Number.isFinite(total) ? { latencySec: total } : {}
}
