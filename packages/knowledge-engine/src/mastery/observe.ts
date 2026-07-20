/** Hợp nhất BKT + Elo cho một quan sát; phát lại chuỗi. SPEC §3.1, §3.4. */

import type { CompetencyKind } from '../domain';
import type { BktParams, EloParams } from '../policy';
import type { Elo, Millis, Slug } from '../contracts';
import { bktUpdate } from './bkt';
import { eloUpdate } from './elo';
import { DAY_MS } from './math';

/** SPEC §3.1 — trạng thái mức nắm nội bộ (nguồn fold; lastSeenMs thay lastSeenAt). */
export interface SkillMastery {
  readonly skill: Slug;
  readonly pKnown: number;
  readonly ability: Elo;
  readonly attempts: number;
  readonly correct: number;
  readonly lastSeenMs: Millis | null;
}

/** SPEC §0 — một quan sát đã rút gọn cho fold (correct + trọng số). */
export interface Observation {
  readonly skill: Slug;
  readonly correct: boolean;
  readonly weight?: number;
  readonly difficulty?: Elo;
  readonly atMs?: Millis;
  readonly kind?: CompetencyKind;
}

/** Bộ tham số fold (observe cần cả BKT lẫn Elo). */
export interface ObserveParams {
  readonly bkt: BktParams;
  readonly elo: EloParams;
}

/** SPEC §3.1 — trạng thái khởi tạo trước mọi bằng chứng. */
export function freshMastery(skill: Slug, pInit: number): SkillMastery {
  return { skill, pKnown: pInit, ability: 1000, attempts: 0, correct: 0, lastSeenMs: null };
}

/**
 * Fold một quan sát vào trạng thái. SPEC §3.4.
 * difficulty mặc định = ability hiện tại (exp ≈ 0.5, trung tính).
 * Elo KHÔNG nhận elapsedDays; chỉ BKT lãng quên theo thời gian.
 */
export function observe(
  prior: SkillMastery | undefined,
  obs: Observation,
  params: ObserveParams,
): SkillMastery {
  const m = prior ?? freshMastery(obs.skill, params.bkt.pInit);
  const weight = obs.weight ?? 1;
  const atMs = obs.atMs ?? m.lastSeenMs ?? 0;
  const elapsedDays =
    m.lastSeenMs != null && atMs > m.lastSeenMs ? (atMs - m.lastSeenMs) / DAY_MS : 0;
  const difficulty = obs.difficulty ?? m.ability;

  const pKnown = bktUpdate(m.pKnown, obs.correct, params.bkt, { elapsedDays, weight });
  const ability = eloUpdate(m.ability, difficulty, obs.correct, params.elo, { weight }).ability;

  return {
    skill: m.skill,
    pKnown,
    ability,
    attempts: m.attempts + 1,
    correct: m.correct + (obs.correct ? 1 : 0),
    lastSeenMs: obs.atMs ?? m.lastSeenMs, // chỉ cập nhật nếu obs có atMs
  };
}

/**
 * Phát lại tuần tự nhiều quan sát, KHÔNG mutate map đầu vào. SPEC §3.4.
 * Nhờ log ghi-thêm, có thể tái dựng toàn bộ SkillState bằng cách phát lại (bất biến B1).
 */
export function observeAll(
  start: ReadonlyMap<Slug, SkillMastery>,
  observations: readonly Observation[],
  params: ObserveParams,
): Map<Slug, SkillMastery> {
  const out = new Map<Slug, SkillMastery>(start);
  for (const obs of observations) {
    out.set(obs.skill, observe(out.get(obs.skill), obs, params));
  }
  return out;
}
