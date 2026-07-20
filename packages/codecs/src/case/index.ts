// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * `@bingoo.ai/codecs/case` — 1EdTech CASE, read and written.
 *
 * The standard owns the grammar; `@bingoo.ai/contracts` owns the shape the family exchanges.
 * This subpath is the translation between them, and every place the two do not fit is
 * reported rather than smoothed over.
 */

export { decodeCase, CaseDecodeError, type DecodeOptions, type DecodeResult } from './decode.js'
export {
  cfAssociation,
  cfAssociationType,
  cfDocument,
  cfItem,
  cfLinkUri,
  cfPackage,
  nodeKey,
  type CfAssociation,
  type CfAssociationType,
  type CfDocument,
  type CfItem,
  type CfLinkUri,
  type CfPackage,
} from './schema.js'
export { slugifyPath, slugifySegment } from './slugify.js'
