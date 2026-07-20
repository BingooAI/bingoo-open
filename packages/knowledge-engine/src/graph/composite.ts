/** Tổng hợp mức nắm nhiều cấp. SPEC §6. */

import type { Slug } from '../contracts';
import { SEQUENCING_UNSEEN_PRIOR } from '../policy';
import type { SkillGraph } from './build';

/** Chỉ cần pKnown để cuộn mastery (SkillMastery của M1 thoả interface này). */
export interface MasteryLike {
  readonly pKnown: number;
}
export type MasteryStates = ReadonlyMap<Slug, MasteryLike>;

export interface CompositeOpts {
  /** SPEC quyết định #5: 0.25 khi sắp trình tự, 0 khi báo cáo. Mặc định 0.25. */
  readonly unseenPrior?: number;
  /** Memo dùng chung cho một lượt quét; BẤT BIẾN: một memo ↔ một unseenPrior. */
  readonly memo?: Map<Slug, number>;
}

function relIsComposes(rel: string | undefined): boolean {
  return (rel ?? 'PREREQUISITE') === 'COMPOSES';
}

function compositeInner(
  graph: SkillGraph,
  states: MasteryStates,
  node: Slug,
  prior: number,
  memo: Map<Slug, number>,
  seen: Set<Slug>,
): number {
  const cached = memo.get(node);
  if (cached !== undefined) return cached;

  const direct = states.get(node)?.pKnown ?? prior;
  if (seen.has(node)) return direct; // cycle-guard (KHÔNG memo)

  const parts = graph.prereqsOf(node).filter((e) => relIsComposes(e.relType));
  if (parts.length === 0) {
    memo.set(node, direct);
    return direct;
  }

  seen.add(node);
  const scored = parts.map((e) => ({
    score: compositeInner(graph, states, e.from, prior, memo, seen),
    mode: e.mode,
    weight: e.weight ?? 1,
  }));
  seen.delete(node);

  const required = scored.filter((s) => s.mode === 'REQUIRED');
  let rolled: number;
  if (required.length > 0) {
    rolled = Math.min(...required.map((s) => s.score)); // AND — mắt xích yếu nhất
  } else {
    let weighted = 0;
    let weightSum = 0;
    for (const s of scored) {
      weighted += s.score * s.weight;
      weightSum += s.weight;
    }
    rolled = weightSum > 0 ? weighted / weightSum : direct;
  }

  const result = Math.max(direct, rolled); // bằng chứng bản thân luôn được tính
  memo.set(node, result);
  return result;
}

/** SPEC §6.1 — cuộn mastery theo cạnh COMPOSES (REQUIRED→min, còn lại→weighted mean). */
export function compositeMastery(
  graph: SkillGraph,
  states: MasteryStates,
  node: Slug,
  opts: CompositeOpts = {},
): number {
  const prior = opts.unseenPrior ?? SEQUENCING_UNSEEN_PRIOR;
  const memo = opts.memo ?? new Map<Slug, number>();
  return compositeInner(graph, states, node, prior, memo, new Set<Slug>());
}

/** SPEC §6.2 — gộp các node ALIGNS tương đương (lấy max). */
export function effectiveMastery(
  graph: SkillGraph,
  states: MasteryStates,
  node: Slug,
  opts: CompositeOpts = {},
): number {
  let best = compositeMastery(graph, states, node, opts);
  for (const aligned of graph.alignedWith(node)) {
    best = Math.max(best, compositeMastery(graph, states, aligned.slug, opts));
  }
  return best;
}

/** SPEC §6.3 — điểm kiến thức = MIN trên khái niệm (chưa có = 0). */
export function kpMastery(conceptSlugs: readonly Slug[], states: MasteryStates): number {
  if (conceptSlugs.length === 0) return 0;
  let min = Infinity;
  for (const slug of conceptSlugs) {
    min = Math.min(min, states.get(slug)?.pKnown ?? 0);
  }
  return min;
}

export interface NodeMasteryResult {
  readonly pKnown: number;
  readonly achieved: boolean;
}

/** SPEC §6.4 — năng lực/mục tiêu qua cạnh MAPS_TO (max của direct & rolled). */
export function nodeMastery(
  graph: SkillGraph,
  states: MasteryStates,
  slug: Slug,
  threshold: number,
  opts: CompositeOpts = {},
): NodeMasteryResult {
  const direct = effectiveMastery(graph, states, slug, opts);
  const mapped = graph.mapsTo(slug);
  let pKnown = direct;

  if (mapped.length > 0) {
    const scored = mapped.map((e) => ({
      score: effectiveMastery(graph, states, e.to, opts),
      mode: e.mode,
      weight: e.weight ?? 1,
    }));

    // MAPS_TO = objective được chứng nhận bởi các KC nó trỏ tới. Luật PHẢI giống COMPOSES:
    // REQUIRED → MIN (AND — mắt xích yếu nhất), phần còn lại → trung bình có trọng số.
    //
    // Vì sao KHÔNG được dùng trung bình cho REQUIRED: một objective như "đếm, đọc, viết số trong
    // phạm vi 10; 20; 100" map tới {count-to-10, count-to-20, count-to-100, read-write-to-100}.
    // Trẻ thạo 3 cái đầu nhưng KHÔNG đếm nổi đến 100 → trung bình 0.75 ≥ cut → "ĐẠT" (SAI).
    // Objective ghi rõ phải đến 100, nên thiếu một mắt xích REQUIRED là KHÔNG đạt.
    const required = scored.filter((s) => s.mode === 'REQUIRED');
    let rolled: number;
    if (required.length > 0) {
      rolled = Math.min(...required.map((s) => s.score));
    } else {
      let weighted = 0;
      let weightSum = 0;
      for (const s of scored) {
        weighted += s.score * s.weight;
        weightSum += s.weight;
      }
      rolled = weightSum > 0 ? weighted / weightSum : direct;
    }
    pKnown = Math.max(direct, rolled);
  }

  return { pKnown, achieved: pKnown >= threshold };
}

/** SPEC §6.5 — thành viên rollup nhóm/khoá/chương trình. */
export interface AggregateMember {
  readonly pKnown: number;
  readonly achieved: boolean;
  readonly weight?: number;
}

export interface AggregateResult {
  readonly pKnown: number;
  readonly percent: number;
}

/** SPEC §6.5 — trung bình có trọng số phủ + % đạt chuẩn. */
export function aggregate(members: readonly AggregateMember[]): AggregateResult {
  if (members.length === 0) return { pKnown: 0, percent: 0 };
  let weighted = 0;
  let weightSum = 0;
  let achieved = 0;
  for (const m of members) {
    const w = m.weight ?? 1;
    weighted += m.pKnown * w;
    weightSum += w;
    if (m.achieved) achieved++;
  }
  return {
    pKnown: weightSum > 0 ? weighted / weightSum : 0,
    percent: Math.round((achieved / members.length) * 100),
  };
}
