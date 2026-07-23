// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import type {
  CompetencyKind,
  GraphData,
  RelType,
  SkillEdge,
  SkillNode,
  ValidationIssue,
  ValidationReport,
} from '@bingoo.ai/contracts'
import { type CfAssociation, type CfItem, type CfPackage, cfPackage, nodeKey } from './schema.js'
import { slugifyPath, slugifySegment } from './slugify.js'

/**
 * CASE → a capability graph.
 *
 * Decoding is where two models meet, and they do not fit perfectly. This file's job is to make
 * every mismatch **visible** rather than to paper over it: nothing is dropped, coerced or
 * invented without an entry in the returned report.
 *
 * ## What a CASE package actually is, in our terms
 *
 * A published framework is a list of **objectives** — a standard's stated aims, with codes, in
 * a hierarchy. It is *not* a concept graph. That distinction is the whole of this file:
 *
 * - Every `CFItem` becomes a node with `kind: 'OBJECTIVE'`, carrying its `code` and `stage`.
 * - `isChildOf` becomes `COMPOSES` — a standard's hierarchy is composition, not learning order.
 * - `precedes`, where a publisher provides it, becomes `PREREQUISITE`.
 *
 * **No concepts are minted here.** Splitting an objective into the atoms it certifies is an
 * authoring act requiring judgement and a human, and doing it mechanically would produce one
 * concept per objective — which is exactly the flat, unteachable graph that importing a
 * national framework is supposed to avoid. The importer's job ends at a faithful overlay;
 * `MAPS_TO` edges down to concepts come later, from Competency Studio.
 */

/** CASE association types with no counterpart in the graph model. Reported, never dropped silently. */
const UNMAPPED_ASSOCIATIONS = new Set(['replacedBy', 'exemplar', 'hasSkillLevel'])

/**
 * How a CASE association becomes a graph edge.
 *
 * `isChildOf` → `COMPOSES` is the decision worth reading twice. A standard's tree says "1.OA.A.1
 * is part of 1.OA", which is composition. Mapping it to `PREREQUISITE` would assert that a
 * learner must master the whole domain before its first standard — an ordering nobody authored,
 * and one that would gate every learner behind everything.
 */
const RELATION_MAP: Readonly<Record<string, RelType>> = Object.freeze({
  isChildOf: 'COMPOSES',
  isPartOf: 'COMPOSES',
  precedes: 'PREREQUISITE',
  exactMatchOf: 'ALIGNS',
  isPeerOf: 'ALIGNS',
  isRelatedTo: 'VARIANT_OF',
})

export interface DecodeResult {
  graph: GraphData
  /** The framework identity the objectives belong to. */
  framework: { slug: string; title: string; language: string; version?: string }
  /** Every coercion, omission and dangling reference. Read it before trusting the graph. */
  report: ValidationReport
}

export interface DecodeOptions {
  /**
   * Slug prefix for the objectives. Defaults to `fw.<document-slug>`, following the convention
   * that a standard's nodes are namespaced away from the shared concept space — an objective is
   * one country's phrasing, not a concept.
   */
  namespace?: string
  /** Used when the package declares no language. Reported either way. */
  defaultLanguage?: string
}

