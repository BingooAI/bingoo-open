// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * DiagramEl.tsx — first-class diagram/flow (spec §10.1, FR-C-13). Nodes and
 * edges are positioned by the engine's graph auto-layout (absolute canvas
 * coords, stable-final-layout) and built progressively: `revealNode` pops a
 * node, `connect` self-draws an edge, `highlightPath` dims the rest.
 */
import * as React from 'react'
import type { RenderItem, DiagramContent } from '@bingoo.ai/explainer'
import type { ThemeTokens } from '@bingoo.ai/explainer'
import { resolveStyle } from '../theme/tokens'
import { getRegister } from '../theme/registers'
import { clamp } from './util'

export function DiagramEl({ item, theme }: { item: RenderItem; theme: ThemeTokens }) {
  const c = item.content as DiagramContent
  const s = resolveStyle(theme, item.style)
  const reg = getRegister(item.style?.register ?? theme.register)
  const { graph, state, diagram } = c
  // Diagrams took ONLY opacity from their pose, so `emphasize` was a SILENT NO-OP
  // on them: a lesson could write {"verb":"emphasize","target":"<diagram>"} and
  // nothing whatsoever happened.
  //
  // They cannot use the shared `itemTransform`, though: a graph is laid out in
  // ABSOLUTE canvas coordinates (graphLayout already places every node inside the
  // element's rect), whereas itemTransform translates by rect.x/rect.y on the
  // assumption that children are rect-local. Applying it would offset the whole
  // graph twice. So the pose is applied AROUND THE RECT'S CENTRE instead.
  const { rect, pose } = item
  const opacity = clamp(pose.opacity ?? 1, 0, 1)
  const scale = (pose.scale ?? 1) * (1 + (pose.emphasis ?? 0) * 0.06)
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const transform =
    `translate(${pose.x ?? 0} ${pose.y ?? 0}) ` +
    (scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : '')
  const hasHighlight = state.highlight.size > 0

  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]))
  const labelByEdge = new Map(diagram.edges.map((e) => [e.id, e.label]))

  return (
    <g transform={transform} opacity={opacity}>
      {/* edges under nodes */}
      {graph.edges.map((e) => {
        const draw = state.edgeDraw.get(e.id) ?? 0
        if (draw <= 0.001 || e.points.length < 2) return null
        const dim = hasHighlight && !state.highlight.has(e.id) ? 0.28 : 1
        return (
          <Edge
            key={e.id}
            e={e}
            draw={draw}
            color={s.stroke}
            width={s.strokeWidth}
            dim={dim}
            label={labelByEdge.get(e.id)}
            font={s.fontFamily}
            fontSize={s.fontSize * 0.55}
            paper={theme.colors.paper ?? '#fff'}
          />
        )
      })}
      {/* nodes */}
      {diagram.nodes.map((n) => {
        const box = graph.nodes.get(n.id)
        if (!box) return null
        const reveal = state.nodeReveal.get(n.id) ?? 0
        if (reveal <= 0.001) return null
        const dim = hasHighlight && !state.highlight.has(n.id) ? 0.3 : 1
        return (
          <Node
            key={n.id}
            box={box}
            label={nodeById.get(n.id)?.label ?? n.id}
            shape={n.shape ?? 'box'}
            reveal={reveal}
            color={s.stroke}
            width={s.strokeWidth}
            fill={theme.colors.paper ?? '#fff'}
            font={s.fontFamily}
            fontSize={s.fontSize * 0.65}
            corner={reg.corner}
            dim={dim}
          />
        )
      })}
    </g>
  )
}

function Edge({
  e,
  draw,
  color,
  width,
  dim,
  label,
  font,
  fontSize,
  paper,
}: {
  e: { points: { x: number; y: number }[] }
  draw: number
  color: string
  width: number
  dim: number
  label?: string
  font: string
  fontSize: number
  paper: string
}) {
  const a = e.points[0]!
  const b = e.points[1]!
  // shorten to node borders (approx: pull in by node half-extent)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const pad = 100 // ~ half node width
  const sx = a.x + ux * pad * 0.9
  const sy = a.y + uy * pad * 0.55
  const ex = b.x - ux * pad * 0.9
  const ey = b.y - uy * pad * 0.55
  const d = `M ${sx} ${sy} L ${ex} ${ey}`
  const arrow = draw > 0.85 // head appears as the stroke completes
  const ah = 18
  return (
    <g opacity={dim}>
      <path
        d={d}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
      {arrow ? (
        <path
          d={`M ${ex - ux * ah - uy * ah * 0.6} ${ey - uy * ah + ux * ah * 0.6} L ${ex} ${ey} L ${ex - ux * ah + uy * ah * 0.6} ${ey - uy * ah - ux * ah * 0.6}`}
          stroke={color}
          strokeWidth={width}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={(draw - 0.85) / 0.15}
        />
      ) : null}
      {label && draw > 0.5 ? (
        <g opacity={(draw - 0.5) / 0.5} transform={`translate(${(sx + ex) / 2} ${(sy + ey) / 2})`}>
          <rect
            x={-fontSize * label.length * 0.34 - 6}
            y={-fontSize * 0.7}
            width={fontSize * label.length * 0.68 + 12}
            height={fontSize * 1.4}
            rx={6}
            fill={paper}
            stroke={color}
            strokeWidth={width * 0.4}
          />
          <text
            x={0}
            y={fontSize * 0.35}
            fontSize={fontSize}
            fill={color}
            textAnchor="middle"
            style={{ userSelect: 'none', fontFamily: font }}
          >
            {label}
          </text>
        </g>
      ) : null}
    </g>
  )
}

function Node({
  box,
  label,
  shape,
  reveal,
  color,
  width,
  fill,
  font,
  fontSize,
  corner,
  dim,
}: {
  box: { x: number; y: number; w: number; h: number }
  label: string
  shape: string
  reveal: number
  color: string
  width: number
  fill: string
  font: string
  fontSize: number
  corner: number
  dim: number
}) {
  // reveal drives a scale-in + fade (anticipation+settle via easeOutBack in engine)
  const sc = 0.6 + 0.4 * reveal
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const common = { stroke: color, strokeWidth: width, fill }
  let outline: React.ReactNode
  switch (shape) {
    case 'diamond':
      outline = (
        <polygon
          points={`${cx},${box.y} ${box.x + box.w},${cy} ${cx},${box.y + box.h} ${box.x},${cy}`}
          {...common}
        />
      )
      break
    case 'circle':
      outline = <ellipse cx={cx} cy={cy} rx={box.w / 2} ry={box.h / 2} {...common} />
      break
    case 'pill':
      outline = <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.h / 2} {...common} />
      break
    case 'box':
    default:
      outline = <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={corner} {...common} />
  }
  return (
    <g opacity={reveal * dim} transform={`translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`}>
      {outline}
      <text
        x={cx}
        y={cy + fontSize * 0.35}
        fontSize={fontSize}
        fill={color}
        textAnchor="middle"
        style={{ userSelect: 'none', fontFamily: font }}
      >
        {label}
      </text>
    </g>
  )
}
