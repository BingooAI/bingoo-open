// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * @bingoo.ai/authored-item — lớp neo nối primitive nội dung (@bingoo.ai/core) vào knowledge-engine.
 * Bọc quanh quiz/content/draw của core, KHÔNG sửa core. Xem docs/CONTENT-ARCHITECTURE.md §4–§5.
 */

export type { AuthoredItem, Grade, Grader, GraderKind } from './model'
export {
  primitiveMeta,
  isKnownPrimitive,
  blockKind,
  manipKind,
  listPrimitives,
  listBlockTypes,
  BLOCK_PREFIX,
  MANIP_PREFIX,
  QUIZ_PRIMITIVE_KINDS,
  type PrimitiveMeta,
} from './registry'
export { compileItem, compileBank, isMeasurable, type CompiledBank } from './compile'
export { toVerdict, gradeItem, quizGrader, manipGrader, itemSubmission } from './grade'
export { validateItem, validateBank, type ItemIssue } from './validate'
export { primitiveDisplay, type PrimitiveDisplay, type PrimitiveLoc } from './primitive-display'
export {
  mediaTargets,
  mediaDedupKey,
  applyMediaAsset,
  resolveMediaTargets,
  type MediaKind,
  type MediaTarget,
  type MediaPolicy,
  type ResolveResult,
} from './media'
