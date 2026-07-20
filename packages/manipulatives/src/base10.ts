// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * base10.ts — Base-10 blocks (kit #2). The regroup / "nhớ" (carry) is the whole
 * point: ten loose ones physically gather and snap into a single ten-rod (or ten
 * rods into a hundred-flat), driven by a baked progress so it seeks exactly.
 *
 * params: { hundreds, tens, ones }
 * verbs:  add(n) · remove(n) · group10 · regroup
 *
 * `value()` is verifiable by code — every verb conserves total value, so a test
 * can assert value(before) === value(after) rather than trusting a hardcoded
 * result.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, clamp01, TOK } from './util'

export type Base10P = { hundreds: number; tens: number; ones: number }

const DEFAULT: Base10P = { hundreds: 0, tens: 0, ones: 0 }

export function value(p: Base10P): number {
  return p.hundreds * 100 + p.tens * 10 + p.ones
}

function normalize(raw: unknown): Base10P {
  const r = (raw ?? {}) as Partial<Base10P>
  return {
    hundreds: Math.max(0, Math.floor(r.hundreds ?? 0)),
    tens: Math.max(0, Math.floor(r.tens ?? 0)),
    ones: Math.max(0, Math.floor(r.ones ?? 0)),
  }
}

/* --------------------------------------------------------------------- verbs */

const D_REGROUP = 0.75
const D_ADD = 0.4
const D_REMOVE = 0.35

/** One carry step, choosing the column that needs regrouping. Value-preserving. */
function regroupOnce(p: Base10P): Base10P {
  if (p.ones >= 10) return { ...p, ones: p.ones - 10, tens: p.tens + 1 }
  if (p.tens >= 10) return { ...p, tens: p.tens - 10, hundreds: p.hundreds + 1 }
  return p
}

