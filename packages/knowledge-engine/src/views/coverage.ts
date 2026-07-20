/** coverageReport — lỗ phủ objective. SPEC §11 (gate KHÔNG chặn, chỉ để lộ). */

import type { Slug } from '../contracts';
import type { SkillGraph } from '../graph/build';

export interface CoverageReport {
  readonly total: number;
  readonly covered: number;
  readonly missing: readonly Slug[];
}

/**
 * SPEC §11 — objective "phủ" nếu: được content gắn trực tiếp (attached), HOẶC CHÍNH NÓ được dạy
 * (taughtConcepts — trường hợp objective LÀ một KC, vd bài đo nhắm thẳng KC / preview một bài), HOẶC
 * một concept nó MAPS_TO được dạy (một hop). Host cấp attached + taughtConcepts.
 *
 * Bổ sung "chính nó được dạy" là an toàn cho coverage view thật: objective thật (node OBJECTIVE) không
 * bao giờ trùng slug với một KC đã dạy, nên nhánh này chỉ kích hoạt khi objective CHÍNH LÀ một KC — lúc
 * đó nó phủ khi KC đó được dạy. Không có nhánh này, bài đo nhắm thẳng KC luôn bị coi là "chưa dạy".
 */
export function coverageReport(
  graph: SkillGraph,
  objectives: readonly Slug[],
  attached: ReadonlySet<Slug>,
  taughtConcepts: ReadonlySet<Slug>,
): CoverageReport {
  const missing: Slug[] = [];
  for (const obj of objectives) {
    if (attached.has(obj) || taughtConcepts.has(obj)) continue;
    const mappedCovered = graph.mapsTo(obj).some((e) => taughtConcepts.has(e.to));
    if (!mappedCovered) missing.push(obj);
  }
  return { total: objectives.length, covered: objectives.length - missing.length, missing };
}
