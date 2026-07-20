/** Chuyển trạng thái + lan truyền STALE cho pipeline biên soạn. Thuần, tất định. */

import type { PipelineStep, Stage, StepEvent, StepStatus } from './model'
import { STAGE_ORDER } from './model'

/** Bảng chuyển hợp lệ: status hiện tại + event → status kế. Thiếu = chuyển bất hợp lệ. */
const TABLE: Partial<Record<StepStatus, Partial<Record<StepEvent, StepStatus>>>> = {
  draft: { generate: 'generating' },
  generating: { complete: 'needs_review', fail: 'failed' },
  needs_review: { approve: 'approved', reject: 'draft' },
  approved: { regenerate: 'generating', invalidate: 'stale' },
  stale: { generate: 'generating', invalidate: 'stale' },
  failed: { generate: 'generating' },
  // needs_review/draft cũng có thể bị invalidate khi thượng nguồn đổi:
}

// invalidate áp cho mọi status trừ khi đang generating (đang chạy thì để chạy xong).
const INVALIDATABLE: readonly StepStatus[] = ['draft', 'needs_review', 'approved', 'failed', 'stale']

export class WorkflowError extends Error {}

/** Áp 1 event lên 1 step → step mới. Ném WorkflowError nếu chuyển bất hợp lệ. */
export function applyEvent(step: PipelineStep, event: StepEvent): PipelineStep {
  if (event === 'invalidate') {
    if (step.status === 'generating') return step // đang chạy: bỏ qua
    if (INVALIDATABLE.includes(step.status)) return { ...step, status: 'stale' }
  }
  const next = TABLE[step.status]?.[event]
  if (next === undefined) {
    throw new WorkflowError(`Chuyển bất hợp lệ: ${step.status} --${event}--> ? (step ${step.id})`)
  }
  // approve = chốt bản mới → bump version (hạ nguồn ghim theo số này).
  if (event === 'approve') return { ...step, status: next, version: step.version + 1 }
  return { ...step, status: next }
}

/** Version "hiệu lực" của 1 step = version nếu đã approved, ngược lại không tính (chưa chốt). */
function approvedVersion(step: PipelineStep): number | undefined {
  return step.status === 'approved' ? step.version : undefined
}

/**
 * Lan truyền STALE: step nào tiêu thụ 1 parent đã approved ở version MỚI hơn builtFrom → stale.
 * Chạy tới điểm cố định để lan qua nhiều tầng (framework đổi → plans stale → content stale).
 */
export function propagateStale(steps: readonly PipelineStep[]): PipelineStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const out = steps.map((s) => ({ ...s }))
  const outById = new Map(out.map((s) => [s.id, s]))

  let changed = true
  while (changed) {
    changed = false
    for (const s of out) {
      if (s.status === 'generating' || s.status === 'stale') continue
      for (const pid of s.parents) {
        const parent = outById.get(pid) ?? byId.get(pid)
        if (!parent) continue
        const pv = approvedVersion(parent)
        const consumed = s.builtFrom[pid]
        // parent đã chốt bản mới hơn bản mà step này đã dùng → lệch → stale.
        if (pv !== undefined && consumed !== undefined && pv > consumed) {
          s.status = 'stale'
          changed = true
          break
        }
      }
    }
  }
  return out
}

/** Ghi nhận step vừa sinh xong dựa trên bản parents hiện tại (cập nhật builtFrom). */
export function pinToParents(step: PipelineStep, steps: readonly PipelineStep[]): PipelineStep {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const builtFrom: Record<string, number> = { ...step.builtFrom }
  for (const pid of step.parents) {
    const p = byId.get(pid)
    if (p) builtFrom[pid] = p.version
  }
  return { ...step, builtFrom }
}

/** Cổng chặn: chỉ được sang chặng `stage` khi MỌI step ở các chặng trước đã approved. */
export function gateToStage(steps: readonly PipelineStep[], stage: Stage): boolean {
  const idx = STAGE_ORDER.indexOf(stage)
  return steps.filter((s) => STAGE_ORDER.indexOf(s.stage) < idx).every((s) => s.status === 'approved')
}

export interface PipelineHealth {
  readonly total: number
  readonly approved: number
  readonly stale: number
  readonly blocked: readonly string[] // id các step failed
  readonly actionable: readonly string[] // id step cần người/hệ thống xử lý
  readonly ready: boolean // mọi step approved → phát hành được
}

/** Tổng quan sức khoẻ pipeline cho dashboard host. */
export function pipelineHealth(steps: readonly PipelineStep[]): PipelineHealth {
  const approved = steps.filter((s) => s.status === 'approved').length
  const stale = steps.filter((s) => s.status === 'stale').length
  const blocked = steps.filter((s) => s.status === 'failed').map((s) => s.id)
  const actionable = steps
    .filter((s) => s.status === 'needs_review' || s.status === 'stale' || s.status === 'failed')
    .map((s) => s.id)
  return {
    total: steps.length,
    approved,
    stale,
    blocked,
    actionable,
    ready: steps.length > 0 && approved === steps.length,
  }
}
