// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * @bingoo.ai/authoring — pipeline biên soạn: nguồn thô (PDF/ảnh/sách) → khung năng lực chuẩn.
 *
 * Lõi THUẦN (slug, trigram, dedup, compile, validate, review) testable không cần LLM;
 * LLM/vision đặt sau ports. Đầu ra khớp GraphData + Framework mà engine đã nhận.
 * Xem docs/AUTHORING-PIPELINE.md.
 */

export type {
  LocalizedText,
  SourceChunk,
  RawSource,
  EvidenceRef,
  ConceptDraft,
  EdgeDraft,
  ObjectiveDraft,
  FrameworkDraft,
  IngestDraft,
  ExistingConcept,
} from './model'
export type {
  ConceptCandidate,
  EdgeCandidate,
  VisionPort,
  ConceptExtractorPort,
  EdgeProposerPort,
  EmbeddingPort,
  AuthoringPorts,
} from './ports'

export { slugify, mintSlug, canonicalTitle } from './slug'
export { verifyQuote, normalizeSource, foldForMatch, type QuoteMatch, type QuoteStatus } from './quote'
export {
  locateInUnits,
  type SourceLocator,
  type Rect,
  type PositionedUnit,
  type Anchor,
  type MatchQuality,
} from './anchor'
export { explainRelation, type RelationExplanation, type RelationBasis } from './relation-explain'
export {
  explainClaim,
  compareFacetAxes,
  type ClaimKind,
  type ClaimTier,
  type ClaimBasis,
  type ClaimInput,
  type ClaimExplanation,
  type ContradictedBy,
  type FacetAgreement,
  type AxisAgreement,
  type FuzzySimilarity,
} from './claim-explain'
export {
  applyCollisionDecisions,
  type CollisionDecision,
  type DistinguishAxis,
  type AppliedDecision,
  type RejectedDecision,
  type ResolveResult,
} from './resolve-collision'
export { trigrams, diceSimilarity } from './trigram'
export { dedupeConcepts, type DedupResult, type Merge } from './dedup'
export { compileDraft, type CompiledFramework, type CompiledObjective } from './compile'
export { validateDraft, hasBlockingIssue, type DraftIssue, type IssueSeverity } from './validate'
export { applyReview, type ReviewDecision } from './review'
export { runIngest } from './pipeline'
export {
  checkInvariants,
  hasBlockingViolation,
  type Violation,
  type InvariantCode,
  type InvariantOpts,
} from './invariants'
export {
  structuralVerdict,
  proposeAlignment,
  compareScope,
  requiresHuman,
  type AlignVerdict,
  type AlignDecision,
  type AlignProposal,
  type ExistingKc,
  type NewConcept,
} from './alignment'
