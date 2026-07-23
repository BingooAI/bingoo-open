// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'

/**
 * The CASE wire format, as 1EdTech specifies it.
 *
 * **This file describes their format, not ours.** Where our model and the specification
 * disagree, we are wrong — so nothing here is shaped for the convenience of
 * `@bingoo.ai/contracts`. The translation happens in `decode.ts` and `encode.ts`, on purpose,
 * so that the seam between "what the standard says" and "what we do with it" is visible in
 * the file listing.
 *
 * CASE 1.1 (Competencies and Academic Standards Exchange). A package is a `CFDocument`
 * describing the framework, a flat list of `CFItem` nodes, and a list of `CFAssociation`
 * edges between them. There is no nesting in the wire format: hierarchy is expressed by
 * `isChildOf` associations, which is why decoding has to rebuild the tree.
 *
 * ## Held loosely, deliberately
 *
 * Published frameworks in the wild are inconsistent. Fields the specification marks required
 * are sometimes absent; identifiers that should be UUIDs are sometimes not; `educationLevel`
 * arrives as a string where an array is specified. Rejecting a real published framework
 * because it offends us is a worse failure than accepting an odd-looking one — "works with
 * the CASE Network" is a claim this package has to be able to make.
 *
 * So: only `identifier` and `fullStatement` are genuinely enforced on an item, because
 * without them there is nothing to reference and nothing to display. Everything else is
 * optional and passed through.
 */

/**
 * A CASE reference to another node. Appears wherever the format points at something.
 *
 * All three fields are optional in practice even though the specification implies otherwise:
 * some exporters emit only `uri`, others only `identifier`. Resolution tries both.
 */
export const cfLinkUri = z
  .object({
    title: z.string().max(2000).optional(),
    identifier: z.string().max(256).optional(),
    uri: z.string().max(2048).optional(),
  })
  .loose()
export type CfLinkUri = z.infer<typeof cfLinkUri>

/**
 * The association vocabulary, exactly as CASE defines it.
 *
 * We do not extend this list. An association type outside it is not a CASE association, and
 * inventing one would produce packages that other CASE consumers silently misread — the
 * failure mode interoperability exists to prevent.
 *
 * Note `isChildOf` points *from* the child *to* the parent, and `precedes` points from the
 * earlier item to the later one. Both are easy to get backwards; `decode.ts` has the tests.
 */
export const cfAssociationType = z.enum([
  'isChildOf',
  'isPeerOf',
  'isPartOf',
  'exactMatchOf',
  'precedes',
  'isRelatedTo',
  'replacedBy',
  'exemplar',
  'hasSkillLevel',
])
export type CfAssociationType = z.infer<typeof cfAssociationType>

/** Where a framework sits in its publication life. CASE's vocabulary, not ours. */
export const cfAdoptionStatus = z.enum(['Draft', 'Adopted', 'Deprecated'])
export type CfAdoptionStatus = z.infer<typeof cfAdoptionStatus>

export const cfDocument = z
  .object({
    identifier: z.string().min(1).max(256),
    uri: z.string().max(2048).optional(),
    title: z.string().min(1).max(2000),
    creator: z.string().max(2000).optional(),
    publisher: z.string().max(2000).optional(),
    description: z.string().max(20_000).optional(),
    /** CASE specifies an array; some exporters emit a bare string. `decode` normalises. */
    subject: z.union([z.string(), z.array(z.string())]).optional(),
    subjectURI: z.array(cfLinkUri).optional(),
    language: z.string().max(35).optional(),
    version: z.string().max(64).optional(),
    adoptionStatus: cfAdoptionStatus.optional(),
    statusStartDate: z.string().max(64).optional(),
    statusEndDate: z.string().max(64).optional(),
    licenseURI: cfLinkUri.optional(),
    notes: z.string().max(20_000).optional(),
    officialSourceURL: z.string().max(2048).optional(),
    lastChangeDateTime: z.string().max(64).optional(),
  })
  .loose()
