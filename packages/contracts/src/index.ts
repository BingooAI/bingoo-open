// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * `@bingoo.ai/contracts` — the shared I/O contract for the Bingoo framework family.
 *
 * Every repo imports from here; this package imports from nobody. It is the root of the
 * dependency graph and has no outgoing edges by design.
 *
 * The model is the one established in the knowledge-engine line — two orthogonal axes, mastery
 * only at atomic concepts, ordering versus lateral relations, one shared concept graph beneath
 * every standard. See ADR 0004 for why, and RFC 0001 for what it replaced.
 */

// ── Identity ─────────────────────────────────────────────────────────────────────────────
export {
  code,
  elo,
  formatRef,
  id,
  itemRef,
  languageTag,
  learnerId,
  license,
  lifecycle,
  localizedText,
  methodRef,
  millis,
  semver,
  semverParts,
  slug,
  timestamp,
  unitInterval,
  uri,
  type Code,
  type Elo,
  type FormatRef,
  type Id,
  type ItemRef,
  type LanguageTag,
  type LearnerId,
  type License,
  type Lifecycle,
  type LocalizedText,
  type MethodRef,
  type Millis,
  type Semver,
  type SemverParts,
  type Slug,
  type Timestamp,
  type UnitInterval,
  type Uri,
} from './refs.js'

// ── The capability graph ─────────────────────────────────────────────────────────────────
export {
  ORDERING_RELS,
  LEARNABLE_KINDS,
  altitude,
  competencyAnchor,
  competencyKind,
  dreyfusLevel,
  graphData,
  isLearnable,
  isOrdering,
  prereqMode,
  prerequisiteRef,
  relType,
  skillEdge,
  skillNode,
  type Altitude,
  type CompetencyAnchor,
  type CompetencyKind,
  type DreyfusLevel,
  type GraphData,
  type PrereqMode,
  type PrerequisiteRef,
  type RelType,
  type SkillEdge,
  type SkillNode,
} from './competency.js'

// ── Concept identity ─────────────────────────────────────────────────────────────────────
export {
  FACET_AXES,
  HUMAN_REQUIRED_VERDICTS,
  alignVerdict,
  alignmentProposal,
  bloom,
  domainProfile,
  facetAxis,
  facets,
  fluency,
  requiresHuman,
  transfer,
  type AlignVerdict,
  type AlignmentProposal,
  type Bloom,
  type DomainProfile,
  type FacetAxis,
  type Facets,
  type Fluency,
  type Transfer,
} from './facets.js'

// ── Standards overlay ────────────────────────────────────────────────────────────────────
export {
  framework,
  frameworkKind,
  frameworkReleaseType,
  frameworkReport,
  frameworkVersion,
  frameworkVersionStatus,
  objectiveReport,
  objectiveStatus,
  type Framework,
  type FrameworkKind,
  type FrameworkReleaseType,
  type FrameworkReport,
  type FrameworkVersion,
  type FrameworkVersionStatus,
  type ObjectiveReport,
  type ObjectiveStatus,
} from './framework.js'

// ── Evidence and what is derived from it ─────────────────────────────────────────────────
export {
  assessmentMode,
  candidate,
  evidenceActor,
  evidenceSource,
  explanation,
  explanationAudience,
  explanationPart,
  gap,
  itemStat,
  measurementMethod,
  methodFor,
  observation,
  observationSubject,
  skillSnapshot,
  skillState,
  type AssessmentMode,
  type Candidate,
  type EvidenceActor,
  type EvidenceSource,
  type Explanation,
  type ExplanationAudience,
  type ExplanationPart,
  type Gap,
  type ItemStat,
  type MeasurementMethod,
  type Observation,
  type ObservationSubject,
  type SkillSnapshot,
  type SkillState,
} from './evidence.js'

// ── Content (→ QTI / C2PA) ───────────────────────────────────────────────────────────────
export {
  c2paManifest,
  competencyTag,
  contentPackage,
  explainerAsset,
  item,
  itemShape,
  mediaRef,
  qtiItem,
  response,
  responseKind,
  reviewRecord,
  type C2paManifest,
  type CompetencyTag,
  type ContentPackage,
  type ExplainerAsset,
  type Item,
  type ItemShape,
  type MediaRef,
  type QtiItem,
  type Response,
  type ResponseKind,
  type ReviewRecord,
} from './content.js'

// ── Teaching ─────────────────────────────────────────────────────────────────────────────
export {
  assessmentPlan,
  autonomy,
  contentRequirement,
  differentiationBranch,
  groupAssignment,
  interactionDesign,
  methodLevel,
  moveAction,
  pedagogicalMove,
  planNode,
  planScope,
  teachingMethod,
  teachingPlan,
  type AssessmentPlan,
  type Autonomy,
  type ContentRequirement,
  type DifferentiationBranch,
  type GroupAssignment,
  type InteractionDesign,
  type MethodLevel,
  type MoveAction,
  type PedagogicalMove,
  type PlanNode,
  type PlanScope,
  type TeachingMethod,
  type TeachingPlan,
} from './pedagogy.js'

// ── Learning formats ─────────────────────────────────────────────────────────────────────
export {
  formatKind,
  learningFormat,
  socialForm,
  teachingStep,
  wellbeingPolicy,
  type FormatKind,
  type LearningFormat,
  type SocialForm,
  type TeachingStep,
  type WellbeingPolicy,
} from './format.js'

// ── Summative assessment ─────────────────────────────────────────────────────────────────
export {
  assessmentTest,
  blueprintCell,
  credential,
  grade,
  gradedBy,
  testBlueprint,
  type AssessmentTest,
  type BlueprintCell,
  type Credential,
  type Grade,
  type GradedBy,
  type TestBlueprint,
} from './assessment.js'

// ── Portable profile ─────────────────────────────────────────────────────────────────────
export { learnerProfile, profileEntry, type LearnerProfile, type ProfileEntry } from './profile.js'

// ── Explainability, validation, moderation ───────────────────────────────────────────────
export {
  moderationVerdict,
  severity,
  suggestion,
  suggestionEvidence,
  suggestionStatus,
  validationIssue,
  validationReport,
  type ModerationVerdict,
  type Severity,
  type Suggestion,
  type SuggestionEvidence,
  type SuggestionStatus,
  type ValidationIssue,
  type ValidationReport,
} from './xai.js'

// ── Cross-repo ports ─────────────────────────────────────────────────────────────────────
export type {
  CandidateProvider,
  FrameworkProvider,
  GateProvider,
  GraphProvider,
  MasteryProvider,
  ModelGateway,
  ObservationProvider,
  ObservationSink,
  Page,
  Repository,
} from './providers.js'

/**
 * The contract version — the family's compatibility marker.
 *
 * Bumped to 2 by the model change in ADR 0004. Distinct from the npm version, which also moves
 * for documentation; this one changes only when the shapes stop being mutually readable.
 */
export const CONTRACT_VERSION = 2 as const
