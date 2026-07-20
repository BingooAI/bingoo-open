/** Grading contract — Verdict → EvidenceInput[]. BỔ SUNG §3.3. */

import type {
  AssessmentMode,
  CompetencyKind,
  EvidenceActor,
  EvidenceSource,
  ObservationSubject,
} from '../domain';
import type { EvidenceInput, RaterProfile, Submission, Verdict } from '../contracts';
import type { EnginePolicy } from '../policy';
import { interpolateConfidence, type ConfidenceInput } from '../mastery/confidence';
import { raterWeight, raterWeightParams } from './rater';

/** Ngữ cảnh ghi bằng chứng do host cấp (source/mode/actor…). */
export interface EvidenceContext {
  readonly actor: EvidenceActor;
  readonly source?: EvidenceSource;
  readonly mode?: AssessmentMode;
  readonly kind?: CompetencyKind;
  readonly subjectType?: ObservationSubject;
  readonly raterId?: string;
  readonly raterProfile?: RaterProfile | null;
  readonly proctored?: boolean;
}

/**
 * BỔ SUNG §3.3. Một EvidenceInput cho MỖI skill của submission.
 * confidence = verdict.confidence × interpolateConfidence(raterWeight, latency, hints).
 * Kết quả BẮT BUỘC đi qua validateEvidenceWrite trước khi fold (recordEvidence lo việc đó).
 */
export function toObservations(
  verdict: Verdict,
  submission: Submission,
  ctx: EvidenceContext,
  policy: EnginePolicy,
): EvidenceInput[] {
  const rw = raterWeight(ctx.raterProfile ?? null, ctx.actor, raterWeightParams(policy));

  const confInput: ConfidenceInput = {
    rater: rw,
    expectedMs: policy.dreyfus.expectedMs,
    ...(submission.latencyMs !== undefined ? { latencyMs: submission.latencyMs } : {}),
    ...(submission.hintsUsed !== undefined ? { hintsUsed: submission.hintsUsed } : {}),
  };
  const penalty = interpolateConfidence(confInput, policy.confidence);
  const confidence = verdict.confidence * penalty;

  return submission.skills.map((skill) => ({
    skill,
    outcome: verdict.outcome,
    confidence,
    actor: ctx.actor,
    attemptId: submission.attemptId,
    ...(ctx.source !== undefined ? { source: ctx.source } : {}),
    ...(ctx.mode !== undefined ? { mode: ctx.mode } : {}),
    ...(ctx.kind !== undefined ? { kind: ctx.kind } : {}),
    ...(ctx.subjectType !== undefined ? { subjectType: ctx.subjectType } : {}),
    ...(ctx.raterId !== undefined ? { raterId: ctx.raterId } : {}),
    ...(ctx.proctored !== undefined ? { proctored: ctx.proctored } : {}),
    ...(submission.itemKey !== undefined ? { itemKey: submission.itemKey } : {}),
    ...(submission.latencyMs !== undefined ? { latencyMs: submission.latencyMs } : {}),
    ...(submission.hintsUsed !== undefined ? { hintsUsed: submission.hintsUsed } : {}),
    ...(submission.lang !== undefined ? { lang: submission.lang } : {}),
    ...(submission.atMs !== undefined ? { atMs: submission.atMs } : {}),
  }));
}
