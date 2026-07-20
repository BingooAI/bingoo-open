/**
 * Điều phối pipeline biên soạn S1→S7 — nối máy trạng thái thuần (@bingoo.ai/authoring-workflow) với DB.
 * Chuyển trạng thái + lan STALE trong package; ở đây chỉ nạp/lưu + map lỗi.
 */

import {
  STAGE_ORDER,
  WorkflowError,
  applyEvent,
  pinToParents,
  pipelineHealth,
  propagateStale,
  type PipelineHealth,
  type PipelineStep,
  type StepEvent,
} from '@bingoo.ai/authoring-workflow'
import { createPipeline, loadSteps, pipelineExists, saveSteps } from '../repos/authoring-pipeline.repo'
import { AppError } from '../lib/errors'

export interface PipelineView {
  readonly pipelineId?: string
  readonly steps: readonly PipelineStep[]
  readonly health: PipelineHealth
}

/** Tạo pipeline mới với 7 bước S1→S7 nối chuỗi (mỗi bước phụ thuộc bước trước). */
export async function startPipeline(
  title: string,
  userId: string,
): Promise<PipelineView & { pipelineId: string }> {
  const steps: PipelineStep[] = STAGE_ORDER.map((stage, i) => ({
    id: stage,
    stage,
    status: 'draft',
    version: 0,
    parents: i > 0 ? [STAGE_ORDER[i - 1] as string] : [],
    builtFrom: {},
  }))
  const pipelineId = await createPipeline(title, userId, steps)
  return { pipelineId, steps, health: pipelineHealth(steps) }
}

export async function getPipeline(pipelineId: string): Promise<PipelineView> {
  if (!(await pipelineExists(pipelineId))) throw AppError.notFound('Pipeline không tồn tại.')
  const steps = await loadSteps(pipelineId)
  return { steps, health: pipelineHealth(steps) }
}

/** Áp 1 event lên 1 bước: chuyển trạng thái (thuần) → pin khi complete → lan STALE khi approve → lưu. */
export async function driveStep(
  pipelineId: string,
  stepKey: string,
  event: StepEvent,
): Promise<PipelineView> {
  if (!(await pipelineExists(pipelineId))) throw AppError.notFound('Pipeline không tồn tại.')
  const steps = await loadSteps(pipelineId)
  const target = steps.find((s) => s.id === stepKey)
  if (!target) throw AppError.notFound(`Bước "${stepKey}" không có trong pipeline.`)

  let updated: PipelineStep
  try {
    updated = applyEvent(target, event)
  } catch (e) {
    if (e instanceof WorkflowError) {
      throw AppError.validation([{ path: 'event', message: e.message, code: 'illegal_transition' }])
    }
    throw e
  }
  if (event === 'complete') updated = pinToParents(updated, steps) // ghi version parents đã tiêu thụ

  let next = steps.map((s) => (s.id === stepKey ? updated : s))
  if (event === 'approve') next = propagateStale(next) // parent bump version → hạ nguồn STALE

  await saveSteps(pipelineId, next)
  return { steps: next, health: pipelineHealth(next) }
}