export function decodeCase(input: unknown, options: DecodeOptions = {}): DecodeResult {
  const issues: ValidationIssue[] = []
  const parsed = cfPackage.safeParse(input)
  if (!parsed.success) {
    throw new CaseDecodeError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`))
  }

  const pkg: CfPackage = parsed.data
  const doc = pkg.CFDocument
  const language = doc.language ?? options.defaultLanguage ?? 'en'
  if (!doc.language) {
    issues.push({
      severity: 'warning',
      code: 'case.language.missing',
      message: `Package declares no language; assuming "${language}".`,
      path: ['CFDocument', 'language'],
      hint: 'Guessing wrong changes which content the objectives can be taught with.',
    })
  }

  const frameworkSlug = slugifyPath(doc.title)
  const namespace = options.namespace ?? `fw.${frameworkSlug}`

  // CASE identifiers are UUIDs; slugs must be readable and derived from something stable. The
  // human coding scheme is both, where a publisher provides one — `1Nc8` is what a certificate
  // will print, so it is also what the objective should be findable by.
  const slugOf = new Map<string, string>()
  for (const item of pkg.CFItems) {
    // `slugifySegment`, not `slugifyPath`: a code like `1.OA.A.1` is **one** identifier whose
    // dots are internal punctuation, not namespace boundaries. Treating them as namespaces would
    // scatter one objective across four levels and make the slug unreadable as the code it is.
    const label = item.humanCodingScheme ?? item.identifier
    const nodeSlug = `${namespace}.${slugifySegment(label)}`
    slugOf.set(item.identifier, nodeSlug)
    if (item.uri) slugOf.set(item.uri, nodeSlug)
  }

  const nodes: SkillNode[] = pkg.CFItems.map((item) => toNode(item, slugOf, doc, language))
  const documentKeys = new Set([doc.identifier, ...(doc.uri !== undefined ? [doc.uri] : [])])
  const edges = mapAssociations(pkg.CFAssociations, slugOf, documentKeys, issues)

  const ok = !issues.some((i) => i.severity === 'error')

  return {
    graph: { nodes, edges },
    framework: {
      slug: frameworkSlug,
      title: doc.title,
      language,
      ...(doc.version !== undefined ? { version: doc.version } : {}),
    },
    report: {
      ok,
      issues,
      metrics: {
        objectives: nodes.length,
        edges: edges.length,
        prerequisites: edges.filter((e) => e.relType === 'PREREQUISITE').length,
        itemsRead: pkg.CFItems.length,
      },
    },
  }
}

export class CaseDecodeError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Not a readable CASE package:\n  ${issues.join('\n  ')}`)
    this.name = 'CaseDecodeError'
  }
}

// ── internals ────────────────────────────────────────────────────────────────────────────

/**
 * One `CFItem` → one `OBJECTIVE` node.
 *
 * Everything a CASE item carries that we can hold is held, and `kind` is `OBJECTIVE` for all of
 * them without exception. A publisher's `CFItemType` — "Standard", "Domain", "Cluster" — says
 * where an item sits in *their* document, not what a learner does with it. Reading it as our
 * `kind` would let a publisher's editorial vocabulary decide which instrument measures a
 * learner, which is precisely the coupling the engine's content-agnosticism forbids.
 */
function toNode(
  item: CfItem,
  slugOf: Map<string, string>,
  doc: CfPackage['CFDocument'],
  language: string,
): SkillNode {
  const nodeSlug = slugOf.get(item.identifier) ?? item.identifier

  return {
    slug: nodeSlug,
    // The canonical statement is the document's language; any translations the exporter carried in
    // `extensions.localizedStatements` are layered on so a re-import keeps the Vietnamese it shipped.
    title: { [language]: item.fullStatement, ...readLocalizedStatements(item.extensions) },
    kind: 'OBJECTIVE' satisfies CompetencyKind,
    altitude: 'outcome',
    ...(item.humanCodingScheme !== undefined ? { code: item.humanCodingScheme } : {}),
    // `stage` is legal here precisely because these are objectives — a concept could not carry
    // one. Educational level is a standard's own framing of who it is for.
    ...(stageOf(item) !== undefined ? { stage: stageOf(item) } : {}),
    ...(item.conceptKeywords !== undefined && item.conceptKeywords.length > 0
      ? { strand: item.conceptKeywords[0] }
      : {}),
    source: doc.officialSourceURL ?? doc.title,
    version: 1,
  }
}

/**
 * The extra translations an exporter stashed under `extensions.localizedStatements` (lang →
 * statement). Read defensively: extensions is an open bag of `unknown`, and a package from another
 * tool may put anything there — a non-object, or non-string values — none of which may crash import.
 */
