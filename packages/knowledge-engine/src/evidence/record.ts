/**
 * Điểm vào ghi bằng chứng có bảo vệ — BỔ SUNG §3.1, §3.3, §9.1.
 *
 * Thứ tự: validate quyền ghi → lọc lane (B2) → dedup idempotency (§9.1) → fold (§2).
 * KHÔNG export `foldEvidence` trần khỏi barrel công khai: mọi ghi LEARNER phải qua đây.
 */

import type { EvidenceInput } from '../contracts';
import type { EnginePolicy } from '../policy';
import { freshMastery, type SkillMastery } from '../mastery/observe';
import { foldEvidence, shouldSnapshot } from './fold';
import { validateEvidenceWrite, type EvidenceViolation } from './write-matrix';

export type RecordResult =
  /** LEARNER lane: đã fold; `snapshot` = có nên lấy mẫu SkillSnapshot không (§2). */
  | { readonly status: 'folded'; readonly state: SkillMastery; readonly snapshot: boolean }
  /** Lane ≠ LEARNER: chỉ ghi log, KHÔNG chạm SkillState (B2). */
  | { readonly status: 'log-only' }
  /** Trùng attemptId: no-op, trả state hiện tại (§9.1). */
  | { readonly status: 'duplicate'; readonly state: SkillMastery }
  /** Vi phạm ma trận quyền ghi (§3.1). */
  | { readonly status: 'rejected'; readonly violation: EvidenceViolation };

/** SPEC §9.1 — true nếu attemptId mới (và ghi nhận vào sổ); false nếu đã thấy. */
export function dedupeAttempt(attemptId: string, seen: Set<string>): boolean {
  if (seen.has(attemptId)) return false;
  seen.add(attemptId);
  return true;
}

/**
 * Ghi một bằng chứng. `seen` là sổ idempotency của host (tuỳ chọn); khi có + ev.attemptId,
 * trùng → 'duplicate'. Fold nằm trong hàm thuần này; host bọc transaction Serializable quanh nó.
 */
export function recordEvidence(
  prior: SkillMastery | undefined,
  ev: EvidenceInput,
  policy: EnginePolicy,
  seen?: Set<string>,
): RecordResult {
  const check = validateEvidenceWrite(ev, policy);
  if (!check.ok) return { status: 'rejected', violation: check.violation };

  const lane = ev.subjectType ?? 'LEARNER';
  if (lane !== 'LEARNER') return { status: 'log-only' }; // B2

  const current = prior ?? freshMastery(ev.skill, policy.bkt.pInit);
  if (seen && ev.attemptId !== undefined && !dedupeAttempt(ev.attemptId, seen)) {
    return { status: 'duplicate', state: current };
  }

  const folded = foldEvidence(prior, ev, {
    bkt: policy.bkt,
    elo: policy.elo,
    beta: policy.beta,
  });
  return {
    status: 'folded',
    state: folded,
    snapshot: shouldSnapshot(folded.attempts, policy.evidence.snapshotSampleEvery),
  };
}
