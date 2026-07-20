/** Scope khái niệm liên quan — mở rộng một-hop trên đồ thị. SPEC §7.5. */

import type { Slug } from '../contracts';
import type { SkillGraph } from './build';

/**
 * SPEC §7.5 (phần thuần). seed = mọi slug có bằng chứng ∪ competency các đơn vị đang học
 * (host cấp qua RelevanceScopePort). Engine mở rộng MỘT hop dọc chuỗi ordering:
 *   lên: bộ phận → tổng thể (unlockedBy.to); xuống: tổng thể → bộ phận (prereqsOf.from).
 */
export function expandRelevance(graph: SkillGraph, seed: Iterable<Slug>): Set<Slug> {
  const out = new Set<Slug>();
  for (const slug of seed) {
    out.add(slug);
    for (const e of graph.unlockedBy(slug)) out.add(e.to);
    for (const e of graph.prereqsOf(slug)) out.add(e.from);
  }
  return out;
}
