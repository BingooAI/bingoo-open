/**
 * ConnectorEl.tsx — a flow arrow between two elements. Endpoints are computed in
 * the engine (frame) from the two boxes' laid-out edges, so it follows them when
 * they move. Draws a line + arrowhead (and optional label) in canvas coords.
 */
import * as React from 'react'
import type { RenderItem, ConnectorContent } from '@bingoo.ai/explainer'
import type { ThemeTokens } from '@bingoo.ai/explainer'
import { resolveStyle } from '../theme/tokens'
import { itemTransform } from './util'

export function ConnectorEl({ item, theme }: { item: RenderItem; theme: ThemeTokens }) {
  const c = item.content as ConnectorContent
  const s = resolveStyle(theme, item.style)
  const { opacity } = itemTransform(item)
  const { x1, y1, x2, y2, arrow, cx, cy } = c
  // ALWAYS a quadratic bezier through the control point (cx,cy). When cx,cy sits
  // at the chord midpoint the curve is a straight line; bend the midpoint handle
  // to make it flow any way you like. Arrow tangent = from control point → end.
  const ang = Math.atan2(y2 - cy, x2 - cx)
  const ah = Math.max(16, s.strokeWidth * 2.6)
  const a1x = x2 - ah * Math.cos(ang - Math.PI / 7),
    a1y = y2 - ah * Math.sin(ang - Math.PI / 7)
  const a2x = x2 - ah * Math.cos(ang + Math.PI / 7),
    a2y = y2 - ah * Math.sin(ang + Math.PI / 7)
  const bx = arrow ? x2 - ah * 0.85 * Math.cos(ang) : x2,
    by = arrow ? y2 - ah * 0.85 * Math.sin(ang) : y2
  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${bx} ${by}`
  const mx = 0.25 * x1 + 0.5 * cx + 0.25 * x2,
    my = 0.25 * y1 + 0.5 * cy + 0.25 * y2 // curve midpoint (t=0.5)
  return (
    <g opacity={opacity}>
      <path
        d={d}
        fill="none"
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c.dash ? `${s.strokeWidth * 2.4} ${s.strokeWidth * 1.8}` : undefined}
      />
      {arrow && <polygon points={`${x2},${y2} ${a1x},${a1y} ${a2x},${a2y}`} fill={s.stroke} />}
      {c.label ? (
        <>
          <rect
            x={mx - c.label.length * s.fontSize * 0.3 - 6}
            y={my - s.fontSize * 0.7}
            width={c.label.length * s.fontSize * 0.6 + 12}
            height={s.fontSize * 1.4}
            rx={6}
            fill={theme.colors?.paper ?? '#faf6ef'}
            opacity={0.9}
          />
          <text
            x={mx}
            y={my + s.fontSize * 0.35}
            fontSize={s.fontSize * 0.8}
            fill={s.stroke}
            textAnchor="middle"
            style={{ fontFamily: 'inherit' }}
          >
            {c.label}
          </text>
        </>
      ) : null}
    </g>
  )
}
