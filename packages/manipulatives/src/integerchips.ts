/**
 * integerchips.ts — IntegerChips (số nguyên âm — chip dương/âm & cặp triệt tiêu).
 * Middle-school (THCS, grade 6) integers: plus chips live in a top zone, minus
 * chips in a bottom zone; `cancelPairs` slides one +/− pair at a time into the
 * middle lane (ring + connecting line = "this pair makes zero"), then the pair
 * fades to a ghost. The value pos−neg is CONSERVED by cancelPairs — verifiable
 * by code via `chipsValue()`. verbs: addPos(n) · addNeg(n) · cancelPairs ·
 * showValue.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, clamp01, TOK } from './util'

export type IntegerChipsP = {
  pos: number
  neg: number
  showValue: boolean
  /** how many zero-pairs are currently visually paired (ghosted in the lane). */
  pairing: number
}

const MAX = 12
const DEFAULT: IntegerChipsP = { pos: 4, neg: 2, showValue: false, pairing: 0 }

/** The logical value of the chip board — conserved by cancelPairs. */
export function chipsValue(p: IntegerChipsP): number {
  return p.pos - p.neg
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalize(raw: unknown): IntegerChipsP {
  const r = (raw ?? {}) as Partial<IntegerChipsP>
  const pos = Math.min(MAX, Math.max(0, Math.floor(num(r.pos ?? 0))))
  const neg = Math.min(MAX, Math.max(0, Math.floor(num(r.neg ?? 0))))
  const pairing = Math.min(Math.min(pos, neg), Math.max(0, Math.floor(num(r.pairing ?? 0))))
  return { pos, neg, showValue: !!r.showValue, pairing }
}

/* --------------------------------------------------------------------- verbs */

const verbs: Manipulative<IntegerChipsP>['verbs'] = {
  addPos(p, args): VerbClip<IntegerChipsP> {
    const n = Math.max(0, Math.floor(num(args?.n ?? args ?? 1)))
    return tween(p, { ...p, pos: Math.min(MAX, p.pos + n) }, 0.4, 'easeOutBack')
  },
  addNeg(p, args): VerbClip<IntegerChipsP> {
    const n = Math.max(0, Math.floor(num(args?.n ?? args ?? 1)))
    return tween(p, { ...p, neg: Math.min(MAX, p.neg + n) }, 0.4, 'easeOutBack')
  },
  /** Pair up min(pos,neg) zero-pairs one after another; value is conserved. */
  cancelPairs(p): VerbClip<IntegerChipsP> {
    const k = Math.min(p.pos, p.neg)
    const before = { ...p, pairing: 0 }
    const after = { ...p, pos: p.pos - k, neg: p.neg - k, pairing: 0 }
    return tween(before, after, Math.min(0.9, 0.35 + 0.1 * k), 'easeInOutCubic')
  },
  showValue(p): VerbClip<IntegerChipsP> {
    return tween(p, { ...p, showValue: true }, 0.35, 'easeOutBack')
  },
}

/* -------------------------------------------------------------------- render */

type Geom = {
  cols: number
  cell: number
  ox: number
  topY: number
  botY: number
  midY: number
  r: number
}

function geomOf(box: { w: number; h: number }): Geom {
  const cols = 6
  const cell = Math.min((box.w * 0.86) / cols, box.h * 0.14)
  return {
    cols,
    cell,
    ox: (box.w - cols * cell) / 2,
    topY: box.h * 0.08,
    botY: box.h * 0.92,
    midY: box.h * 0.5,
    r: cell * 0.36,
  }
}

/** Centre of the i-th plus chip (top zone, rows grow downward). */
function posCenter(i: number, g: Geom): { x: number; y: number } {
  return {
    x: g.ox + ((i % g.cols) + 0.5) * g.cell,
    y: g.topY + (Math.floor(i / g.cols) + 0.5) * g.cell,
  }
}
/** Centre of the i-th minus chip (bottom zone, rows grow upward). */
function negCenter(i: number, g: Geom): { x: number; y: number } {
  return {
    x: g.ox + ((i % g.cols) + 0.5) * g.cell,
    y: g.botY - (Math.floor(i / g.cols) + 0.5) * g.cell,
  }
}
/** Meeting slot of pair j in the middle lane (lane is left-shifted so the value
 *  readout at the right never collides with ghost pairs). */
function pairSlot(j: number, k: number, g: Geom, box: { w: number; h: number }): { x: number; r: number } {
  const cellP = Math.min(g.cell, (box.w * 0.72) / Math.max(k, 1))
  return { x: box.w * 0.07 + (j + 0.5) * cellP, r: Math.min(g.r, cellP * 0.38) }
}

function chip(prims: Prim[], cx: number, cy: number, r: number, sign: 1 | -1, op: number) {
  if (op <= 0.01 || r <= 0.5) return
  prims.push({
    k: 'circle',
    cx,
    cy,
    r,
    fill: sign > 0 ? TOK.accent : TOK.accent2,
    color: TOK.ink,
    weight: 'sm',
    opacity: op,
    z: 4,
  })
  prims.push({
    k: 'label',
    x: cx,
    y: cy,
    text: sign > 0 ? '+' : '−',
    color: TOK.paper,
    size: r * 1.3,
    align: 'middle',
    baseline: 'middle',
    opacity: op,
    z: 5,
  })
}

function render(
  _params: IntegerChipsP,
  state: ManipState<IntegerChipsP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const g = geomOf(box)
  const seg = activeSegment(state, t)
  const F = seg.from
  const T = seg.to
  const prims: Prim[] = []

  // zone frames + sign markers (symbols only — no hardcoded language)
  const zx = g.ox - g.cell * 0.25
  const zw = g.cols * g.cell + g.cell * 0.5
  prims.push({
    k: 'rect',
    x: zx,
    y: box.h * 0.05,
    w: zw,
    h: box.h * 0.36,
    fill: 'none',
    color: TOK.faint,
    weight: 'sm',
    rx: g.cell * 0.2,
    z: 1,
  })
  prims.push({
    k: 'rect',
    x: zx,
    y: box.h * 0.59,
    w: zw,
    h: box.h * 0.36,
    fill: 'none',
    color: TOK.faint,
    weight: 'sm',
    rx: g.cell * 0.2,
    z: 1,
  })
  prims.push({
    k: 'label',
    x: zx + g.cell * 0.4,
    y: box.h * 0.05 + g.cell * 0.38,
    text: '+',
    color: TOK.soft,
    size: g.cell * 0.45,
    align: 'middle',
    baseline: 'middle',
    z: 2,
  })
  prims.push({
    k: 'label',
    x: zx + g.cell * 0.4,
    y: box.h * 0.95 - g.cell * 0.38,
    text: '−',
    color: TOK.soft,
    size: g.cell * 0.45,
    align: 'middle',
    baseline: 'middle',
    z: 2,
  })

  // who is paired right now? during cancelPairs the last K of each side pair
  // one after another (gated by seg.p, like count.ts gates added items).
  const isCancel = seg.verb === 'cancelPairs' && (F.pos !== T.pos || F.neg !== T.neg)
  const basePos = isCancel ? T.pos : T.pos - T.pairing
  const baseNeg = isCancel ? T.neg : T.neg - T.pairing
  const K = isCancel ? F.pos - T.pos : T.pairing
  const qOf = isCancel ? (j: number) => clamp01(seg.p * K - j) : (_j: number) => 1

  // unpaired chips in their zones (new ones pop with seg.p)
  for (let i = 0; i < basePos; i++) {
    const c = posCenter(i, g)
    let op = 1
    let rr = g.r
    if (seg.verb === 'addPos' && i >= F.pos - F.pairing) {
      op = seg.p
      rr = g.r * (0.4 + 0.6 * seg.p)
    }
    chip(prims, c.x, c.y, rr, 1, op)
  }
  for (let i = 0; i < baseNeg; i++) {
    const c = negCenter(i, g)
    let op = 1
    let rr = g.r
    if (seg.verb === 'addNeg' && i >= F.neg - F.pairing) {
      op = seg.p
      rr = g.r * (0.4 + 0.6 * seg.p)
    }
    chip(prims, c.x, c.y, rr, -1, op)
  }

  // paired chips: travel to the middle lane, ring + connecting line show the
  // one-to-one zero pair, then both fade to ghosts (opacity → 0.25).
  for (let j = 0; j < K; j++) {
    const q = qOf(j)
    const a = posCenter(basePos + j, g)
    const b = negCenter(baseNeg + j, g)
    const m = pairSlot(j, K, g, box)
    const px = lerp(a.x, m.x, q)
    const py = lerp(a.y, g.midY - m.r * 1.1, q)
    const nx = lerp(b.x, m.x, q)
    const ny = lerp(b.y, g.midY + m.r * 1.1, q)
    const rr = lerp(g.r, m.r, q)
    const op = 1 - 0.75 * q // ghost at 0.25 once fully paired
    if (q > 0.1) {
      const lo = clamp01((q - 0.1) / 0.5)
      prims.push({
        k: 'line',
        x1: px,
        y1: py,
        x2: nx,
        y2: ny,
        color: TOK.warn,
        weight: 'sm',
        cap: 'round',
        opacity: lo * 0.8,
        z: 3,
      })
      const ringR = Math.hypot(nx - px, ny - py) / 2 + rr * 1.25
      prims.push({
        k: 'circle',
        cx: (px + nx) / 2,
        cy: (py + ny) / 2,
        r: ringR,
        fill: 'none',
        color: TOK.warn,
        weight: 'sm',
        opacity: lo * 0.6,
        z: 3,
      })
    }
    chip(prims, px, py, rr, 1, op)
    chip(prims, nx, ny, rr, -1, op)
  }

  // value readout (computed pos − neg; conserved during cancelPairs)
  if (T.showValue) {
    const pop = seg.verb === 'showValue' ? seg.p : 1
    const val = chipsValue(T)
    const txt = val < 0 ? `−${Math.abs(val)}` : String(val)
    prims.push({
      k: 'label',
      x: box.w * 0.94,
      y: g.midY,
      text: txt,
      color: TOK.good,
      size: Math.min(box.h * 0.12, box.w * 0.14) * (0.6 + 0.4 * pop),
      align: 'end',
      baseline: 'middle',
      opacity: pop,
      z: 6,
    })
  }

  return { prims, view: box }
}

export const IntegerChips: Manipulative<IntegerChipsP> = {
  kind: 'integerchips',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
