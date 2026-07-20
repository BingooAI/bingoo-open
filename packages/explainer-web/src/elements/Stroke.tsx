// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Stroke.tsx — whiteboard stroke with drawOn (spec §8 default look, B4).
 * The path lives in a 0..100 local box; we normalize pathLength to 1 so
 * `strokeDashoffset = 1 - drawProgress` self-draws regardless of path length.
 */
import * as React from 'react'
import type { RenderItem, StrokeContent } from '@bingoo.ai/explainer'
import type { ThemeTokens } from '@bingoo.ai/explainer'
import { resolveStyle } from '../theme/tokens'
import { getRegister } from '../theme/registers'
import { itemTransform } from './util'

export function Stroke({ item, theme }: { item: RenderItem; theme: ThemeTokens }) {
  const c = item.content as StrokeContent
  const { transform, opacity } = itemTransform(item)
  const s = resolveStyle(theme, item.style)
  const reg = getRegister(item.style?.register ?? theme.register)
  const draw = item.pose.drawProgress
  const dashProps =
    draw !== undefined ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw } : {}

  // scale local 0..100 box to the element rect
  const sx = item.rect.w / 100
  const sy = item.rect.h / 100

  return (
    <g transform={transform} opacity={opacity}>
      <g transform={`scale(${sx} ${sy})`}>
        <path
          d={c.path}
          fill={s.fill}
          stroke={s.stroke}
          strokeWidth={(s.strokeWidth / Math.max(sx, sy)) * (1 + reg.widthVary * 0.2)}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...dashProps}
        />
      </g>
    </g>
  )
}
