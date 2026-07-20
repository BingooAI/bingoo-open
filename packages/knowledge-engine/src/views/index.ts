/** Mặt đọc theo vai — BỔ SUNG §3.4. Query API thuần, không thêm state. */

export { learningCurve, type CurvePoint } from './curve';
export { quantile, distribution, classRollup, type Distribution } from './distribution';
export { coverageReport, type CoverageReport } from './coverage';
export { learnerView, type LearnerViewInput, type LearnerView } from './learner';
export {
  teacherView,
  type TeacherViewInput,
  type TeacherCoverageInput,
  type TeacherView,
  type LearnerDiagnostic,
} from './teacher';
export {
  supporterView,
  type SupporterViewInput,
  type SupporterView,
  type HonestItem,
  type HonestRollup,
} from './supporter';
export {
  assessorView,
  type AssessorViewInput,
  type AssessorView,
  type DifInput,
  type DifFlag,
} from './assessor';
