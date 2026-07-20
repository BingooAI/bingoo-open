/**
 * Data access pipeline biên soạn. DB rows ↔ PipelineStep của @bingoo/authoring-workflow.
 * Repo THUẦN lưu trạng thái; chuyển trạng thái/lan STALE do service gọi package thuần.
 */

import { db, type Prisma } from '@bingoo/db';
import type { PipelineStep, Stage } from '@bingoo/authoring-workflow';

function rowToStep(r: {
  stepKey: string;
  stage: string;
  status: string;
  version: number;
  parents: string[];
  builtFrom: unknown;
}): PipelineStep {
  return {
    id: r.stepKey,
    stage: r.stage as Stage,
    status: r.status as PipelineStep['status'],
    version: r.version,
    parents: r.parents,
    builtFrom: (r.builtFrom && typeof r.builtFrom === 'object' ? r.builtFrom : {}) as Record<
      string,
      number
    >,
  };
}

export async function createPipeline(
  title: string,
  createdBy: string,
  steps: readonly PipelineStep[],
): Promise<string> {
  const pipeline = await db.authoringPipeline.create({ data: { title, createdBy } });
  await db.authoringStep.createMany({
    data: steps.map((s) => ({
      pipelineId: pipeline.id,
      stepKey: s.id,
      stage: s.stage,
      status: s.status,
      version: s.version,
      parents: [...s.parents],
      builtFrom: s.builtFrom as Prisma.InputJsonValue,
    })),
  });
  return pipeline.id;
}

export async function loadSteps(pipelineId: string): Promise<PipelineStep[]> {
  const rows = await db.authoringStep.findMany({
    where: { pipelineId },
    select: {
      stepKey: true,
      stage: true,
      status: true,
      version: true,
      parents: true,
      builtFrom: true,
    },
  });
  return rows.map(rowToStep);
}

export async function pipelineExists(pipelineId: string): Promise<boolean> {
  return (await db.authoringPipeline.count({ where: { id: pipelineId } })) > 0;
}

/** Ghi đè trạng thái các bước (sau chuyển trạng thái + lan STALE). */
export async function saveSteps(pipelineId: string, steps: readonly PipelineStep[]): Promise<void> {
  for (const s of steps) {
    await db.authoringStep.update({
      where: { pipelineId_stepKey: { pipelineId, stepKey: s.id } },
      data: {
        status: s.status,
        version: s.version,
        parents: [...s.parents],
        builtFrom: s.builtFrom as Prisma.InputJsonValue,
      },
    });
  }
}
