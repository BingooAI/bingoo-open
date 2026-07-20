// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Đồ thị năng lực in-memory, chỉ-đọc. SPEC Phụ lục A.
 *
 * Ba chỉ mục: incoming/outgoing chỉ giữ cạnh ordering (khoá theo to/from); lateral giữ
 * cạnh ALIGNS/VARIANT_OF/MAPS_TO, đẩy vào CẢ HAI đầu. Nhờ vậy traversal ordering không
 * bao giờ vấp cạnh lateral. `nodes` giữ thứ tự chèn (ảnh hưởng tie-break của frontier).
 */

import { isOrdering } from '../domain'
import type { GraphData, SkillEdge, SkillNode, Slug } from '../contracts'
import type { RelType } from '../domain'

function relOf(e: SkillEdge): RelType {
  return e.relType ?? 'PREREQUISITE'
}

function pushEdge(map: Map<Slug, SkillEdge[]>, key: Slug, edge: SkillEdge): void {
  const list = map.get(key)
  if (list) list.push(edge)
  else map.set(key, [edge])
}

/** Node kèm trọng số cho truy vấn lateral (alignedWith). */
export interface WeightedNode {
  readonly slug: Slug
  readonly weight: number
}

export class SkillGraph {
  private readonly nodeMap: Map<Slug, SkillNode>
  private readonly incoming = new Map<Slug, SkillEdge[]>()
  private readonly outgoing = new Map<Slug, SkillEdge[]>()
  private readonly lateral = new Map<Slug, SkillEdge[]>()

  constructor(data: GraphData) {
    this.nodeMap = new Map(data.nodes.map((n) => [n.slug, n]))
    for (const e of data.edges) {
      // Bỏ cạnh nếu một đầu không có node (SPEC A.4).
      if (!this.nodeMap.has(e.from) || !this.nodeMap.has(e.to)) continue
      if (isOrdering(e.relType)) {
        pushEdge(this.incoming, e.to, e)
        pushEdge(this.outgoing, e.from, e)
      } else {
        pushEdge(this.lateral, e.from, e)
        pushEdge(this.lateral, e.to, e)
      }
    }
  }

  has(slug: Slug): boolean {
    return this.nodeMap.has(slug)
  }

  node(slug: Slug): SkillNode | undefined {
    return this.nodeMap.get(slug)
  }

  /** Duyệt node theo thứ tự chèn (tie-break tái lập). */
  nodes(): IterableIterator<SkillNode> {
    return this.nodeMap.values()
  }

  /** Cạnh mà slug là `to` (đọc `.from` để ra tiên quyết). SPEC A.2. */
  prereqsOf(slug: Slug): readonly SkillEdge[] {
    return this.incoming.get(slug) ?? []
  }

  /** Cạnh mà slug là `from` (cái slug mở khoá). SPEC A.2. */
  unlockedBy(slug: Slug): readonly SkillEdge[] {
    return this.outgoing.get(slug) ?? []
  }

  /** Cạnh lateral chạm slug, lọc theo relType nếu có. SPEC A.2. */
  lateralOf(slug: Slug, relType?: RelType): readonly SkillEdge[] {
    const all = this.lateral.get(slug) ?? []
    return relType ? all.filter((e) => relOf(e) === relType) : all
  }

  /** Node ALIGNS tương đương (hai chiều; weight ép = 1). SPEC A.2. */
  alignedWith(slug: Slug): readonly WeightedNode[] {
    const out: WeightedNode[] = []
    for (const e of this.lateralOf(slug, 'ALIGNS')) {
      const other = e.from === slug ? e.to : e.from
      out.push({ slug: other, weight: 1 })
    }
    return out
  }

  /** Cạnh MAPS_TO xuất phát từ slug (objective → concept nền). SPEC §6.4. */
  mapsTo(slug: Slug): readonly SkillEdge[] {
    return this.lateralOf(slug, 'MAPS_TO').filter((e) => e.from === slug)
  }

  /** Toàn bộ descendant theo cạnh ordering (unlockedBy), có seen-guard. SPEC A.2. */
  descendants(slug: Slug): ReadonlySet<Slug> {
    const out = new Set<Slug>()
    const stack: Slug[] = [slug]
    while (stack.length > 0) {
      const cur = stack.pop() as Slug
      for (const e of this.unlockedBy(cur)) {
        if (!out.has(e.to)) {
          out.add(e.to)
          stack.push(e.to)
        }
      }
    }
    return out
  }
}

export interface BuildOpts {
  /** Ném lỗi nếu cạnh ordering có chu trình (mặc định false — traversal đã có cycle-guard). */
  readonly assertDag?: boolean
}

/**
 * Tìm một chu trình trong cạnh ordering; trả mảng slug tạo vòng, hoặc null nếu là DAG.
 * Duyệt DFS ba-màu trên `unlockedBy`.
 */
export function findOrderingCycle(graph: SkillGraph): Slug[] | null {
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<Slug, number>()
  const parent = new Map<Slug, Slug | null>()

  const nodes = [...graph.nodes()].map((n) => n.slug)
  for (const s of nodes) color.set(s, WHITE)

  const buildCycle = (start: Slug, back: Slug): Slug[] => {
    const path: Slug[] = [start]
    let cur: Slug | null = start
    while (cur != null && cur !== back) {
      cur = parent.get(cur) ?? null
      if (cur != null) path.push(cur)
    }
    return path.reverse()
  }

  for (const root of nodes) {
    if (color.get(root) !== WHITE) continue
    const stack: Array<{ slug: Slug; i: number }> = [{ slug: root, i: 0 }]
    color.set(root, GRAY)
    parent.set(root, null)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as { slug: Slug; i: number }
      const edges = graph.unlockedBy(frame.slug)
      if (frame.i < edges.length) {
        const next = (edges[frame.i] as SkillEdge).to
        frame.i++
        const c = color.get(next)
        if (c === GRAY) return buildCycle(frame.slug, next)
        if (c === WHITE) {
          color.set(next, GRAY)
          parent.set(next, frame.slug)
          stack.push({ slug: next, i: 0 })
        }
      } else {
        color.set(frame.slug, BLACK)
        stack.pop()
      }
    }
  }
  return null
}

/** Dựng đồ thị từ nodes+edges (đã ở dạng slug; cầu id→slug là việc của host, A.4). */
export function buildGraph(data: GraphData, opts: BuildOpts = {}): SkillGraph {
  const graph = new SkillGraph(data)
  if (opts.assertDag) {
    const cycle = findOrderingCycle(graph)
    if (cycle) {
      throw new Error(`Đồ thị ordering có chu trình: ${cycle.join(' → ')}`)
    }
  }
  return graph
}
