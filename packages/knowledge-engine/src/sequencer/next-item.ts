/** Chọn tức thời sau mỗi câu. SPEC §8.4. */

import type { Candidate, Slug } from '../contracts';
import type { EnginePolicy } from '../policy';
import type { SkillMastery } from '../mastery/observe';
import type { SkillGraph } from '../graph/build';
import { remediationFor } from '../graph/remediation';
import { abilityFromStates, isEligible, scoreItem } from './score';

export interface NextItemContext {
  readonly graph: SkillGraph;
  readonly states: ReadonlyMap<Slug, SkillMastery>;
  readonly priority: ReadonlyMap<Slug, number>;
  readonly relevant: ReadonlySet<Slug>;
  readonly started: ReadonlySet<Slug>;
  readonly encountered: ReadonlySet<Slug>;
}

export interface NextItemOpts {
  /** Kỹ năng vừa sai → đẩy mạnh ôn bù tiên quyết yếu nhất. */
  readonly remediate?: Slug;
  /** Khoá ứng viên đã gặp trong phiên. */
  readonly seen?: ReadonlySet<string>;
}

/**
 * SPEC §8.4. Nếu có remediate và graph chứa nó: chẩn đoán tiên quyết yếu nhất, nếu target
 * ∈ relevant (hoặc chính remediate) thì priority[target] += remediateBoost. Rồi quét tuyến
 * tính, lấy ứng viên điểm cao nhất (bỏ seen / không có tag ưu tiên / không eligible), hoặc null.
 */
export function selectNextItem(
  ctx: NextItemContext,
  candidates: readonly Candidate[],
  opts: NextItemOpts,
  policy: EnginePolicy,
): Candidate | null {
  let priority: ReadonlyMap<Slug, number> = ctx.priority;

  if (opts.remediate !== undefined && ctx.graph.has(opts.remediate)) {
    const rem = remediationFor(ctx.graph, ctx.states, opts.remediate, policy.mastery.threshold);
    if (ctx.relevant.has(rem.target) || rem.target === opts.remediate) {
      const boosted = new Map(ctx.priority);
      boosted.set(rem.target, (boosted.get(rem.target) ?? 0) + policy.sequencing.remediateBoost);
      priority = boosted;
    }
  }

  const abilityOf = abilityFromStates(ctx.states, policy.elo.base);
  let best: Candidate | null = null;
  let bestScore = 0;
  for (const cand of candidates) {
    if (opts.seen?.has(cand.key)) continue;
    if (!cand.skills.some((s) => priority.has(s))) continue;
    if (!isEligible(cand, ctx.started, ctx.encountered)) continue;
    const score = scoreItem(cand, priority, abilityOf, ctx.started, policy.sequencing);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}
