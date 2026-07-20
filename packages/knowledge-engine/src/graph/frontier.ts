/** Biên học — suy luận cấu trúc trên đồ thị. SPEC §7.1 + Phụ lục A.3. */

import { LEARNABLE_KINDS } from '../domain';
import type { CompetencyKind } from '../domain';
import type { Slug } from '../contracts';
import { SEQUENCING_UNSEEN_PRIOR } from '../policy';
import type { SkillGraph } from './build';
import { compositeMastery, type MasteryStates } from './composite';

export interface FrontierNode {
  readonly slug: Slug;
  readonly kind: CompetencyKind;
  readonly pKnown: number;
  readonly impact: number;
}

function masteryOf(states: MasteryStates, slug: Slug): number {
  return states.get(slug)?.pKnown ?? SEQUENCING_UNSEEN_PRIOR;
}

function isLearnable(kind: CompetencyKind): boolean {
  return (LEARNABLE_KINDS as readonly string[]).includes(kind);
}

// ── Biến thể phẳng (A.3) — dùng pKnown trực tiếp, không roll COMPOSES, không lọc kind ──

export function isMastered(states: MasteryStates, slug: Slug, threshold: number): boolean {
  return masteryOf(states, slug) >= threshold;
}

export function isReady(
  graph: SkillGraph,
  states: MasteryStates,
  slug: Slug,
  threshold: number,
): boolean {
  if (isMastered(states, slug, threshold)) return false;
  for (const e of graph.prereqsOf(slug)) {
    if (e.mode === 'REQUIRED' && !isMastered(states, e.from, threshold)) return false;
  }
  return true;
}

function unmasteredDescendantsFlat(
  graph: SkillGraph,
  states: MasteryStates,
  slug: Slug,
  threshold: number,
): number {
  let count = 0;
  for (const d of graph.descendants(slug)) {
    if (!isMastered(states, d, threshold)) count++;
  }
  return count;
}

/** SPEC A.3 — frontier phẳng (chẩn đoán): mọi node ready, xếp theo đòn bẩy. */
export function frontier(
  graph: SkillGraph,
  states: MasteryStates,
  threshold: number,
): FrontierNode[] {
  const out: FrontierNode[] = [];
  for (const node of graph.nodes()) {
    if (!isReady(graph, states, node.slug, threshold)) continue;
    out.push({
      slug: node.slug,
      kind: node.kind,
      pKnown: masteryOf(states, node.slug),
      impact: unmasteredDescendantsFlat(graph, states, node.slug, threshold),
    });
  }
  return sortFrontier(out);
}

// ── Biến thể composite (§7.1) — dùng ở runtime: roll COMPOSES + bỏ OBJECTIVE/OUTCOME ──

function isCompositeMastered(
  graph: SkillGraph,
  states: MasteryStates,
  slug: Slug,
  threshold: number,
  memo: Map<Slug, number>,
): boolean {
  return compositeMastery(graph, states, slug, { memo }) >= threshold;
}

function isReadyComposite(
  graph: SkillGraph,
  states: MasteryStates,
  slug: Slug,
  threshold: number,
  memo: Map<Slug, number>,
): boolean {
  if (isCompositeMastered(graph, states, slug, threshold, memo)) return false;
  for (const e of graph.prereqsOf(slug)) {
    if (e.mode === 'REQUIRED' && !isCompositeMastered(graph, states, e.from, threshold, memo)) {
      return false;
    }
  }
  return true;
}

/**
 * SPEC §7.1 — biên học runtime. Bỏ node không LEARNABLE; giữ node ready.
 * impact = số descendant CHƯA compositeMastered. Dùng một memo chung (unseenPrior 0.25).
 */
export function frontierComposite(
  graph: SkillGraph,
  states: MasteryStates,
  threshold: number,
): FrontierNode[] {
  const memo = new Map<Slug, number>();
  const out: FrontierNode[] = [];
  for (const node of graph.nodes()) {
    if (!isLearnable(node.kind)) continue;
    if (!isReadyComposite(graph, states, node.slug, threshold, memo)) continue;
    let impact = 0;
    for (const d of graph.descendants(node.slug)) {
      if (!isCompositeMastered(graph, states, d, threshold, memo)) impact++;
    }
    out.push({
      slug: node.slug,
      kind: node.kind,
      pKnown: compositeMastery(graph, states, node.slug, { memo }),
      impact,
    });
  }
  return sortFrontier(out);
}

/** Đòn bẩy cao nhất trước, rồi yếu nhất: impact DESC, pKnown ASC. SPEC §7.1. */
function sortFrontier(nodes: FrontierNode[]): FrontierNode[] {
  return nodes.sort((a, b) => b.impact - a.impact || a.pKnown - b.pKnown);
}
