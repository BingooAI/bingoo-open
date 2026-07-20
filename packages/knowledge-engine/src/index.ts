/**
 * @bingoo/knowledge-engine — lõi học thuật thuần (Capability · Evidence · Adaptive).
 *
 * Barrel công khai. Lõi content-agnostic: đầu vào là Observation + tập ứng viên trừu
 * tượng; kho câu hỏi/nội dung/lớp học nằm ngoài lõi (SPEC §0). Xem ENGINE-LOI-HOC-THUAT-SPEC.md
 * và ENGINE-THIET-KE-BO-SUNG.md.
 */

// Enums miền (SPEC §1.1, BỔ SUNG §3)
export type {
  CompetencyKind,
  PrereqMode,
  RelType,
  FrameworkKind,
  FrameworkReleaseType,
  FrameworkVersionStatus,
  EvidenceSource,
  ObservationSubject,
  AssessmentMode,
  DreyfusLevel,
  EvidenceActor,
} from './domain';
export { LEARNABLE_KINDS, ORDERING_RELS, EVIDENCE_ACTORS, isOrdering } from './domain';

// Kiểu dữ liệu biên (data contracts)
export type {
  Slug,
  Elo,
  Millis,
  Awaitable,
  SkillNode,
  SkillEdge,
  GraphData,
  SkillStateView,
  SkillSnapshot,
  Candidate,
  RubricCriterion,
  Submission,
  Verdict,
  RaterProfile,
  EvidenceInput,
  PrerequisiteRef,
  CompetencyAnchor,
  RelevanceSeeds,
  ItemStat,
} from './contracts';

// Cổng adapter (SPEC Phụ lục B + BỔ SUNG §3.2, §3.3)
export type {
  GraphSourcePort,
  CandidatePort,
  EncounteredPort,
  RelevanceScopePort,
  CompetencyAnchorPort,
  PrerequisitePort,
  ItemStatPort,
  RaterProfilePort,
  GraderPort,
  EnginePorts,
} from './ports';

// Policy (BỔ SUNG §4)
export type {
  BktParams,
  EloParams,
  MasteryParams,
  DreyfusParams,
  ConfidenceParams,
  BetaParams,
  SequencingParams,
  ReviewParams,
  EvidenceWriteRule,
  EvidenceWriteMatrix,
  EvidenceParams,
  CertifyParams,
  EnginePolicy,
  DeepPartial,
} from './policy';
export {
  DEFAULT_POLICY,
  SEQUENCING_UNSEEN_PRIOR,
  REPORTING_UNSEEN_PRIOR,
  resolvePolicy,
  validatePolicy,
} from './policy';

// Mastery core (SPEC §3–§5, §8.1) — hàm thuần
export {
  DAY_MS,
  LN2,
  clamp01,
  clamp,
  shrink,
  mean,
  bktForget,
  bktUpdate,
  expectedScore,
  eloUpdate,
  freshMastery,
  observe,
  observeAll,
  scoreRubric,
  betaPosterior,
  interpolateConfidence,
  dreyfusSignals,
  deriveLevel,
  reviewUrgency,
} from './mastery/index';
export type {
  BktUpdateOpts,
  EloUpdateOpts,
  EloResult,
  SkillMastery,
  Observation,
  ObserveParams,
  RubricScore,
  BetaPosterior,
  ConfidenceInput,
  DreyfusObservation,
  DreyfusSignals,
  LevelInput,
} from './mastery/index';

// Graph core (SPEC Phụ lục A, §6–§7) — hàm thuần
export {
  SkillGraph,
  buildGraph,
  findOrderingCycle,
  compositeMastery,
  effectiveMastery,
  kpMastery,
  nodeMastery,
  aggregate,
  frontier,
  frontierComposite,
  isMastered,
  isReady,
  pathTo,
  gapsTo,
  remediationFor,
  prereqGate,
  competencyMetFactory,
  expandRelevance,
} from './graph/index';
export type {
  BuildOpts,
  WeightedNode,
  MasteryLike,
  MasteryStates,
  CompositeOpts,
  NodeMasteryResult,
  AggregateMember,
  AggregateResult,
  FrontierNode,
  Remediation,
  PrereqCheck,
  PrereqGateResult,
} from './graph/index';

// Evidence layer (BỔ SUNG §3) — cửa ghi có bảo vệ
export {
  validateEvidenceWrite,
  raterWeight,
  raterWeightParams,
  toObservations,
  shouldSnapshot,
  recordEvidence,
  dedupeAttempt,
} from './evidence/index';
export type {
  EvidenceViolation,
  WriteCheck,
  RaterWeightParams,
  EvidenceContext,
  FoldParams,
  RecordResult,
} from './evidence/index';

// Sequencer (SPEC §8) — chọn hoạt động thích ứng
export {
  fnv1a32,
  dayRank,
  abilityFromStates,
  isEligible,
  scoreItem,
  buildPriority,
  dueForReview,
  selectAdaptiveSession,
  declumpByKind,
  selectNextItem,
} from './sequencer/index';
export type {
  AbilityOf,
  DueItem,
  SessionContext,
  SessionOpts,
  NextItemContext,
  NextItemOpts,
} from './sequencer/index';

// Framework & migration (SPEC §9–§10) — change-set thuần
export {
  compareSemver,
  nextSemver,
  formatSemver,
  slugForVersion,
  cloneObjectivesForward,
  crosswalk,
  repointTags,
  resolveCourseVersion,
  migrationPolicy,
  shouldAutoDrift,
  inheritState,
  splitFactor,
  mergeStates,
} from './framework/index';
export type {
  Semver,
  ForwardRelType,
  SourceObjective,
  LateralEdgeRef,
  ClonedObjective,
  ClonedEdge,
  ClonePlan,
  VersionObjective,
  Crosswalk,
  MigrationPolicy,
} from './framework/index';

// Certify (SPEC §12) — đo lường chứng chỉ
export {
  thetaFromElo,
  betaFromElo,
  pCorrectRasch,
  cutScore,
  flagDIF,
  measuredStates,
  certifyFramework,
} from './certify/index';
export type {
  CutScoreResult,
  DifResult,
  MeasureObservation,
  MeasuredState,
  CertifyObjective,
  ObjectiveResult,
  CertifyReport,
  CertifyOpts,
} from './certify/index';

// Views theo vai (BỔ SUNG §3.4) — query API thuần
export {
  learningCurve,
  quantile,
  distribution,
  classRollup,
  coverageReport,
  learnerView,
  teacherView,
  supporterView,
  assessorView,
} from './views/index';
export type {
  CurvePoint,
  Distribution,
  CoverageReport,
  LearnerViewInput,
  LearnerView,
  TeacherViewInput,
  TeacherCoverageInput,
  TeacherView,
  LearnerDiagnostic,
  SupporterViewInput,
  SupporterView,
  HonestItem,
  HonestRollup,
  AssessorViewInput,
  AssessorView,
  DifInput,
  DifFlag,
} from './views/index';
