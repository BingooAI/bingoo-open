/** Lắp ráp phiên thích ứng. SPEC §8.3. */

import type { Candidate, Slug } from '../contracts';
import type { EnginePolicy } from '../policy';
import type { SkillMastery } from '../mastery/observe';
import { abilityFromStates, isEligible, scoreItem } from './score';
import { dayRank } from './hash';

export interface SessionContext {
  readonly states: ReadonlyMap<Slug, SkillMastery>;
  readonly priority: ReadonlyMap<Slug, number>;
  readonly started: ReadonlySet<Slug>;
  readonly encountered: ReadonlySet<Slug>;
}

export interface SessionOpts {
  readonly size?: number;
  /** ε-explore 0..1 (bị chặn bởi exploreCap). */
  readonly explore?: number;
  /** Xoay vòng tie-break theo ngày (tái lập). */
  readonly daySeed?: string;
  /** Nếu có: ứng viên phải chạm ít nhất một skill trong focus. */
  readonly focus?: ReadonlySet<Slug>;
  /** Khoá ứng viên vừa gặp (loại khỏi phiên). */
  readonly recent?: ReadonlySet<string>;
}

function kindKey(cand: Candidate): string {
  return cand.kind ?? '∅';
}

/**
 * SPEC §8.3 — không hai định dạng cùng loại liền nhau (chỉ khi list ≥ 3).
 * Giữ thứ tự difficulty ASC tối đa: gặp cặp trùng thì hoán với item khác loại kế tiếp.
 */
export function declumpByKind(items: Candidate[]): Candidate[] {
  if (items.length < 3) return items;
  const out = items.slice();
  for (let i = 1; i < out.length; i++) {
    if (kindKey(out[i] as Candidate) !== kindKey(out[i - 1] as Candidate)) continue;
    let j = i + 1;
    while (j < out.length && kindKey(out[j] as Candidate) === kindKey(out[i - 1] as Candidate)) j++;
    if (j < out.length) {
      const tmp = out[i] as Candidate;
      out[i] = out[j] as Candidate;
      out[j] = tmp;
    }
  }
  return out;
}

/**
 * SPEC §8.3 — lọc → chấm → sort (bucket DESC, dayRank ASC) → caps + ε-explore 3 pha →
 * sort difficulty ASC + declump. Tất định theo (input, daySeed).
 */
export function selectAdaptiveSession(
  ctx: SessionContext,
  candidates: readonly Candidate[],
  opts: SessionOpts,
  policy: EnginePolicy,
): Candidate[] {
  const seq = policy.sequencing;
  const size = opts.size ?? seq.sessionSize;
  const abilityOf = abilityFromStates(ctx.states, policy.elo.base);

  // Lọc.
  const eligible = candidates.filter((c) => {
    if (opts.recent?.has(c.key)) return false;
    if (!c.skills.some((s) => ctx.priority.has(s))) return false;
    if (!isEligible(c, ctx.started, ctx.encountered)) return false;
    if (opts.focus && !c.skills.some((s) => opts.focus?.has(s))) return false;
    return true;
  });

  // Chấm + sort: round(score·bucket) DESC, rồi dayRank ASC.
  const scored = eligible.map((cand) => ({
    cand,
    bucket: Math.round(
      scoreItem(cand, ctx.priority, abilityOf, ctx.started, seq) * seq.scoreBucket,
    ),
    rank: dayRank(cand.key, opts.daySeed),
  }));
  scored.sort((a, b) => b.bucket - a.bucket || a.rank - b.rank);
  const sorted = scored.map((s) => s.cand);

  // Caps.
  const perSkill = Math.ceil(size / seq.perSkillDivisor);
  const perKind = Math.max(seq.perKindFloor, Math.ceil(size / seq.perKindDivisor));

  const picked: Candidate[] = [];
  const pickedKeys = new Set<string>();
  const skillCount = new Map<Slug, number>();
  const kindCount = new Map<string, number>();
  const kindsSeen = new Set<string>();

  const canAdd = (cand: Candidate, newKindOnly: boolean): boolean => {
    if (pickedKeys.has(cand.key)) return false;
    const kk = kindKey(cand);
    if (newKindOnly && kindsSeen.has(kk)) return false;
    if ((kindCount.get(kk) ?? 0) >= perKind) return false;
    for (const s of cand.skills) {
      if (!ctx.priority.has(s)) continue;
      if ((skillCount.get(s) ?? 0) >= perSkill) return false;
    }
    return true;
  };

  const add = (cand: Candidate): void => {
    picked.push(cand);
    pickedKeys.add(cand.key);
    const kk = kindKey(cand);
    kindCount.set(kk, (kindCount.get(kk) ?? 0) + 1);
    kindsSeen.add(kk);
    for (const s of cand.skills) {
      if (!ctx.priority.has(s)) continue;
      skillCount.set(s, (skillCount.get(s) ?? 0) + 1);
    }
  };

  const tryPick = (target: number, newKindOnly: boolean): void => {
    for (const cand of sorted) {
      if (picked.length >= target) break;
      if (canAdd(cand, newKindOnly)) add(cand);
    }
  };

  const exploreN = Math.floor(size * Math.min(seq.exploreCap, opts.explore ?? 0));
  tryPick(size - exploreN, false); // khai thác theo điểm, chừa slot
  tryPick(size, true); // chèn định dạng chưa xuất hiện
  tryPick(size, false); // lấp phần còn lại

  // Sắp cuối: dễ → khó rồi declump.
  picked.sort((a, b) => a.difficulty - b.difficulty);
  return declumpByKind(picked);
}
