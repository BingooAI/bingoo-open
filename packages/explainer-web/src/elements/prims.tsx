// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * prims.tsx — shared SVG renderer for manipulative primitives. Used by both the
 * baked player element (ManipulativeEl) and the interactive sandbox, so a kit
 * looks identical whether it's playing or being manipulated. Resolves token ids
 * → theme colours; geometry is already in the drawing box's coordinates.
 */
import * as React from 'react'
import type { ThemeTokens } from '@bingoo.ai/explainer'
import type { Prim, Weight } from '@bingoo.ai/manipulatives'
import { SVG_ASSETS } from '../kit/svgAssets'

export function col(theme: ThemeTokens, id: string | undefined, fallback = 'ink'): string {
  if (!id) return theme.colors[fallback] ?? '#2b2724'
  if (id === 'none') return 'none'
  return theme.colors[id] ?? id
}
export function wgt(theme: ThemeTokens, w: Weight | undefined): number {
  if (typeof w === 'number') return w
  if (w && theme.weights[w] !== undefined) return theme.weights[w]
  return theme.weights.md ?? 7
}
const zOf = (p: Prim): number => ('z' in p && p.z !== undefined ? p.z : 0)

/* ------------------------------------------------------------- auto-fit */

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
export type Fit = { transform: string; s: number; tx: number; ty: number }

/** Approximate drawn bounds of a prim list (labels include their glyph extent;
 *  paths are skipped — kit paths stay within box). Used to shrink/center any
 *  kit's output so edge labels never clip. */
