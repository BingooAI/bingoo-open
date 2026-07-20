// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * `@bingoo.ai/codecs/xapi` — ADL xAPI, emitted and ingested.
 *
 * Emitting is strict: what we write outlives us in someone's LRS. Ingesting is forgiving: an
 * LRS holds statements from tools that know nothing about competencies, and one unreadable
 * statement must not cost a learner a session of evidence.
 */

export { xapiAgent, xapiStatement, type XapiAgent, type XapiStatement } from './schema.js'
export { ACTIVITY_TYPES, EXTENSIONS, VERBS, type VerbId } from './profile.js'
export {
  answered,
  experienced,
  fromIsoDuration,
  ingest,
  toIsoDuration,
  type Actor,
  type AttemptEvent,
  type IngestResult,
} from './statements.js'
