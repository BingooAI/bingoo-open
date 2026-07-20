/**
 * algebratile.ts — AlgebraTiles (giải phương trình bằng gạch đại số). Middle
 * school (THCS, grades 6–8): model a linear equation on a two-sided mat —
 * x-tiles (long rects, labeled "x") and unit tiles (small squares); negative
 * tiles are hollow with a "−". Balance is enforced by the verbs themselves:
 * addBoth/removeBoth always act on BOTH sides, splitEqually regroups the unit
 * side into k rows aligned to the k x-tiles (the visual of dividing). The
 * solution is COMPUTED from the sides (never hardcoded) — see `tileSolution`.
 * verbs: addBoth(x,units) · removeBoth(x,units) · splitEqually · showSolution ·
 * setAnswer(v).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, fmt, TOK } from './util'

export type TileSide = { x: number; units: number }
export type AlgebraTilesP = {
  left: TileSide
  right: TileSide
  showSolution: boolean
  /** true after splitEqually: the unit side stays regrouped into k rows. */
  split: boolean
  /** learner's answer for grading (set via setAnswer); not displayed. */
  answer: number | null
}

const MAX_X = 6
const MAX_U = 12
const DEFAULT: AlgebraTilesP = {
  left: { x: 2, units: 3 },
  right: { x: 0, units: 7 },
  showSolution: false,
  split: false,
  answer: null,
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(v)))
}
function side(raw: unknown): TileSide {
  const r = (raw ?? {}) as Partial<TileSide>
  return {
    x: clampInt(num(r.x ?? 0), -MAX_X, MAX_X),
    units: clampInt(num(r.units ?? 0), -MAX_U, MAX_U),
  }
}

function normalize(raw: unknown): AlgebraTilesP {
  const r = (raw ?? {}) as Partial<AlgebraTilesP>
  return {
    left: side(r.left),
    right: side(r.right),
    showSolution: !!r.showSolution,
    split: !!r.split,
    answer: r.answer == null ? null : num(r.answer),
  }
}

/** The equation's solution, computed from the two sides (null if degenerate). */
export function tileSolution(p: AlgebraTilesP): number | null {
  const d = p.left.x - p.right.x
  if (d === 0) return null
  return (p.right.units - p.left.units) / d
}

/** splitEqually is meaningful when one side is only x-tiles and the other only units. */
function splitCase(p: AlgebraTilesP): { k: number; xSide: 'left' | 'right' } | null {
  if (p.left.x !== 0 && p.left.units === 0 && p.right.x === 0 && p.right.units !== 0)
    return { k: Math.abs(p.left.x), xSide: 'left' }
  if (p.right.x !== 0 && p.right.units === 0 && p.left.x === 0 && p.left.units !== 0)
    return { k: Math.abs(p.right.x), xSide: 'right' }
  return null
}

/* --------------------------------------------------------------------- verbs */

const verbs: Manipulative<AlgebraTilesP>['verbs'] = {
  /** Add the SAME tiles to both sides — balance preserved by construction. */
  addBoth(p, args): VerbClip<AlgebraTilesP> {
    const dx0 = Math.round(num(args?.x ?? 0))
    const du0 = Math.round(num(args?.units ?? 0))
    // clamp the DELTA so both sides stay in range together (truth preserved)
    const dx = Math.min(
      MAX_X - Math.max(p.left.x, p.right.x),
      Math.max(-MAX_X - Math.min(p.left.x, p.right.x), dx0),
    )
    const du = Math.min(
      MAX_U - Math.max(p.left.units, p.right.units),
      Math.max(-MAX_U - Math.min(p.left.units, p.right.units), du0),
    )
    const add = (s: TileSide): TileSide => ({ x: s.x + dx, units: s.units + du })
    return tween(p, { ...p, left: add(p.left), right: add(p.right), split: false }, 0.45, 'easeOutBack')
  },
  /** Remove the SAME tiles from both sides, clamped to what both sides have. */
  removeBoth(p, args): VerbClip<AlgebraTilesP> {
    const rx = Math.round(num(args?.x ?? 0))
    const ru = Math.round(num(args?.units ?? 0))
    const take = (want: number, a: number, b: number): number => {
      if (want > 0) return Math.min(want, Math.max(0, a), Math.max(0, b))
      if (want < 0) return -Math.min(-want, Math.max(0, -a), Math.max(0, -b))
      return 0
    }
    const ex = take(rx, p.left.x, p.right.x)
    const eu = take(ru, p.left.units, p.right.units)
    const after: AlgebraTilesP = {
      ...p,
      left: { x: p.left.x - ex, units: p.left.units - eu },
      right: { x: p.right.x - ex, units: p.right.units - eu },
      split: false,
    }
    return tween(p, after, 0.4, 'easeInCubic')
  },
  /** Regroup the unit side into k equal rows aligned to the k x-tiles. */
  splitEqually(p): VerbClip<AlgebraTilesP> {
    const ok = splitCase(p) !== null
    return tween(p, ok ? { ...p, split: true } : p, 0.7, 'easeInOutCubic')
  },
  showSolution(p): VerbClip<AlgebraTilesP> {
    return tween(p, { ...p, showSolution: true }, 0.4, 'easeOutBack')
  },
  setAnswer(p, args): VerbClip<AlgebraTilesP> {
    return tween(p, { ...p, answer: num(args?.v ?? args ?? 0) }, 0.3, 'easeOutCubic')
  },
}

