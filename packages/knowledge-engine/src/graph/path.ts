/** Đường học tới mục tiêu. SPEC §7.2. */

import type { Slug } from '../contracts';
import type { SkillGraph } from './build';
import type { MasteryStates } from './composite';
import { isMastered } from './frontier';

/** Gom mọi ancestor của goal theo prereqsOf (DFS), kể cả goal. */
function collectAncestors(graph: SkillGraph, goal: Slug): Set<Slug> {
  const anc = new Set<Slug>();
  const stack: Slug[] = [goal];
  while (stack.length > 0) {
    const cur = stack.pop() as Slug;
    if (anc.has(cur)) continue;
    anc.add(cur);
    for (const e of graph.prereqsOf(cur)) stack.push(e.from);
  }
  return anc;
}

/**
 * SPEC §7.2 — topo Kahn trên tập ancestor (tiên quyết trước), fallback tất định nếu có
 * chu trình, rồi lọc bỏ node đã mastered. Tie-break theo thứ tự chèn của graph.
 */
export function pathTo(
  graph: SkillGraph,
  states: MasteryStates,
  goal: Slug,
  threshold: number,
): Slug[] {
  if (!graph.has(goal)) return [];
  const ancestors = collectAncestors(graph, goal);

  // Thứ tự chèn ổn định cho tie-break.
  const order = [...graph.nodes()].map((n) => n.slug).filter((s) => ancestors.has(s));

  // in-degree trên tập ancestor (chỉ đếm cạnh ordering nội bộ tập).
  const indeg = new Map<Slug, number>();
  for (const s of order) indeg.set(s, 0);
  for (const s of order) {
    for (const e of graph.prereqsOf(s)) {
      if (ancestors.has(e.from)) indeg.set(s, (indeg.get(s) ?? 0) + 1);
    }
  }

  const sorted: Slug[] = [];
  const queue = order.filter((s) => (indeg.get(s) ?? 0) === 0);
  const done = new Set<Slug>();
  while (queue.length > 0) {
    const cur = queue.shift() as Slug;
    if (done.has(cur)) continue;
    done.add(cur);
    sorted.push(cur);
    for (const e of graph.unlockedBy(cur)) {
      if (!ancestors.has(e.to)) continue;
      const d = (indeg.get(e.to) ?? 0) - 1;
      indeg.set(e.to, d);
      if (d === 0) queue.push(e.to);
    }
  }

  // Fallback tất định: node còn kẹt trong chu trình → nối theo thứ tự chèn.
  if (sorted.length < order.length) {
    for (const s of order) if (!done.has(s)) sorted.push(s);
  }

  return sorted.filter((s) => !isMastered(states, s, threshold));
}

/** SPEC §7.2 — như pathTo nhưng bỏ chính goal trừ khi goal chưa mastered. */
export function gapsTo(
  graph: SkillGraph,
  states: MasteryStates,
  goal: Slug,
  threshold: number,
): Slug[] {
  const path = pathTo(graph, states, goal, threshold);
  if (!isMastered(states, goal, threshold)) return path;
  return path.filter((s) => s !== goal);
}