function primBounds(prims: Prim[]): Bounds | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  const ext = (x: number, y: number) => {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  for (const p of prims) {
    if ((p.opacity ?? 1) <= 0.01) continue
    switch (p.k) {
      case 'line':
        ext(p.x1, p.y1)
        ext(p.x2, p.y2)
        break
      case 'rect':
        ext(p.x, p.y)
        ext(p.x + p.w, p.y + p.h)
        break
      case 'circle':
        ext(p.cx - p.r, p.cy - p.r)
        ext(p.cx + p.r, p.cy + p.r)
        break
      case 'image':
        ext(p.x, p.y)
        ext(p.x + p.w, p.y + p.h)
        break
      case 'label': {
        const s = p.size ?? 24
        const w = (p.text ? p.text.length : 0) * s * 0.58
        const x0 = p.align === 'start' ? p.x : p.align === 'end' ? p.x - w : p.x - w / 2
        const y0 = p.baseline === 'top' ? p.y : p.baseline === 'bottom' ? p.y - s : p.y - s * 0.62
        const y1 = p.baseline === 'top' ? p.y + s : p.baseline === 'bottom' ? p.y : p.y + s * 0.62
        ext(x0, y0)
        ext(x0 + w, y1)
        break
      }
      // path: skipped (arcs make blind number-pairing unreliable; kit paths fit)
    }
  }
  if (!isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

/** Transform that scales (≤1) + centers `prims` to sit inside `box` with padding.
 *  Returns null when the content already fits, so kits that fit are untouched. */
/**
 * Fit drawn content to its box: contain-scale (preserving aspect) AND CENTRE it.
 *
 * It used to clamp the scale at 1 (`Math.min(1, …)`) — i.e. it only ever SHRANK
 * content that overflowed and otherwise left it at its natural size, wherever
 * that happened to be. That is why a manipulative rendered as a small cluster
 * adrift in a large slot: the layout handed it a big rect and the kit simply
 * didn't grow into it. Now the content also GROWS to fill its slot, so the same
 * kit is the same size in the same slot on every scene.
 */
export function computeFit(prims: Prim[], box: { w: number; h: number }, padFrac = 0.06): Fit | null {
  const b = primBounds(prims)
  if (!b) return null
  const pad = Math.min(box.w, box.h) * padFrac
  const availW = Math.max(1, box.w - 2 * pad),
    availH = Math.max(1, box.h - 2 * pad)
  const cw = Math.max(1, b.maxX - b.minX),
    ch = Math.max(1, b.maxY - b.minY)
  const s = Math.min(availW / cw, availH / ch) // ← may be > 1: grow to fill
  const tx = pad + (availW - cw * s) / 2 - b.minX * s
  const ty = pad + (availH - ch * s) / 2 - b.minY * s
  return { transform: `translate(${r3(tx)} ${r3(ty)}) scale(${r3(s)})`, s, tx, ty }
}

export function PrimShape({ p, theme, font }: { p: Prim; theme: ThemeTokens; font: string }) {
  switch (p.k) {
    case 'line':
      return (
        <line
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke={col(theme, p.color)}
          strokeWidth={wgt(theme, p.weight)}
          strokeLinecap={p.cap ?? 'round'}
          strokeDasharray={p.dash ? `${p.dash} ${p.dash}` : undefined}
          opacity={p.opacity ?? 1}
        />
      )
    case 'rect':
      return (
        <rect
          x={p.x}
          y={p.y}
          width={Math.max(0, p.w)}
          height={Math.max(0, p.h)}
          rx={p.rx}
          fill={p.fill ? col(theme, p.fill) : 'none'}
          stroke={p.color ? col(theme, p.color) : 'none'}
          strokeWidth={p.color ? wgt(theme, p.weight) : 0}
          opacity={p.opacity ?? 1}
        />
      )
    case 'circle':
      return (
        <circle
          cx={p.cx}
          cy={p.cy}
          r={Math.max(0, p.r)}
          fill={p.fill ? col(theme, p.fill) : 'none'}
          stroke={p.color ? col(theme, p.color) : 'none'}
          strokeWidth={p.color ? wgt(theme, p.weight) : 0}
          opacity={p.opacity ?? 1}
        />
      )
    case 'path':
      return (
        <path
          d={p.d}
          fill={p.fill && p.fill !== 'none' ? col(theme, p.fill) : 'none'}
          stroke={p.color ? col(theme, p.color) : 'none'}
          strokeWidth={p.color ? wgt(theme, p.weight) : 0}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={p.dash ? `${p.dash} ${p.dash}` : undefined}
          opacity={p.opacity ?? 1}
        />
      )
    case 'label':
      return (
        // fontFamily via `style` (not the attribute) so CSS var()-based font
        // stacks from next/font resolve on SVG <text>.
        <text
          x={p.x}
          y={p.y}
          fontSize={p.size ?? 24}
          fill={col(theme, p.color)}
          textAnchor={p.align ?? 'middle'}
          dominantBaseline={
            p.baseline === 'top' ? 'hanging' : p.baseline === 'bottom' ? 'alphabetic' : 'central'
          }
          opacity={p.opacity ?? 1}
          style={{ userSelect: 'none', fontFamily: font }}
        >
          {p.text}
        </text>
      )
    case 'image': {
      if (p.asset && SVG_ASSETS[p.asset]) {
        // built-in SVG asset: inline its markup (fill=currentColor → recolorable)
        const a = SVG_ASSETS[p.asset]!
        return (
          <g
            transform={`translate(${p.x} ${p.y}) scale(${p.w / a.viewW} ${p.h / 100})`}
            color={p.color ? col(theme, p.color) : undefined}
            opacity={p.opacity ?? 1}
            dangerouslySetInnerHTML={{ __html: a.markup }}
          />
        )
      }
      if (p.src) {
        return (
          <image
            href={p.src}
            x={p.x}
            y={p.y}
            width={Math.max(0, p.w)}
            height={Math.max(0, p.h)}
            preserveAspectRatio="xMidYMid meet"
            opacity={p.opacity ?? 1}
          />
        )
      }
      return null
    }
  }
}

/** Draw a list of prims sorted by z (stable). `transform` wraps them (auto-fit). */
export function Prims({
  prims,
  theme,
  transform,
}: {
  prims: Prim[]
  theme: ThemeTokens
  transform?: string
}) {
  // Manipulatives carry numbers/labels that must stay crisp & legible → the
  // clean sans token (Be Vietnam Pro via next/font), not the doodle "hand" font.
  const font =
    (theme.fonts ?? {})['sans'] ?? 'var(--font-bvp), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  const ordered = prims.map((p, i) => ({ p, i })).sort((a, b) => zOf(a.p) - zOf(b.p) || a.i - b.i)
  const body = ordered.map(({ p, i }) => <PrimShape key={i} p={p} theme={theme} font={font} />)
  return transform ? <g transform={transform}>{body}</g> : <>{body}</>
}
