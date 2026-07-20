// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * fraction.ts — Fraction (kit #3). A bar or circle divided into `denominator`
 * equal parts, some shaded. verbs: split(n) · shade(k) · merge · compare(other)
 * · equivalent(n). Newly-shaded parts fill in on a baked progress.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, TOK } from './util'

export type FractionP = {
  denominator: number
  shaded: number[]
  shape: 'bar' | 'circle'
  compareTo: { denominator: number; shaded: number } | null
}

const DEFAULT: FractionP = { denominator: 2, shaded: [0], shape: 'bar', compareTo: null }

function normalize(raw: unknown): FractionP {
  const r = (raw ?? {}) as Partial<FractionP>
  const denominator = Math.max(1, Math.floor(r.denominator ?? 2))
  return {
    denominator,
    shaded: (r.shaded ?? [0]).filter((i) => i >= 0 && i < denominator),
    shape: r.shape === 'circle' ? 'circle' : 'bar',
    compareTo: r.compareTo ?? null,
  }
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<FractionP>['verbs'] = {
  split(p, args): VerbClip<FractionP> {
    const n = Math.max(1, Math.floor(num(args?.n ?? args ?? p.denominator)))
    return tween(p, { ...p, denominator: n, shaded: p.shaded.filter((i) => i < n) }, 0.5, 'easeOutCubic')
  },
  shade(p, args): VerbClip<FractionP> {
    const k = Math.max(0, Math.min(p.denominator, Math.floor(num(args?.k ?? args ?? 1))))
    const shaded = Array.from({ length: k }, (_, i) => i)
    return tween(p, { ...p, shaded }, 0.45, 'easeOutCubic')
  },
  merge(p): VerbClip<FractionP> {
    const n = Math.max(1, Math.floor(p.denominator / 2))
    const shaded = Array.from(new Set(p.shaded.map((i) => Math.floor(i / 2))))
    return tween(p, { ...p, denominator: n, shaded }, 0.5, 'spring')
  },
  equivalent(p, args): VerbClip<FractionP> {
    const f = Math.max(1, Math.floor(num(args?.n ?? args ?? 2)))
    const shaded: number[] = []
    for (const i of p.shaded) for (let j = 0; j < f; j++) shaded.push(i * f + j)
    return tween(p, { ...p, denominator: p.denominator * f, shaded }, 0.55, 'easeInOutCubic')
  },
  compare(p, args): VerbClip<FractionP> {
    const other = args?.other ?? args ?? {}
    const compareTo = {
      denominator: Math.max(1, Math.floor(num(other.denominator ?? 2))),
      shaded: Math.floor(num(other.shaded ?? 1)),
    }
    return tween(p, { ...p, compareTo }, 0.45, 'easeOutBack')
  },
}

function pieSlice(cx: number, cy: number, R: number, a0: number, a1: number): string {
  const x0 = cx + Math.cos(a0) * R
  const y0 = cy + Math.sin(a0) * R
  const x1 = cx + Math.cos(a1) * R
  const y1 = cy + Math.sin(a1) * R
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`
}

function drawFraction(
  prims: Prim[],
  den: number,
  shadedSet: Set<number>,
  shadeProg: (i: number) => number,
  box: { x: number; y: number; w: number; h: number },
  shape: 'bar' | 'circle',
) {
  if (shape === 'circle') {
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    const R = Math.min(box.w, box.h) * 0.46
    for (let i = 0; i < den; i++) {
      const a0 = -Math.PI / 2 + (i / den) * Math.PI * 2
      const a1 = -Math.PI / 2 + ((i + 1) / den) * Math.PI * 2
      const filled = shadedSet.has(i)
      prims.push({
        k: 'path',
        d: pieSlice(cx, cy, R, a0, a1),
        fill: filled ? TOK.accent : TOK.paper,
        color: TOK.ink,
        weight: 'sm',
        opacity: filled ? shadeProg(i) : 1,
        closed: true,
        z: 2,
      })
      if (!filled)
        prims.push({
          k: 'path',
          d: pieSlice(cx, cy, R, a0, a1),
          fill: 'none',
          color: TOK.ink,
          weight: 'sm',
          closed: true,
          z: 3,
        })
    }
  } else {
    const seg = box.w / den
    for (let i = 0; i < den; i++) {
      const filled = shadedSet.has(i)
      prims.push({
        k: 'rect',
        x: box.x + i * seg,
        y: box.y,
        w: seg,
        h: box.h,
        fill: filled ? TOK.accent : TOK.paper,
        color: TOK.ink,
        weight: 'sm',
        opacity: filled ? shadeProg(i) : 1,
        z: 2,
      })
    }
  }
}

function render(_params: FractionP, state: ManipState<FractionP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const newlyShaded = new Set(
    seg.verb === 'shade' || seg.verb === 'equivalent'
      ? P.shaded.filter((i) => !seg.from.shaded.includes(i))
      : [],
  )
  const shadeProg = (i: number) => (newlyShaded.has(i) ? clamp01(0.15 + seg.p) : 1)

  if (P.compareTo) {
    const half = box.w * 0.44
    drawFraction(
      prims,
      P.denominator,
      new Set(P.shaded),
      shadeProg,
      { x: box.w * 0.04, y: box.h * 0.2, w: half, h: box.h * 0.5 },
      P.shape,
    )
    const cShaded = new Set(Array.from({ length: P.compareTo.shaded }, (_, i) => i))
    drawFraction(
      prims,
      P.compareTo.denominator,
      cShaded,
      () => 1,
      { x: box.w * 0.52, y: box.h * 0.2, w: half, h: box.h * 0.5 },
      P.shape,
    )
    prims.push({
      k: 'label',
      x: box.w * 0.5,
      y: box.h * 0.5,
      text: '?',
      color: TOK.accent,
      size: box.h * 0.16,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    })
  } else {
    drawFraction(
      prims,
      P.denominator,
      new Set(P.shaded),
      shadeProg,
      { x: box.w * 0.1, y: box.h * 0.18, w: box.w * 0.8, h: box.h * 0.5 },
      P.shape,
    )
  }
  prims.push({
    k: 'label',
    x: box.w * 0.5,
    y: box.h * 0.88,
    text: `${P.shaded.length}/${P.denominator}`,
    color: TOK.ink,
    size: box.h * 0.12,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  })
  return { prims, view: box }
}

export const Fraction: Manipulative<FractionP> = {
  kind: 'fraction',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
