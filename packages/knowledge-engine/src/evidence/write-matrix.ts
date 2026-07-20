/** Ma trận quyền ghi bằng chứng — BỔ SUNG §3.1. Lỗ hổng toàn vẹn quan trọng nhất. */

import type { AssessmentMode, CompetencyKind, EvidenceActor, EvidenceSource } from '../domain';
import type { EvidenceInput } from '../contracts';
import type { EnginePolicy } from '../policy';

export type EvidenceViolation =
  | {
      readonly code: 'SOURCE_NOT_ALLOWED';
      readonly actor: EvidenceActor;
      readonly source: EvidenceSource;
    }
  | {
      readonly code: 'MODE_NOT_ALLOWED';
      readonly actor: EvidenceActor;
      readonly mode: AssessmentMode;
    }
  | {
      readonly code: 'KIND_NOT_ALLOWED';
      readonly actor: EvidenceActor;
      readonly kind: CompetencyKind | null;
    }
  | {
      readonly code: 'CONFIDENCE_EXCEEDS_CAP';
      readonly actor: EvidenceActor;
      readonly confidence: number;
      readonly cap: number;
    }
  | { readonly code: 'MEASURE_REQUIRES_PROCTORED'; readonly actor: EvidenceActor };

export type WriteCheck =
  { readonly ok: true } | { readonly ok: false; readonly violation: EvidenceViolation };

/**
 * BỔ SUNG §3.1 — kiểm quyền ghi trước khi fold. Trả vi phạm ĐẦU TIÊN gặp phải.
 * Mặc định: source=QUIZ, mode=LEARN, confidence=1 (SPEC §1.5).
 */
export function validateEvidenceWrite(ev: EvidenceInput, policy: EnginePolicy): WriteCheck {
  const actor = ev.actor;
  const rule = policy.evidence.writeMatrix[actor];

  const source = ev.source ?? 'QUIZ';
  const mode = ev.mode ?? 'LEARN';
  const confidence = ev.confidence ?? 1;

  if (!rule.sources.includes(source)) {
    return { ok: false, violation: { code: 'SOURCE_NOT_ALLOWED', actor, source } };
  }
  if (!rule.modes.includes(mode)) {
    return { ok: false, violation: { code: 'MODE_NOT_ALLOWED', actor, mode } };
  }
  if (rule.kinds && (ev.kind == null || !rule.kinds.includes(ev.kind))) {
    return { ok: false, violation: { code: 'KIND_NOT_ALLOWED', actor, kind: ev.kind ?? null } };
  }
  if (rule.maxConfidence !== undefined && confidence > rule.maxConfidence) {
    return {
      ok: false,
      violation: { code: 'CONFIDENCE_EXCEEDS_CAP', actor, confidence, cap: rule.maxConfidence },
    };
  }
  if (rule.measureRequiresProctored && mode === 'MEASURE' && ev.proctored !== true) {
    return { ok: false, violation: { code: 'MEASURE_REQUIRES_PROCTORED', actor } };
  }
  return { ok: true };
}
