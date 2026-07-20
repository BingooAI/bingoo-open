// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * numberline.ts — NumberLine manipulative (kit #1, the proof case).
 *
 * params:  { min, max, step, marks[] }
 * verbs:   jump(a,b) · mark(x) · highlightRange(a,b) · placePoint(x)
 *
 * render is a pure function of t: the traveler hops along a baked arc, ranges
 * sweep, points/marks grow in — all seek-exact and identical at 16:9 / 9:16
 * (the axis simply fills the region box width).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, mapRange, addedItems, fmt, TOK } from './util'

/** Logical state: authored params plus interaction fields folded by verbs. */
export type NumberLineP = {
  min: number
  max: number
  step: number
  marks: number[] // emphasised major ticks
  points: number[] // placed points
  point: number | null // the traveler (jump target)
  range: [number, number] | null // highlighted span
}

const DEFAULT: NumberLineP = {
  min: 0,
  max: 10,
  step: 1,
  marks: [],
  points: [],
  point: null,
  range: null,
}

function normalize(raw: unknown): NumberLineP {
  const r = (raw ?? {}) as Partial<NumberLineP>
  const min = r.min ?? DEFAULT.min
  const max = r.max ?? DEFAULT.max
  const step = r.step && r.step > 0 ? r.step : DEFAULT.step
  return {
    min,
    max,
    step,
    marks: [...(r.marks ?? [])],
    points: [...(r.points ?? [])],
    point: r.point ?? null,
    range: r.range ?? null,
  }
}

/* --------------------------------------------------------------------- verbs */

const D_JUMP = 0.6
const D_POINT = 0.45
const D_MARK = 0.4
const D_RANGE = 0.5

function withUnique(list: number[], x: number): number[] {
  return list.includes(x) ? list : [...list, x]
}

