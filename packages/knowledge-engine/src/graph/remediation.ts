/** Ôn bù — chẩn đoán tiên quyết yếu nhất chưa đạt. SPEC §7.4. */

import type { Slug } from '../contracts';
import type { PrereqMode, RelType } from '../domain';
import type { SkillGraph } from './build';
import { compositeMastery, type MasteryStates } from './composite';

export interface Remediation {
  readonly target: Slug;
  readonly reason: 'prereq' | 'self';
}

/**
 * SPEC §7.4 — tiên quyết yếu nhất của failedSkill chưa compositeMastered.
 * Lọc theo mode/relType, giữ .from chưa đạt, sort tăng theo compositeMastery, lấy [0].
 */
function weakestUnmet(
  graph: SkillGraph,
  states: MasteryStates,
  failedSkill: Slug,
  threshold: number,
  memo: Map<Slug, number>,
  mode?: PrereqMode,
  relType?: RelType,
): Slug | null {
  const candidates: Array<{ slug: Slug; mastery: number }> = [];
  for (const e of graph.prereqsOf(failedSkill)) {
    if (mode && e.mode !== mode) continue;
    if (relType && (e.relType ?? 'PREREQUISITE') !== relType) continue;
    const mastery = compositeMastery(graph, states, e.from, { memo });
    if (mastery >= threshold) continue; // đã đạt → bỏ
    candidates.push({ slug: e.from, mastery });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.mastery - b.mastery);
  return (candidates[0] as { slug: Slug }).slug;
}

/**
 * SPEC §7.4 — chỉ lùi MỘT bậc:
 * 1) tiên quyết REQUIRED yếu nhất → prereq
 * 2) else cạnh ENABLES yếu nhất → prereq
 * 3) else chính nó → self
 */
export function remediationFor(
  graph: SkillGraph,
  states: MasteryStates,
  failedSkill: Slug,
  threshold: number,
): Remediation {
  const memo = new Map<Slug, number>();
  const required = weakestUnmet(graph, states, failedSkill, threshold, memo, 'REQUIRED');
  if (required) return { target: required, reason: 'prereq' };

  const enables = weakestUnmet(graph, states, failedSkill, threshold, memo, undefined, 'ENABLES');
  if (enables) return { target: enables, reason: 'prereq' };

  return { target: failedSkill, reason: 'self' };
}
