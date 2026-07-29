// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Mặt đọc theo vai — BỔ SUNG §3.4. Query API thuần, không thêm state. */

export { learningCurve, type CurvePoint } from './curve'
export { quantile, distribution, classRollup, type Distribution } from './distribution'
export { coverageReport, type CoverageReport } from './coverage'
export {
  gapReport,
  type GapReport,
  type GapReportInput,
  type GapObjective,
  type GapSummary,
  type GapStatus,
  type GapReason,
  type ObjectiveGap,
  type ConceptGap,
  type ReportMode,
  type GapExplanation,
  type GapRule,
  type Interval,
} from './gap'
export { learnerView, type LearnerViewInput, type LearnerView } from './learner'
export {
  teacherView,
  type TeacherViewInput,
  type TeacherCoverageInput,
  type TeacherView,
  type LearnerDiagnostic,
} from './teacher'
export {
  supporterView,
  type SupporterViewInput,
  type SupporterView,
  type HonestItem,
  type HonestRollup,
} from './supporter'
export {
  assessorView,
  type AssessorViewInput,
  type AssessorView,
  type DifInput,
  type DifFlag,
} from './assessor'
