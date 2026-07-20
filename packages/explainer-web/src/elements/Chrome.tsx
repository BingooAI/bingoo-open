// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Chrome.tsx — the persistent frame around every scene: a HEADER (which lesson,
 * how far in) and a FOOTER (the caption band).
 *
 * Without them a scene is a picture floating in space: the learner has no idea
 * what they are in, how long it is, or how far they've come, and the narration
 * has nowhere fixed to land. The bands are reserved by the LAYOUT engine
 * (`chromeOf`), so no element can ever collide with them — the header is not
 * decoration painted on top, it is territory the composition never owned.
 */
import * as React from 'react'
import type { ThemeTokens, Rect } from '@bingoo.ai/explainer'
import { resolveColor } from '../theme/tokens'
import { wrapText } from './util'

/** Same single colour path as Backdrop — see the note there. */
const c = (theme: ThemeTokens, id: string, _fb: string) => resolveColor(theme, id, id)

export function Header({
  rect,
  title,
  index,
  count,
  theme,
  unit,
}: {
  rect: Rect
  title: string
  index: number
  count: number
  theme: ThemeTokens
  /** the type unit (canvas short side) — keeps chrome type on the lesson's scale */
  unit: number
}) {
  const size = unit * 0.032
  const ink = c(theme, 'inkSoft', '#7d736a')
  const off = c(theme, 'faint', '#d8cfc2')
  const font = theme.fonts?.sans ?? 'system-ui, sans-serif'

  // The scene progress is intentionally NOT drawn here: in the player the
  // transport scrub already shows position + gate checkpoints, so a second
  // progress row on the slide was redundant clutter. The header keeps just the
  // lesson title + the divider rule. (`index`/`count` stay in the API for hosts
  // that render chrome without a transport.)
  void index
  void count

  return (
    <g aria-hidden>
      <text
        x={rect.x}
        y={rect.y + rect.h / 2 + size * 0.35}
        fontSize={size}
        fontWeight={700}
        fill={ink}
        style={{ fontFamily: font, userSelect: 'none', letterSpacing: '0.04em' }}
      >
        {title.toUpperCase()}
      </text>
      <line
        x1={rect.x}
        y1={rect.y + rect.h}
        x2={rect.x + rect.w}
        y2={rect.y + rect.h}
        stroke={off}
        strokeWidth={2}
        opacity={0.7}
      />
    </g>
  )
}

export function CaptionBand({
  rect,
  text,
  theme,
  unit,
}: {
  rect: Rect
  text: string | null
  theme: ThemeTokens
  unit: number
}) {
  if (!text) return null
  const size = unit * 0.042
  // A FLOATING PILL, not a band. The caption overlays the bottom of the content
  // (like a video subtitle) and is only as wide as the text — it must not read as
  // a reserved strip of the layout, because it no longer is one.
  const maxW = rect.w * 0.86
  const lines = wrapText(text, size, maxW)
  const lineH = size * 1.28
  const boxH = lines.length * lineH + size * 0.7
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0)
  const boxW = Math.min(maxW + size, longest * size * 0.56 + size * 1.6)
  const boxX = rect.x + rect.w / 2 - boxW / 2
  const boxY = rect.y + rect.h - boxH // sits at the very bottom of the frame
  const startY = boxY + boxH / 2 - (lines.length * lineH) / 2 + size * 0.82
  const cx = rect.x + rect.w / 2
  const font = theme.fonts?.sans ?? 'system-ui, sans-serif'

  return (
    <g aria-hidden>
      <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={boxH * 0.3} fill="#2b2724" opacity={0.82} />
      <text
        x={cx}
        y={startY}
        fontSize={size}
        fontWeight={600}
        fill="#fff"
        textAnchor="middle"
        style={{ fontFamily: font, userSelect: 'none' }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={cx} dy={i === 0 ? 0 : lineH}>
            {ln}
          </tspan>
        ))}
      </text>
    </g>
  )
}

/** A card behind an object's CELL — what turns floating shapes into a layout. */
export function SlotCard({ cell, theme }: { cell: Rect; theme: ThemeTokens }) {
  return (
    <rect
      x={cell.x}
      y={cell.y}
      width={cell.w}
      height={cell.h}
      rx={Math.min(cell.w, cell.h) * 0.08}
      fill={c(theme, 'paper', '#f7f2e9')}
      stroke={c(theme, 'faint', '#d8cfc2')}
      strokeWidth={2}
      opacity={0.85}
      aria-hidden
    />
  )
}
