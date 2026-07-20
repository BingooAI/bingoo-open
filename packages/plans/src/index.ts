/**
 * @bingoo/plans — Instruction Plan (khung chuẩn) + KP + planQuality.
 * Tầng ② của kiến trúc nội dung; thuần TS, neo vào @bingoo/knowledge-engine.
 * Xem docs/CONTENT-ARCHITECTURE.md, docs/GIAO-AN-MAU.md.
 */

export type {
  LocalizedText,
  Misconception,
  Representation,
  SuccessCriterion,
  HintStrategy,
  KnowledgePoint,
  ActivityPlan,
  BlueprintEntry,
  PlanRubricCriterion,
  AssessmentPlan,
  LessonStep,
  KcArc,
  LearnerState,
  StepDeliveryKind,
  LessonInstructionPlan,
  UnitPlan,
  CoursePlan,
} from './model'
export {
  planQuality,
  hasBlockingIssue,
  type PlanIssue,
  type PlanIssueCode,
  type PlanQuality,
} from './quality'
export { courseLessonTeaches, collectAssessments, assessmentObjectives } from './compile'
export { lessonStepWork, stepEmitsBankItems, stepServesState, stepsForState, type StepWork } from './worklist'
export type { CoursePlanDoc, CourseUnitBrief, UnitPlanDoc, UnitLessonBrief } from './hierarchy'
export {
  coursePlanQuality,
  unitPlanQuality,
  type HierIssue,
  type HierIssueCode,
  type HierQuality,
} from './hierarchy-quality'