const verbs: Manipulative<NumberLineP>['verbs'] = {
  jump(p, args): VerbClip<NumberLineP> {
    const a = num(args?.a ?? args?.from ?? p.point ?? p.min)
    const b = num(args?.b ?? args?.to ?? p.max)
    const before: NumberLineP = { ...p, point: a }
    const after: NumberLineP = { ...p, point: b, points: withUnique(p.points, b) }
    return tween(before, after, D_JUMP, 'easeInOutCubic')
  },
  placePoint(p, args): VerbClip<NumberLineP> {
    const x = num(args?.x ?? args ?? p.min)
    const after: NumberLineP = { ...p, points: [...p.points, x], point: x }
    return tween(p, after, D_POINT, 'easeOutBack')
  },
  mark(p, args): VerbClip<NumberLineP> {
    const x = num(args?.x ?? args ?? p.min)
    const after: NumberLineP = { ...p, marks: [...p.marks, x].sort((m, n) => m - n) }
    return tween(p, after, D_MARK, 'easeOutBack')
  },
  highlightRange(p, args): VerbClip<NumberLineP> {
    const a = num(args?.a ?? args?.from ?? p.min)
    const b = num(args?.b ?? args?.to ?? p.max)
    const after: NumberLineP = { ...p, range: [a, b] }
    return tween(p, after, D_RANGE, 'easeOutCubic')
  },
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/* -------------------------------------------------------------------- render */

function render(_params: NumberLineP, state: ManipState<NumberLineP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to // the settled/target logical state; deltas animate by p
  const prims: Prim[] = []

  const padX = box.w * 0.08
  const y0 = box.h * 0.56
  const x = (v: number) => mapRange(v, P.min, P.max, padX, box.w - padX)
  const tickH = box.h * 0.05
  const labelSize = Math.max(
    12,
    Math.min(box.h * 0.09, ((box.w - 2 * padX) / Math.max(6, (P.max - P.min) / P.step)) * 0.5),
  )

  // highlighted range (under the axis) — sweeps from a→b while the verb runs
  if (P.range) {
    const [a, rb] = P.range
    const bNow = seg.verb === 'highlightRange' ? lerp(a, rb, seg.p) : rb
    prims.push({
      k: 'rect',
      x: Math.min(x(a), x(bNow)),
      y: y0 - box.h * 0.06,
      w: Math.abs(x(bNow) - x(a)),
      h: box.h * 0.12,
      fill: TOK.accent2,
      opacity: 0.28,
      z: 0,
    })
  }

  // main axis
  prims.push({
    k: 'line',
    x1: padX * 0.5,
    y1: y0,
    x2: box.w - padX * 0.5,
    y2: y0,
    color: TOK.ink,
    weight: 'md',
    cap: 'round',
    z: 1,
  })
  // right arrowhead
  const ax = box.w - padX * 0.5
  const ah = box.h * 0.03
  prims.push({
    k: 'path',
    d: `M ${ax - ah * 1.6} ${y0 - ah} L ${ax} ${y0} L ${ax - ah * 1.6} ${y0 + ah}`,
    color: TOK.ink,
    weight: 'md',
    z: 1,
  })

  // ticks + labels
  const nTicks = Math.round((P.max - P.min) / P.step)
  const labelEvery = nTicks <= 12 ? 1 : Math.ceil(nTicks / 12)
  for (let i = 0; i <= nTicks; i++) {
    const v = P.min + i * P.step
    const tx = x(v)
    prims.push({
      k: 'line',
      x1: tx,
      y1: y0 - tickH,
      x2: tx,
      y2: y0 + tickH,
      color: TOK.soft,
      weight: 'sm',
      z: 2,
    })
    if (i % labelEvery === 0) {
      prims.push({
        k: 'label',
        x: tx,
        y: y0 + tickH + labelSize * 1.1,
        text: fmt(v),
        color: TOK.soft,
        size: labelSize,
        align: 'middle',
        baseline: 'middle',
        z: 2,
      })
    }
  }

  // emphasised marks — the newest grows in while a mark verb runs
  const newMark = seg.verb === 'mark' ? addedItems(seg.from.marks, seg.to.marks)[0] : undefined
  for (const m of P.marks) {
    const grow = m === newMark ? seg.p : 1
    const tx = x(m)
    prims.push({
      k: 'line',
      x1: tx,
      y1: y0 - tickH * 1.9 * grow,
      x2: tx,
      y2: y0 + tickH * 1.9 * grow,
      color: TOK.accent,
      weight: 'md',
      cap: 'round',
      opacity: grow,
      z: 3,
    })
    prims.push({
      k: 'label',
      x: tx,
      y: y0 - tickH * 2.1 - labelSize * 0.4,
      text: fmt(m),
      color: TOK.accent,
      size: labelSize,
      align: 'middle',
      baseline: 'bottom',
      opacity: grow,
      z: 3,
    })
  }

  // placed points — newest scales in while placePoint runs
  const newPoint = seg.verb === 'placePoint' ? addedItems(seg.from.points, seg.to.points)[0] : undefined
  const rPt = box.h * 0.045
  for (const pt of P.points) {
    if (P.point !== null && pt === P.point && seg.verb === 'jump') continue // drawn as traveler
    const grow = pt === newPoint ? seg.p : 1
    prims.push({
      k: 'circle',
      cx: x(pt),
      cy: y0,
      r: rPt * grow,
      fill: TOK.accent,
      color: TOK.ink,
      weight: 'sm',
      opacity: grow,
      z: 4,
    })
  }

  // traveler — hops along a baked arc during jump
  if (P.point !== null) {
    if (seg.verb === 'jump') {
      const a = seg.from.point ?? P.min
      const b = seg.to.point ?? P.max
      const cur = lerp(a, b, seg.p)
      const hop = Math.sin(Math.PI * seg.p) * box.h * 0.34
      const cx = x(cur)
      const cy = y0 - hop
      // dashed arc trail from a to current
      const ax0 = x(a)
      const mx = (ax0 + cx) / 2
      const apex = Math.max(0, y0 - Math.sin(Math.PI * (seg.p * 0.5 + 0.0)) * box.h * 0.34) - box.h * 0.02
      prims.push({
        k: 'path',
        d: `M ${ax0} ${y0} Q ${mx} ${apex - hop * 0.4} ${cx} ${cy}`,
        color: TOK.accent,
        weight: 'sm',
        dash: 8,
        opacity: 0.8,
        z: 4,
      })
      prims.push({
        k: 'circle',
        cx,
        cy,
        r: rPt * 1.05,
        fill: TOK.accent,
        color: TOK.ink,
        weight: 'sm',
        z: 5,
      })
    } else {
      prims.push({
        k: 'circle',
        cx: x(P.point),
        cy: y0,
        r: rPt * 1.05,
        fill: TOK.accent,
        color: TOK.ink,
        weight: 'sm',
        z: 5,
      })
    }
  }

  return { prims, view: box }
}

export const NumberLine: Manipulative<NumberLineP> = {
  kind: 'numberline',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
