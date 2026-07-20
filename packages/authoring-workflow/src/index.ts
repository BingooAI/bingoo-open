/**
 * @bingoo.ai/authoring-workflow — máy trạng thái pipeline biên soạn S1→S7.
 * Chia nhỏ · phê duyệt · tái sinh · tự STALE khi thượng nguồn đổi. Thuần TS.
 * Xem docs/KE-HOACH-AUTHORING.md, docs/KE-HOACH-CONTENT.md.
 */
export type { Stage, StepStatus, StepEvent, PipelineStep } from './model'
export { STAGE_ORDER } from './model'
export {
  applyEvent,
  propagateStale,
  pinToParents,
  gateToStage,
  pipelineHealth,
  WorkflowError,
  type PipelineHealth,
} from './machine'
