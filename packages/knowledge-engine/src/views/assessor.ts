/** assessorView — mặt đọc của người đánh giá. BỔ SUNG §3.4. */

import type { Slug } from '../contracts';
import type { EnginePolicy } from '../policy';
import type { SkillGraph } from '../graph/build';
import {
  certifyFramework,
  measuredStates,
  type CertifyObjective,
  type CertifyOpts,
  type CertifyReport,
  type MeasureObservation,
  type MeasuredState,
} from '../certify/index';
import { flagDIF, type DifResult } from '../certify/dif';

export interface DifInput {
  readonly itemKey: string;
  readonly groupA: readonly number[];
  readonly groupB: readonly number[];
}

export interface AssessorViewInput {
  readonly graph: SkillGraph;
  readonly observations: readonly MeasureObservation[];
  readonly objectives: readonly CertifyObjective[];
  readonly lang: string;
  readonly difInputs?: readonly DifInput[];
  readonly certifyOpts?: CertifyOpts;
}

export interface DifFlag {
  readonly itemKey: string;
  readonly result: DifResult;
}

export interface AssessorView {
  readonly measured: Map<Slug, MeasuredState>;
  readonly certify: CertifyReport;
  readonly difFlags: DifFlag[];
}

/** measuredStates (chỉ MEASURE + đúng lang) → certify + cờ DIF công bằng đề. */
export function assessorView(input: AssessorViewInput, policy: EnginePolicy): AssessorView {
  const measured = measuredStates(input.observations, input.lang, policy.elo.base);
  const certify = certifyFramework(
    input.graph,
    measured,
    input.objectives,
    policy,
    input.certifyOpts,
  );
  const difFlags: DifFlag[] = (input.difInputs ?? []).map((d) => ({
    itemKey: d.itemKey,
    result: flagDIF(d.groupA, d.groupB, policy.certify.difThreshold, policy.certify.difMinN),
  }));
  return { measured, certify, difFlags };
}