export type CfDocument = z.infer<typeof cfDocument>

/**
 * One node: a standard, a competency, or — in our packages — a KSD component.
 *
 * `CFItemType` is a free string in CASE, not an enum. Publishers use "Standard",
 * "Competency", "Domain", "Cluster", "Grade Level" and much else. We read it as a hint and
 * never branch on it for correctness; see `KSD_ITEM_TYPES` in `encode.ts` for the one place
 * we write it with intent.
 */
export const cfItem = z
  .object({
    identifier: z.string().min(1).max(256),
    uri: z.string().max(2048).optional(),
    /** The human-facing code, e.g. `1.SL.2` or `CCSS.MATH.CONTENT.1.OA.A.1`. */
    humanCodingScheme: z.string().max(256).optional(),
    listEnumeration: z.string().max(64).optional(),
    abbreviatedStatement: z.string().max(2000).optional(),
    /** The only field that must be present to be usable: it is what a human reads. */
    fullStatement: z.string().min(1).max(20_000),
    alternativeLabel: z.string().max(2000).optional(),
    CFItemType: z.string().max(256).optional(),
    CFItemTypeURI: cfLinkUri.optional(),
    CFDocumentURI: cfLinkUri.optional(),
    educationLevel: z.union([z.string(), z.array(z.string())]).optional(),
    conceptKeywords: z.array(z.string().max(256)).optional(),
    language: z.string().max(35).optional(),
    notes: z.string().max(20_000).optional(),
    lastChangeDateTime: z.string().max(64).optional(),
    /**
     * The bag CASE reserves for exporter-specific data (`.loose()` already lets it through; this
     * only names it in the type). `fullStatement` can hold one language — the document's — so a
     * Vietnamese teacher reading an English framework, or a re-import, would lose every other
     * translation we actually have. We stash them under `localizedStatements` (lang → statement).
     * A consumer that ignores extensions still reads the canonical `fullStatement`: the CASE
     * interchange contract is unbroken, and the extra languages ride along for those who want them.
     */
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .loose()
export type CfItem = z.infer<typeof cfItem>

export const cfAssociation = z
  .object({
    identifier: z.string().min(1).max(256),
    uri: z.string().max(2048).optional(),
    associationType: cfAssociationType,
    /** The subject of the relationship — the child, or the earlier item. */
    originNodeURI: cfLinkUri,
    /** The object — the parent, or the later item. */
    destinationNodeURI: cfLinkUri,
    CFDocumentURI: cfLinkUri.optional(),
    sequenceNumber: z.number().optional(),
    lastChangeDateTime: z.string().max(64).optional(),
  })
  .loose()
export type CfAssociation = z.infer<typeof cfAssociation>

/**
 * A complete CASE package — what a registry serves and a school downloads.
 *
 * `CFItems` and `CFAssociations` default to empty rather than being required: a document with
 * no items is a legitimate, if useless, package, and failing to parse it would tell an
 * operator less than accepting it and reporting that it is empty.
 */
export const cfPackage = z
  .object({
    CFDocument: cfDocument,
    CFItems: z.array(cfItem).default([]),
    CFAssociations: z.array(cfAssociation).default([]),
    CFDefinitions: z.record(z.string(), z.unknown()).optional(),
    CFRubrics: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .loose()
export type CfPackage = z.infer<typeof cfPackage>

/**
 * Resolve a `CFLinkURI` to the key the rest of the codec indexes on.
 *
 * `identifier` wins over `uri` because associations reference items by identifier far more
 * consistently than by URI in real packages. Returning `undefined` rather than throwing lets
 * the caller decide whether a dangling reference is fatal — during decode it is not, because
 * a package with one broken edge is still worth reading.
 */
export function nodeKey(link: CfLinkUri | undefined): string | undefined {
  if (!link) return undefined
  return link.identifier ?? link.uri
}
