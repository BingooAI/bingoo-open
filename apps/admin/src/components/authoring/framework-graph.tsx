'use client'

import { useMemo } from 'react'
import type { GraphViewDto } from '@/lib/authoring-queries'

const W = 168 // bề rộng node
const H = 44 // chiều cao node
const GX = 72 // khoảng cách cột (theo độ sâu tiên quyết)
const GY = 18 // khoảng cách hàng
const OBJ_GAP = 80 // khoảng cách hàng objective → hàng KC

const ORDERING = new Set(['PREREQUISITE', 'ENABLES', 'COMPOSES'])

interface Placed {
  slug: string
  label: string
  kind: string
  x: number
  y: number
}

/**
 * Đồ thị framework: hàng trên = OBJECTIVE (mục tiêu), bên dưới = năng lực xếp theo ĐỘ SÂU TIÊN QUYẾT
 * (trái → phải = học trước → học sau). Nét liền = quan hệ thứ tự; nét đứt = MAPS_TO (mục tiêu neo vào KC).
 */
export function FrameworkGraph({ graph }: { graph: GraphViewDto }) {
  const { nodes, edges, width, height } = useMemo(() => layout(graph), [graph])

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-foreground-muted">
        Chưa có node nào trong khung này.
      </div>
    )
  }

  const pos = new Map(nodes.map((n) => [n.slug, n]))

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface p-4">
      <svg width={width} height={height} className="min-w-full" role="img" aria-label="Đồ thị khung năng lực">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border-strong" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const a = pos.get(e.from)
          const b = pos.get(e.to)
          if (!a || !b) return null
          const ordering = ORDERING.has(e.relType)
          // ordering: ra cạnh phải → vào cạnh trái. mapsTo: từ đáy objective xuống đỉnh KC.
          const x1 = ordering ? a.x + W : a.x + W / 2
          const y1 = ordering ? a.y + H / 2 : a.y + H
          const x2 = ordering ? b.x : b.x + W / 2
          const y2 = ordering ? b.y + H / 2 : b.y
          const mx = (x1 + x2) / 2
          const d = ordering
            ? `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`
          return (
            <path
              key={`${e.from}-${e.to}-${e.relType}-${i}`}
              d={d}
              fill="none"
              markerEnd="url(#arrow)"
              className={ordering ? 'stroke-border-strong' : 'stroke-primary/50'}
              strokeWidth={1.5}
              strokeDasharray={ordering ? undefined : '4 3'}
            />
          )
        })}

        {nodes.map((n) => {
          const isObj = n.kind === 'OBJECTIVE'
          return (
            <g key={n.slug}>
              <rect
                x={n.x}
                y={n.y}
                width={W}
                height={H}
                rx={10}
                className={
                  isObj ? 'fill-primary-soft stroke-primary' : 'fill-surface-muted stroke-border-strong'
                }
                strokeWidth={1}
              />
              <text
                x={n.x + W / 2}
                y={n.y + 18}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                {clip(n.label, 24)}
              </text>
              <text
                x={n.x + W / 2}
                y={n.y + 33}
                textAnchor="middle"
                className="fill-foreground-muted text-[9px]"
              >
                {isObj ? 'OBJECTIVE' : n.kind}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

function label(t: Record<string, string>, slug: string): string {
  return t.vi ?? t.en ?? Object.values(t)[0] ?? slug
}

/** Xếp chỗ: KC theo độ sâu tiên quyết (cột), OBJECTIVE dồn lên một hàng trên cùng. */
function layout(graph: GraphViewDto): {
  nodes: Placed[]
  edges: GraphViewDto['edges']
  width: number
  height: number
} {
  const objs = graph.nodes.filter((n) => n.kind === 'OBJECTIVE')
  const kcs = graph.nodes.filter((n) => n.kind !== 'OBJECTIVE')
  const kcSlugs = new Set(kcs.map((n) => n.slug))

  // độ sâu = số bậc tiên quyết trước nó (relax nhiều lượt; đồ thị là DAG nên hội tụ)
  const depth = new Map<string, number>(kcs.map((n) => [n.slug, 0]))
  const ord = graph.edges.filter((e) => ORDERING.has(e.relType) && kcSlugs.has(e.from) && kcSlugs.has(e.to))
  for (let pass = 0; pass < kcs.length; pass++) {
    let moved = false
    for (const e of ord) {
      const want = (depth.get(e.from) ?? 0) + 1
      if (want > (depth.get(e.to) ?? 0)) {
        depth.set(e.to, want)
        moved = true
      }
    }
    if (!moved) break
  }

  const byDepth = new Map<number, typeof kcs>()
  for (const n of kcs) {
    const d = depth.get(n.slug) ?? 0
    byDepth.set(d, [...(byDepth.get(d) ?? []), n])
  }

  const objRowH = objs.length ? H + OBJ_GAP : 0
  const placed: Placed[] = []

  for (const [d, list] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    list.forEach((n, i) => {
      placed.push({
        slug: n.slug,
        label: label(n.title, n.slug),
        kind: n.kind,
        x: d * (W + GX),
        y: objRowH + i * (H + GY),
      })
    })
  }

  objs.forEach((n, i) => {
    placed.push({
      slug: n.slug,
      label: label(n.title, n.slug),
      kind: n.kind,
      x: i * (W + GX),
      y: 0,
    })
  })

  const maxCols = Math.max(byDepth.size, objs.length, 1)
  const maxRows = Math.max(...[...byDepth.values()].map((l) => l.length), 1)
  return {
    nodes: placed,
    edges: graph.edges,
    width: maxCols * (W + GX) + 8,
    height: objRowH + maxRows * (H + GY) + 8,
  }
}