/* -------------------------------------------------------------------- render */

type Rect = { x: number; y: number; w: number; h: number }
type Cnt = { px: number; nx: number; pu: number; nu: number }

function cnt(s: TileSide): Cnt {
  return {
    px: Math.max(0, s.x),
    nx: Math.max(0, -s.x),
    pu: Math.max(0, s.units),
    nu: Math.max(0, -s.units),
  }
}
function maxCnt(a: Cnt, b: Cnt): Cnt {
  return {
    px: Math.max(a.px, b.px),
    nx: Math.max(a.nx, b.nx),
    pu: Math.max(a.pu, b.pu),
    nu: Math.max(a.nu, b.nu),
  }
}

function halves(box: { w: number; h: number }): { L: Rect; R: Rect; portrait: boolean } {
  const portrait = box.h > box.w
  if (portrait) {
    return {
      portrait,
      L: { x: box.w * 0.05, y: box.h * 0.04, w: box.w * 0.9, h: box.h * 0.38 },
      R: { x: box.w * 0.05, y: box.h * 0.5, w: box.w * 0.9, h: box.h * 0.38 },
    }
  }
  return {
    portrait,
    L: { x: box.w * 0.03, y: box.h * 0.07, w: box.w * 0.44, h: box.h * 0.73 },
    R: { x: box.w * 0.53, y: box.h * 0.07, w: box.w * 0.44, h: box.h * 0.73 },
  }
}

/** Unit tile edge that lets this half's tiles fit (x-tiles stacked, units 4/row). */
function unitFor(half: Rect, c: Cnt): number {
  const xN = c.px + c.nx
  const uN = c.pu + c.nu
  const rows = Math.ceil(uN / 4)
  const needH = xN * 1.15 + rows * 1.15 + 0.8
  return Math.max(1, Math.min(half.w / 4.8, half.h / Math.max(needH, 3), half.h * 0.2))
}

/** Packed slot positions inside a half (x-tiles first, then the unit grid). */
function slots(half: Rect, c: Cnt, u: number) {
  const xN = c.px + c.nx
  const uN = c.pu + c.nu
  const rows = Math.ceil(uN / 4)
  const totalH = xN * 1.15 * u + rows * 1.15 * u + (xN > 0 && uN > 0 ? 0.5 * u : 0)
  const oy = half.y + Math.max(0, (half.h - totalH) / 2)
  const ox = half.x + Math.max(0, (half.w - 4.6 * u) / 2)
  const uy0 = oy + xN * 1.15 * u + (xN > 0 && uN > 0 ? 0.5 * u : 0)
  return {
    xTile: (i: number): Rect => ({ x: ox, y: oy + i * 1.15 * u, w: 2.8 * u, h: u }),
    uTile: (j: number): Rect => ({
      x: ox + (j % 4) * 1.15 * u,
      y: uy0 + Math.floor(j / 4) * 1.15 * u,
      w: u,
      h: u,
    }),
  }
}