const verbs: Manipulative<Base10P>['verbs'] = {
  add(p, args): VerbClip<Base10P> {
    const n = Math.max(0, Math.floor(num(args?.n ?? args ?? 1)))
    return tween(p, { ...p, ones: p.ones + n }, D_ADD, 'easeOutBack')
  },
  remove(p, args): VerbClip<Base10P> {
    const n = Math.max(0, Math.floor(num(args?.n ?? args ?? 1)))
    return tween(p, { ...p, ones: Math.max(0, p.ones - n) }, D_REMOVE, 'easeInCubic')
  },
  group10(p): VerbClip<Base10P> {
    const after = p.ones >= 10 ? { ...p, ones: p.ones - 10, tens: p.tens + 1 } : p
    return tween(p, after, D_REGROUP, 'easeInOutCubic')
  },
  regroup(p): VerbClip<Base10P> {
    return tween(p, regroupOnce(p), D_REGROUP, 'easeInOutCubic')
  },
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/* -------------------------------------------------------------------- render */

type Geom = {
  u: number // unit cube edge
  gc: number // gap between columns
  gy: number // vertical gap between stacked ones
  yG: number // ground line
  onesX: number
  tensX: number
  hundX: number
  colH: number // rod height (10 cells)
}

function geomOf(box: { w: number; h: number }): Geom {
  const u = Math.min(box.h * 0.06, box.w * 0.05)
  return {
    u,
    gc: u * 0.4,
    gy: u * 0.18,
    yG: box.h * 0.86,
    hundX: box.w * 0.05,
    tensX: box.w * 0.4,
    onesX: box.w * 0.66,
    colH: 10 * u,
  }
}

/** Centre of the i-th ones cube (bottom-up, wrapping every 10 into a column). */
function onesCenter(i: number, g: Geom): { x: number; y: number } {
  const col = Math.floor(i / 10)
  const row = i % 10
  const step = g.u + g.gy
  return {
    x: g.onesX + col * (g.u + g.gc) + g.u / 2,
    y: g.yG - (row + 0.5) * step,
  }
}

/** Rod #i (a ten): its box + the centre of its j-th internal cell (bottom-up). */
function rodBox(i: number, g: Geom): { x: number; y: number; w: number; h: number } {
  return { x: g.tensX + i * (g.u + g.gc), y: g.yG - g.colH, w: g.u, h: g.colH }
}
function rodCellCenter(i: number, j: number, g: Geom): { x: number; y: number } {
  return { x: g.tensX + i * (g.u + g.gc) + g.u / 2, y: g.yG - (j + 0.5) * g.u }
}
function flatBox(i: number, g: Geom): { x: number; y: number; s: number } {
  const s = g.colH // 10u square
  return { x: g.hundX + i * (s + g.gc), y: g.yG - s, s }
}

function pushCube(prims: Prim[], cx: number, cy: number, u: number, opacity: number, fill: string) {
  prims.push({
    k: 'rect',
    x: cx - u / 2,
    y: cy - u / 2,
    w: u,
    h: u,
    fill,
    color: TOK.ink,
    weight: 'sm',
    rx: u * 0.14,
    opacity,
    z: 4,
  })
}

function pushRod(prims: Prim[], i: number, g: Geom, opacity: number) {
  const r = rodBox(i, g)
  prims.push({
    k: 'rect',
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    fill: TOK.accent2,
    color: TOK.ink,
    weight: 'sm',
    rx: g.u * 0.14,
    opacity,
    z: 3,
  })
  for (let j = 1; j < 10; j++) {
    const y = r.y + j * g.u
    prims.push({
      k: 'line',
      x1: r.x,
      y1: y,
      x2: r.x + r.w,
      y2: y,
      color: TOK.ink,
      weight: 'sm',
      opacity: opacity * 0.55,
      z: 3,
    })
  }
}

function pushFlat(prims: Prim[], i: number, g: Geom, opacity: number) {
  const f = flatBox(i, g)
  prims.push({
    k: 'rect',
    x: f.x,
    y: f.y,
    w: f.s,
    h: f.s,
    fill: TOK.good,
    color: TOK.ink,
    weight: 'sm',
    rx: g.u * 0.14,
    opacity,
    z: 2,
  })
  for (let j = 1; j < 10; j++) {
    prims.push({
      k: 'line',
      x1: f.x,
      y1: f.y + j * g.u,
      x2: f.x + f.s,
      y2: f.y + j * g.u,
      color: TOK.ink,
      weight: 'sm',
      opacity: opacity * 0.4,
      z: 2,
    })
    prims.push({
      k: 'line',
      x1: f.x + j * g.u,
      y1: f.y,
      x2: f.x + j * g.u,
      y2: f.y + f.s,
      color: TOK.ink,
      weight: 'sm',
      opacity: opacity * 0.4,
      z: 2,
    })
  }
}

function render(_params: Base10P, state: ManipState<Base10P>, t: number, ctx: RenderCtx): ManipModel {
  const g = geomOf(ctx.box)
  const seg = activeSegment(state, t)
  const from = seg.from
  const to = seg.to
  const p = seg.p
  const prims: Prim[] = []

  const isCarry = seg.verb === 'regroup' || seg.verb === 'group10'
  const onesToTens = isCarry && to.tens === from.tens + 1 && to.ones === from.ones - 10
  const tensToHund = seg.verb === 'regroup' && to.hundreds === from.hundreds + 1 && to.tens === from.tens - 10

  if (onesToTens && p < 1) {
    // hundreds + existing tens static
    for (let i = 0; i < to.hundreds; i++) pushFlat(prims, i, g, 1)
    for (let i = 0; i < from.tens; i++) pushRod(prims, i, g, 1)
    // remaining ones static
    for (let i = 0; i < to.ones; i++) {
      const c = onesCenter(i, g)
      pushCube(prims, c.x, c.y, g.u, 1, TOK.warn)
    }
    // new rod fades in as the ones snap home
    const rodIn = clamp01((p - 0.5) / 0.5)
    if (rodIn > 0) pushRod(prims, from.tens, g, rodIn)
    // the 10 travelling ones: src (from layout) → the rod's 10 cells
    const moveEase = clamp01(p / 0.85)
    const cubeOut = p < 0.82 ? 1 : 1 - clamp01((p - 0.82) / 0.18)
    for (let k = 0; k < 10; k++) {
      const src = onesCenter(to.ones + k, g)
      const dst = rodCellCenter(from.tens, k, g)
      pushCube(prims, lerp(src.x, dst.x, moveEase), lerp(src.y, dst.y, moveEase), g.u, cubeOut, TOK.warn)
    }
  } else if (tensToHund && p < 1) {
    for (let i = 0; i < to.ones; i++) {
      const c = onesCenter(i, g)
      pushCube(prims, c.x, c.y, g.u, 1, TOK.warn)
    }
    for (let i = 0; i < to.tens; i++) pushRod(prims, i, g, 1)
    for (let i = 0; i < from.hundreds; i++) pushFlat(prims, i, g, 1)
    const flatIn = clamp01((p - 0.5) / 0.5)
    if (flatIn > 0) pushFlat(prims, from.hundreds, g, flatIn)
    // 10 rods drift toward the new flat and fade
    const f = flatBox(from.hundreds, g)
    const moveEase = clamp01(p / 0.85)
    const rodOut = 1 - clamp01((p - 0.6) / 0.4)
    for (let k = 0; k < 10; k++) {
      const r = rodBox(to.tens + k, g)
      const dx = lerp(0, f.x + k * g.u - r.x, moveEase)
      const dy = lerp(0, f.y - r.y, moveEase)
      prims.push({
        k: 'rect',
        x: r.x + dx,
        y: r.y + dy,
        w: r.w,
        h: r.h,
        fill: TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        rx: g.u * 0.14,
        opacity: rodOut,
        z: 3,
      })
    }
  } else {
    // settled state (also covers add/remove, which animate the ones delta)
    for (let i = 0; i < to.hundreds; i++) pushFlat(prims, i, g, 1)
    for (let i = 0; i < to.tens; i++) pushRod(prims, i, g, 1)
    const addBase = Math.min(from.ones, to.ones)
    for (let i = 0; i < to.ones; i++) {
      const c = onesCenter(i, g)
      let op = 1
      let sc = g.u
      if (seg.verb === 'add' && i >= addBase) {
        op = seg.p
        sc = g.u * (0.4 + 0.6 * seg.p)
      }
      pushCube(prims, c.x, c.y, sc, op, TOK.warn)
    }
    // removed ones fade out where they used to be
    if (seg.verb === 'remove') {
      for (let i = to.ones; i < from.ones; i++) {
        const c = onesCenter(i, g)
        pushCube(prims, c.x, c.y - lerp(0, g.u * 0.6, seg.p), g.u, 1 - seg.p, TOK.warn)
      }
    }
  }

  // value readout
  const val =
    onesToTens || tensToHund || seg.verb === 'add' || seg.verb === 'remove'
      ? value(p < 1 ? from : to)
      : value(to)
  prims.push({
    k: 'label',
    x: ctx.box.w * 0.5,
    y: ctx.box.h * 0.06,
    text: String(onesToTens || tensToHund ? value(to) : val),
    color: TOK.ink,
    size: Math.max(16, ctx.box.h * 0.1),
    align: 'middle',
    baseline: 'middle',
    z: 6,
  })

  return { prims, view: ctx.box }
}

export const Base10Block: Manipulative<Base10P> = {
  kind: 'base10',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
