// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import type { GraphData, RelType, SkillNode, ValidationIssue, ValidationReport } from '@bingoo.ai/contracts'
import type {
  CfAdoptionStatus,
  CfAssociation,
  CfAssociationType,
  CfItem,
  CfLinkUri,
  CfPackage,
} from './schema.js'

/**
 * A capability graph → CASE.
 *
 * The inverse of `decode.ts` in the graph→CASE direction, and deliberately as narrow. A CASE
 * package is a standard's OBJECTIVE overlay, so only `OBJECTIVE` nodes are written. Concepts and
 * the `MAPS_TO` edges down to them are Bingoo's own decomposition of the shared concept space — a
 * CASE consumer neither expects them nor can use them, and emitting them would present one
 * country's phrasing as if it were that shared space. An edge that touches a concept is left out.
 *
 * (It is not a *round-trip* inverse: `decode`'s relation map is many-to-one — `isPartOf` and
 * `isChildOf` both become `COMPOSES` — so a CASE package decoded then re-encoded loses that
 * distinction. The graph→CASE→graph direction, which is the one that matters here, is faithful.)
 *
 * Like `decode`, this makes every omission **visible**: what is dropped, defaulted or dangling is
 * in the returned `report`, never silent.
 */

/** Inverse of decode's RELATION_MAP — canonical direction only (decode also accepts synonyms). */
const ASSOCIATION_OF: Readonly<Partial<Record<RelType, CfAssociationType>>> = {
  COMPOSES: 'isChildOf',
  PREREQUISITE: 'precedes',
  ALIGNS: 'exactMatchOf',
  VARIANT_OF: 'isRelatedTo',
}

export interface EncodeFramework {
  readonly slug: string
  readonly title: string
  /** The locale the standard is written in. Used to pick a title from each node's localized text. */
  readonly language: string
  readonly version?: string
  readonly publisher?: string
  readonly officialSourceURL?: string
  /** Where the framework sits in its publication life — derived from the version's publish state. */
  readonly adoptionStatus?: CfAdoptionStatus
  /** The framework's subject, e.g. "Mathematics" — a registry indexes and filters on this. */
  readonly subject?: string
}

export interface EncodeInput {
  readonly framework: EncodeFramework
  readonly graph: GraphData
  /** Pure package: the caller supplies the timestamp (there is no `Date.now` here). ISO 8601. */
  readonly lastChangeDateTime: string
}

export interface EncodeResult {
  readonly package: CfPackage
  /** Every objective with no code, title falling back to a slug, dropped or dangling edge. */
  readonly report: ValidationReport
}

// CASE wants stable identifiers. A random UUID would break round-tripping and forbid a pure
// implementation (no crypto); a deterministic URN off the permanent slug is stable and readable.
const uriOf = (slug: string): string => `urn:bingoo:kc:${slug}`

