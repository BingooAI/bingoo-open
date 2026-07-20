// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Thumb.tsx — a tiny visual preview of an object, so media tiles and timeline
 * clips SHOW what they are (a real shape/prop/asset drawing, a text glyph, a
 * stick figure, a diagram, or a subject icon for manipulatives).
 */
'use client'
import * as React from 'react'
import { getProp } from '../../kit/props'
import { manipInfo } from '../manipCatalog'

const SUBJECT_ICON: Record<string, string> = { math: '🔢', english: '🔤', science: '🔬' }

export function Thumb({
  type,
  name,
  stroke = '#e8eaed',
  box = 26,
}: {
  type: string
  name: string
  stroke?: string
  box?: number
}) {
  const svg = (children: React.ReactNode) => (
    <svg
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {children}
    </svg>
  )
  const ctx = {
    w: box,
    h: box,
    stroke,
    fill: 'none',
    strokeWidth: 2,
    t: 0,
    seed: 3,
    fillOpacity: 0,
    draw: undefined as number | undefined,
  }

  switch (type) {
    case 'shape':
      return svg(<g style={{ color: stroke }}>{getProp(name)(ctx)}</g>)
    case 'text':
      return svg(
        <text
          x={box / 2}
          y={box * 0.68}
          fontSize={box * 0.7}
          fontWeight={700}
          fill={stroke}
          textAnchor="middle"
        >
          Aa
        </text>,
      )
    case 'stick':
      return svg(
        <g stroke={stroke} strokeWidth={1.8} fill="none" strokeLinecap="round">
          <circle cx={box / 2} cy={box * 0.24} r={box * 0.13} />
          <line x1={box / 2} y1={box * 0.37} x2={box / 2} y2={box * 0.66} />
          <line x1={box / 2} y1={box * 0.45} x2={box * 0.28} y2={box * 0.56} />
          <line x1={box / 2} y1={box * 0.45} x2={box * 0.72} y2={box * 0.56} />
          <line x1={box / 2} y1={box * 0.66} x2={box * 0.34} y2={box * 0.86} />
          <line x1={box / 2} y1={box * 0.66} x2={box * 0.66} y2={box * 0.86} />
        </g>,
      )
    case 'diagram':
      return svg(
        <g stroke={stroke} strokeWidth={1.6} fill="none">
          <rect x={box * 0.1} y={box * 0.35} width={box * 0.3} height={box * 0.3} rx={3} />
          <rect x={box * 0.6} y={box * 0.35} width={box * 0.3} height={box * 0.3} rx={3} />
          <line x1={box * 0.4} y1={box * 0.5} x2={box * 0.6} y2={box * 0.5} />
        </g>,
      )
    case 'stroke':
      return svg(
        <path
          d={`M ${box * 0.1} ${box * 0.6} Q ${box * 0.5} ${box * 0.1} ${box * 0.9} ${box * 0.6}`}
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />,
      )
    case 'manipulative':
      return svg(
        <text x={box / 2} y={box * 0.72} fontSize={box * 0.7} textAnchor="middle">
          {SUBJECT_ICON[manipInfo(name)?.subject ?? 'math']}
        </text>,
      )
    default:
      return svg(
        <rect
          x={box * 0.15}
          y={box * 0.15}
          width={box * 0.7}
          height={box * 0.7}
          rx={4}
          stroke={stroke}
          strokeWidth={1.6}
          fill="none"
        />,
      )
  }
}
