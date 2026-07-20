// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * ImageEl.tsx — renders an `image` element from a media library: `content.src`
 * is any URL/path (Cloudflare R2, local project asset, or data-URI), raster or
 * SVG. Drawn into the element's laid-out box with the shared pose transform.
 */
import * as React from 'react'
import type { RenderItem, ImageContent } from '@bingoo.ai/explainer'
import type { ThemeTokens } from '@bingoo.ai/explainer'
import { itemTransform } from './util'

export function ImageEl({ item, theme }: { item: RenderItem; theme: ThemeTokens }) {
  const c = item.content as ImageContent
  const { transform, opacity } = itemTransform(item)
  const w = Math.max(0, item.rect.w)
  const h = Math.max(0, item.rect.h)

  // No src yet, but the lesson asked for a picture (content.prompt): show a
  // labelled placeholder so there's no empty hole — image provider not
  // configured, or generation still pending/failed.
  if (!c.src) {
    const label = c.alt || c.query || c.prompt
    if (!label) return null
    return (
      <g transform={transform} opacity={opacity}>
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={Math.min(w, h) * 0.06}
          fill="#f2ece1"
          stroke="#d8cfc2"
          strokeWidth={2}
          strokeDasharray="8 7"
        />
        <text
          x={w / 2}
          y={h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.max(12, Math.min(w, h) * 0.11)}
          fill="#a99f92"
          style={{ fontFamily: theme.fonts?.sans }}
        >
          {'🖼 ' + (label.length > 22 ? label.slice(0, 22) + '…' : label)}
        </text>
      </g>
    )
  }
  return (
    <g transform={transform} opacity={opacity}>
      <image
        href={c.src}
        x={0}
        y={0}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid meet"
        aria-label={c.alt}
      />
    </g>
  )
}