function readLocalizedStatements(extensions: Record<string, unknown> | undefined): Record<string, string> {
  if (extensions === undefined) return {}
  const bag = extensions['localizedStatements']
  if (bag === null || typeof bag !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [language, text] of Object.entries(bag as Record<string, unknown>)) {
    if (typeof text === 'string' && text.trim() !== '') out[language] = text
  }
  return out
}

function stageOf(item: CfItem): string | undefined {
  const level = item.educationLevel
  if (level === undefined) return undefined
  return Array.isArray(level) ? level.join(', ') : level
}

function mapAssociations(
  associations: readonly CfAssociation[],
  slugOf: Map<string, string>,
  documentKeys: ReadonlySet<string>,
  issues: ValidationIssue[],
): SkillEdge[] {
  const edges: SkillEdge[] = []
  const dropped = new Map<string, number>()

  for (const association of associations) {
    const type = association.associationType
    if (UNMAPPED_ASSOCIATIONS.has(type)) {
      dropped.set(type, (dropped.get(type) ?? 0) + 1)
      continue
    }

    const originKey = nodeKey(association.originNodeURI)
    const destinationKey = nodeKey(association.destinationNodeURI)
    if (originKey === undefined || destinationKey === undefined) {
      issues.push({
        severity: 'warning',
        code: 'case.association.unresolvable',
        message: `Association ${association.identifier} has an endpoint with neither identifier nor uri.`,
        path: ['CFAssociations', association.identifier],
      })
      continue
    }

    // `isChildOf` pointing at the CFDocument marks a **root item** — one whose parent is the
    // framework itself. Structure, not a broken reference; the real Common Core package uses it
    // for its top-level categories. There is no node for the framework, so the edge is dropped.
    const from = slugOf.get(originKey)
    if (documentKeys.has(destinationKey)) {
      if (from === undefined) {
        issues.push({
          severity: 'warning',
          code: 'case.association.dangling',
          message: `Association ${association.identifier} originates from an item not in this package.`,
          path: ['CFAssociations', association.identifier],
        })
      }
      continue
    }

    const to = slugOf.get(destinationKey)
    if (from === undefined || to === undefined) {
      issues.push({
        severity: 'warning',
        code: 'case.association.dangling',
        message: `Association ${association.identifier} references an item not in this package.`,
        path: ['CFAssociations', association.identifier],
        hint: 'Cross-framework edges need the other package loaded; treat them as alignment instead.',
      })
      continue
    }

    const relType = RELATION_MAP[type]
    if (relType === undefined) {
      dropped.set(type, (dropped.get(type) ?? 0) + 1)
      continue
    }

    edges.push({
      // CASE hierarchy is composition and never gates: a learner is not blocked from a standard
      // because they have not finished the domain containing it. An imported `precedes` is a soft
      // ordering too: RECOMMENDED, never REQUIRED. A foreign standard we do not ourselves teach must
      // not hard-lock a learner — CASE carries no gate strength, so importing one as REQUIRED would
      // invent a wall nobody authored. (Project decision: `precedes` → RECOMMENDED on import; a gate's
      // real strength is a Bingoo authoring act, re-derived in the studio, not read off a CASE file.)
      from,
      to,
      relType,
      mode: 'RECOMMENDED',
      weight: 1,
    })
  }

  // One line per type, not per edge: a framework with 412 `exemplar` edges should produce
  // something a human reads, not 412 lines they scroll past.
  for (const [type, count] of dropped) {
    issues.push({
      severity: 'info',
      code: 'case.association.unmapped',
      message: `Dropped ${count} "${type}" association${count === 1 ? '' : 's'}: no counterpart in the graph model.`,
      path: ['CFAssociations'],
      hint: 'These carry editorial provenance rather than learning structure.',
    })
  }

  return edges
}