export function encodeCase(input: EncodeInput): EncodeResult {
  const { framework, graph, lastChangeDateTime } = input
  const lang = framework.language
  const docUri = `urn:bingoo:framework:${framework.slug}`
  const docLink: CfLinkUri = { title: framework.title, identifier: framework.slug, uri: docUri }
  const issues: ValidationIssue[] = []

  const objectives = graph.nodes.filter((n) => n.kind === 'OBJECTIVE')
  const objSlugs = new Set(objectives.map((n) => n.slug))
  const allSlugs = new Set(graph.nodes.map((n) => n.slug))
  // Resolve each objective's title ONCE (pushing a title-fallback issue at most once), then reuse it
  // for both the CFItem and any association endpoint that points at this objective.
  const titleOf = new Map(objectives.map((n) => [n.slug, pickTitle(n, lang, issues)]))

  const CFItems: CfItem[] = objectives.map((n) =>
    toCfItem(n, titleOf.get(n.slug) ?? n.slug, lang, lastChangeDateTime, docLink, issues),
  )

  const CFAssociations: CfAssociation[] = []
  const droppedByType = new Map<string, number>()
  let dangling = 0
  let seq = 0
  for (const e of graph.edges) {
    const fromObj = objSlugs.has(e.from)
    const toObj = objSlugs.has(e.to)

    if (!fromObj || !toObj) {
      // An objective→concept edge (Bingoo's decomposition) is expected and left out silently.
      // An endpoint that is in NO node is a broken reference — reported, like decode does.
      if (!allSlugs.has(e.from) || !allSlugs.has(e.to)) dangling++
      continue
    }

    const at = ASSOCIATION_OF[e.relType ?? 'PREREQUISITE']
    if (at === undefined) {
      const key = e.relType ?? 'PREREQUISITE'
      droppedByType.set(key, (droppedByType.get(key) ?? 0) + 1)
      continue
    }

    seq += 1
    CFAssociations.push({
      // Short, stable, and safely under CFAssociation.identifier's 256-char cap (two full slugs
      // would not be): the identity of an edge is its endpoints + type, which decode reads from
      // originNodeURI/destinationNodeURI, not from this string.
      identifier: `urn:bingoo:assoc:${framework.slug}:${seq}`,
      associationType: at,
      sequenceNumber: seq,
      originNodeURI: { title: titleOf.get(e.from) ?? e.from, identifier: e.from, uri: uriOf(e.from) },
      destinationNodeURI: { title: titleOf.get(e.to) ?? e.to, identifier: e.to, uri: uriOf(e.to) },
      CFDocumentURI: docLink,
      lastChangeDateTime,
    })
  }

  if (dangling > 0) {
    issues.push({
      severity: 'warning',
      code: 'case.encode.dangling',
      message: `${dangling} edge${dangling === 1 ? '' : 's'} reference a slug not in the graph; left out.`,
      path: ['edges'],
      hint: 'A broken edge usually means the graph was built from a partial batch.',
    })
  }
  for (const [type, count] of droppedByType) {
    issues.push({
      severity: 'info',
      code: 'case.encode.no-counterpart',
      message: `Dropped ${count} "${type}" edge${count === 1 ? '' : 's'}: no CASE association counterpart.`,
      path: ['edges'],
      hint: 'CASE cannot express this relation; it stays in the Bingoo graph only.',
    })
  }

  const pkg: CfPackage = {
    CFDocument: {
      identifier: framework.slug,
      uri: docUri,
      title: framework.title,
      language: lang,
      lastChangeDateTime,
      ...(framework.version !== undefined ? { version: framework.version } : {}),
      ...(framework.publisher !== undefined ? { publisher: framework.publisher } : {}),
      ...(framework.subject !== undefined ? { subject: framework.subject } : {}),
      ...(framework.adoptionStatus !== undefined ? { adoptionStatus: framework.adoptionStatus } : {}),
      ...(framework.officialSourceURL !== undefined
        ? { officialSourceURL: framework.officialSourceURL }
        : {}),
    },
    CFItems,
    CFAssociations,
  }

  return {
    package: pkg,
    report: {
      ok: !issues.some((i) => i.severity === 'error'),
      issues,
      metrics: {
        objectives: CFItems.length,
        associations: CFAssociations.length,
        droppedEdges: [...droppedByType.values()].reduce((a, b) => a + b, 0),
        danglingEdges: dangling,
      },
    },
  }
}

function toCfItem(
  n: SkillNode,
  fullStatement: string,
  lang: string,
  lastChangeDateTime: string,
  docLink: CfLinkUri,
  issues: ValidationIssue[],
): CfItem {
  if (n.code === undefined) {
    issues.push({
      severity: 'info',
      code: 'case.encode.no-code',
      message: `Objective "${n.slug}" has no human coding scheme; a certificate cannot print a code for it.`,
      path: ['CFItems', n.slug],
    })
  }
  const localized = localizedStatements(n.title)
  return {
    identifier: n.slug,
    uri: uriOf(n.slug),
    fullStatement,
    CFItemType: 'Standard',
    CFDocumentURI: docLink,
    language: lang,
    lastChangeDateTime,
    ...(n.code !== undefined ? { humanCodingScheme: n.code } : {}),
    // CASE educationLevel is a LIST (0..*); emit the array shape the spec specifies, not a bare
    // string — so a strict consumer reads it natively instead of relying on exporter leniency.
    ...(n.stage !== undefined ? { educationLevel: [n.stage] } : {}),
    ...(n.strand !== undefined ? { conceptKeywords: [n.strand] } : {}),
    // Carry every translation we hold so the Vietnamese does not vanish behind an English
    // `fullStatement` — but only when there is more than the one canonical statement to preserve.
    ...(localized !== undefined ? { extensions: { localizedStatements: localized } } : {}),
  }
}

/**
 * The node's statement in every language it is written in, for `extensions.localizedStatements`.
 * `undefined` when only one language is present — there is nothing a single `fullStatement` loses.
 */
function localizedStatements(title: Record<string, string>): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const [language, text] of Object.entries(title)) {
    if (typeof text === 'string' && text.trim() !== '') out[language] = text
  }
  return Object.keys(out).length > 1 ? out : undefined
}

function pickTitle(n: SkillNode, lang: string, issues: ValidationIssue[]): string {
  const t = n.title
  const title = t[lang] ?? t['en'] ?? Object.values(t)[0]
  if (title === undefined) {
    issues.push({
      severity: 'warning',
      code: 'case.encode.title-fallback',
      message: `Objective "${n.slug}" has no title in "${lang}" or "en"; using the slug as fullStatement.`,
      path: ['CFItems', n.slug],
      hint: 'A CASE consumer will see a machine slug instead of the standard’s statement.',
    })
    return n.slug
  }
  return title
}