/** One tile: positive = filled; negative = hollow with a "−". */
function tile(prims: Prim[], r: Rect, isX: boolean, sign: 1 | -1, op: number, u: number) {
  if (op <= 0.01 || r.w <= 0.5) return
  if (sign > 0) {
    prims.push({
      k: 'rect',
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      fill: isX ? TOK.accent : TOK.accent2,
      color: TOK.ink,
      weight: 'sm',
      rx: u * 0.15,
      opacity: op,
      z: 4,
    })
  } else {
    prims.push({
      k: 'rect',
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      fill: 'none',
      color: isX ? TOK.accent : TOK.accent2,
      weight: 'md',
      rx: u * 0.15,
      opacity: op,
      z: 4,
    })
  }
  const txt = isX ? (sign > 0 ? 'x' : '−x') : sign > 0 ? '' : '−'
  if (txt) {
    prims.push({
      k: 'label',
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      text: txt,
      color: sign > 0 ? TOK.paper : TOK.ink,
      size: u * 0.55,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 5,
    })
  }
}

type SplitInfo = { k: number; q: number; us: number; rowY: (r: number) => number; x0: number }

function drawSideTiles(
  prims: Prim[],
  half: Rect,
  fromS: TileSide,
  toS: TileSide,
  seg: { verb: string | null; p: number },
  u: number,
  split: SplitInfo | null,
) {
  const fc = cnt(fromS)
  const tc = cnt(toS)
  const shown = maxCnt(fc, tc)
  const S = slots(half, shown, u)
  const animCount = seg.verb === 'addBoth' || seg.verb === 'removeBoth'

  const drawCat = (
    fN: number,
    tN: number,
    base: number,
    isX: boolean,
    sign: 1 | -1,
    unitGlobal: (i: number) => number,
  ) => {
    const n = animCount ? Math.max(fN, tN) : tN
    for (let i = 0; i < n; i++) {
      let op = 1
      let grow = 1
      if (animCount && tN > fN && i >= fN) {
        op = seg.p // popping in together on both sides
        grow = 0.5 + 0.5 * seg.p
      }
      if (animCount && i >= tN) op = 1 - seg.p // fading out together
      let r: Rect = isX ? S.xTile(base + i) : S.uTile(base + i)
      if (!isX && split && i < tN) {
        // regrouped slot: unit j goes round-robin to row j % k
        const j = unitGlobal(i)
        const row = j % split.k
        const idx = Math.floor(j / split.k)
        const tgt: Rect = {
          x: split.x0 + idx * split.us * 1.15,
          y: split.rowY(row),
          w: split.us,
          h: split.us,
        }
        r = {
          x: lerp(r.x, tgt.x, split.q),
          y: lerp(r.y, tgt.y, split.q),
          w: lerp(r.w, tgt.w, split.q),
          h: lerp(r.h, tgt.h, split.q),
        }
      }
      if (grow !== 1) {
        const cx0 = r.x + r.w / 2
        const cy0 = r.y + r.h / 2
        r = { x: cx0 - (r.w * grow) / 2, y: cy0 - (r.h * grow) / 2, w: r.w * grow, h: r.h * grow }
      }
      tile(prims, r, isX, sign, op, u)
    }
  }

  drawCat(fc.px, tc.px, 0, true, 1, (i) => i)
  drawCat(fc.nx, tc.nx, shown.px, true, -1, (i) => i)
  drawCat(fc.pu, tc.pu, 0, false, 1, (i) => i)
  drawCat(fc.nu, tc.nu, shown.pu, false, -1, (i) => tc.pu + i)
}

function render(
  _params: AlgebraTilesP,
  state: ManipState<AlgebraTilesP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const F = seg.from
  const T = seg.to
  const prims: Prim[] = []
  const { L, R, portrait } = halves(box)

  // mat frames + "=" divider
  const rxr = Math.min(box.w, box.h) * 0.02
  prims.push({
    k: 'rect',
    x: L.x,
    y: L.y,
    w: L.w,
    h: L.h,
    fill: 'none',
    color: TOK.faint,
    weight: 'sm',
    rx: rxr,
    z: 1,
  })
  prims.push({
    k: 'rect',
    x: R.x,
    y: R.y,
    w: R.w,
    h: R.h,
    fill: 'none',
    color: TOK.faint,
    weight: 'sm',
    rx: rxr,
    z: 1,
  })
  const eqSize = Math.min(box.w, box.h) * 0.08
  if (portrait) {
    const y = (L.y + L.h + R.y) / 2
    prims.push({
      k: 'line',
      x1: L.x,
      y1: y,
      x2: box.w * 0.42,
      y2: y,
      color: TOK.soft,
      weight: 'sm',
      z: 1,
    })
    prims.push({
      k: 'line',
      x1: box.w * 0.58,
      y1: y,
      x2: L.x + L.w,
      y2: y,
      color: TOK.soft,
      weight: 'sm',
      z: 1,
    })
    prims.push({
      k: 'label',
      x: box.w / 2,
      y,
      text: '=',
      color: TOK.ink,
      size: eqSize,
      align: 'middle',
      baseline: 'middle',
      z: 6,
    })
  } else {
    const x = box.w / 2
    const my = L.y + L.h / 2
    prims.push({
      k: 'line',
      x1: x,
      y1: L.y,
      x2: x,
      y2: my - eqSize * 0.8,
      color: TOK.soft,
      weight: 'sm',
      z: 1,
    })
    prims.push({
      k: 'line',
      x1: x,
      y1: my + eqSize * 0.8,
      x2: x,
      y2: L.y + L.h,
      color: TOK.soft,
      weight: 'sm',
      z: 1,
    })
    prims.push({
      k: 'label',
      x,
      y: my,
      text: '=',
      color: TOK.ink,
      size: eqSize,
      align: 'middle',
      baseline: 'middle',
      z: 6,
    })
  }

  // shared unit size so both sides' tiles match
  const shownL = maxCnt(cnt(F.left), cnt(T.left))
  const shownR = maxCnt(cnt(F.right), cnt(T.right))
  const u = Math.min(unitFor(L, shownL), unitFor(R, shownR))

  // split regrouping (division made visible)
  const sc = splitCase(T)
  let splitL: SplitInfo | null = null
  let splitR: SplitInfo | null = null
  if (sc && T.split) {
    const q = seg.verb === 'splitEqually' ? seg.p : 1
    const xHalf = sc.xSide === 'left' ? L : R
    const unitsHalf = sc.xSide === 'left' ? R : L
    const unitsSide = sc.xSide === 'left' ? T.right : T.left
    const totalUnits = Math.abs(unitsSide.units)
    const per = Math.max(1, Math.ceil(totalUnits / sc.k))
    const us = Math.max(1, Math.min(u, (unitsHalf.w - u) / (per * 1.15)))
    const xSlots = slots(xHalf, cnt(sc.xSide === 'left' ? T.left : T.right), u)
    const rowY = portrait
      ? (r: number) => {
          const pitch = (unitsHalf.h * 0.9) / sc.k
          return unitsHalf.y + unitsHalf.h * 0.05 + r * pitch + (pitch - us) / 2
        }
      : (r: number) => xSlots.xTile(r).y + (u - us) / 2 // rows align with the x-tiles
    const info: SplitInfo = { k: sc.k, q, us, rowY, x0: unitsHalf.x + 0.5 * u }
    if (sc.xSide === 'left') splitR = info
    else splitL = info
    // row separators fade in as the rows part — the "shared equally" cue
    for (let r = 1; r < sc.k; r++) {
      const y = (rowY(r - 1) + us + rowY(r)) / 2
      prims.push({
        k: 'line',
        x1: unitsHalf.x + u * 0.2,
        y1: y,
        x2: unitsHalf.x + unitsHalf.w - u * 0.2,
        y2: y,
        color: TOK.soft,
        weight: 'sm',
        dash: 6,
        opacity: 0.7 * q,
        z: 2,
      })
    }
  }

  drawSideTiles(prims, L, F.left, T.left, seg, u, splitL)
  drawSideTiles(prims, R, F.right, T.right, seg, u, splitR)

  // computed solution readout (only when meaningful)
  if (T.showSolution) {
    const v = tileSolution(T)
    if (v !== null) {
      const pop = seg.verb === 'showSolution' ? seg.p : 1
      prims.push({
        k: 'label',
        x: box.w / 2,
        y: portrait ? box.h * 0.945 : box.h * 0.9,
        text: `x = ${fmt(v)}`,
        color: TOK.good,
        size: (portrait ? box.h * 0.045 : box.h * 0.09) * (0.7 + 0.3 * pop),
        align: 'middle',
        baseline: 'middle',
        opacity: pop,
        z: 6,
      })
    }
  }

  return { prims, view: box }
}

export const AlgebraTiles: Manipulative<AlgebraTilesP> = {
  kind: 'algebratile',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
