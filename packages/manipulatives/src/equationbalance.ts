/**
 * equationbalance.ts — EquationBalance (cân thăng bằng phương trình ax+b=c).
 * Middle school (THCS, grades 6–8): a beam balance that stays LEVEL — the
 * equation is always true — with `a` x-bags + `b` unit weights on the left pan
 * and `c` unit weights on the right. takeFromBoth lifts the same number of
 * weights off BOTH pans (fade upward); divideBoth groups the right weights into
 * `a` clusters, keeping one full-opacity cluster per bag; showX opens the bags.
 * The symbolic equation under the scale updates per step and every value is
 * COMPUTED from params (see `balanceSolution` — invariant under takeFromBoth).
 * verbs: takeFromBoth(n) · divideBoth · showX · setAnswer(v).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, fmt, TOK } from './util'

export type BalanceStep = 'start' | 'minusB' | 'divided'
export type EquationBalanceP = {
  a: number // x-bags on the left pan (≥1)
  b: number // unit weights currently on the left pan
  c: number // unit weights currently on the right pan
  step: BalanceStep
  showX: boolean
  /** learner's answer for grading (set via setAnswer); not displayed. */
  answer: number | null
}

const DEFAULT: EquationBalanceP = { a: 2, b: 3, c: 11, step: 'start', showX: false, answer: null }

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** The solution x = (c − b) / a — invariant under takeFromBoth (code-verifiable). */
export function balanceSolution(p: EquationBalanceP): number {
  return (p.c - p.b) / p.a
}

function normalize(raw: unknown): EquationBalanceP {
  const r = (raw ?? {}) as Partial<EquationBalanceP>
  const a = Math.min(6, Math.max(1, Math.round(num(r.a ?? 1)) || 1))
  const b = Math.min(12, Math.max(0, Math.round(num(r.b ?? 0))))
  const c = Math.min(20, Math.max(0, Math.round(num(r.c ?? 0))))
  const s = r.step
  // step must be coherent with the pans: b weights still present → "start"
  const step: BalanceStep = b > 0 || (s !== 'minusB' && s !== 'divided') ? 'start' : s
  return { a, b, c, step, showX: !!r.showX, answer: r.answer == null ? null : num(r.answer) }
}

/* --------------------------------------------------------------------- verbs */

const verbs: Manipulative<EquationBalanceP>['verbs'] = {
  /** Remove n unit weights from BOTH pans (default: all of b). Truth preserved. */
  takeFromBoth(p, args): VerbClip<EquationBalanceP> {
    const raw = args?.n ?? args
    const want = Math.floor(num(raw == null || typeof raw === 'object' ? p.b : raw))
    const k = Math.max(0, Math.min(want, p.b, p.c))
    if (k === 0) return tween(p, p, 0.3, 'easeOutCubic')
    const b2 = p.b - k
    return tween(p, { ...p, b: b2, c: p.c - k, step: b2 === 0 ? 'minusB' : 'start' }, 0.55, 'easeInCubic')
  },
  /** Group the right pan's weights into `a` equal clusters (needs b removed). */
  divideBoth(p): VerbClip<EquationBalanceP> {
    if (p.b !== 0) return tween(p, p, 0.3, 'easeOutCubic')
    return tween(p, { ...p, step: 'divided' }, 0.7, 'easeInOutCubic')
  },
  showX(p): VerbClip<EquationBalanceP> {
    return tween(p, { ...p, showX: true }, 0.45, 'easeOutBack')
  },
  setAnswer(p, args): VerbClip<EquationBalanceP> {
    return tween(p, { ...p, answer: num(args?.v ?? args ?? 0) }, 0.3, 'easeOutCubic')
  },
}

/* -------------------------------------------------------------------- render */

/** Symbolic equation for a logical state (all values computed via fmt). */
function eqText(p: EquationBalanceP): string {
  const ax = (p.a === 1 ? '' : fmt(p.a)) + 'x'
  if (p.step === 'divided') return `x = ${fmt(balanceSolution(p))}`
  if (p.b > 0) return `${ax} + ${fmt(p.b)} = ${fmt(p.c)}`
  return `${ax} = ${fmt(p.c)}`
}

/** Rounded pouch path for an x-bag (bottom-centred at (cx, yb)). */
function bagPath(cx: number, yb: number, w: number, h: number): string {
  return (
    `M ${cx - w / 2} ${yb - h * 0.45} ` +
    `Q ${cx - w * 0.58} ${yb} ${cx} ${yb} ` +
    `Q ${cx + w * 0.58} ${yb} ${cx + w / 2} ${yb - h * 0.45} ` +
    `Q ${cx + w * 0.18} ${yb - h * 0.7} ${cx + w * 0.14} ${yb - h * 0.8} ` +
    `L ${cx - w * 0.14} ${yb - h * 0.8} ` +
    `Q ${cx - w * 0.18} ${yb - h * 0.7} ${cx - w / 2} ${yb - h * 0.45} Z`
  )
}

function render(
  _params: EquationBalanceP,
  state: ManipState<EquationBalanceP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const portrait = box.h > box.w
  const seg = activeSegment(state, t)
  const F = seg.from
  const T = seg.to
  const prims: Prim[] = []

  const cx = box.w / 2
  const beamY = box.h * (portrait ? 0.18 : 0.24)
  const beamHalf = box.w * (portrait ? 0.3 : 0.33)
  const panDrop = box.h * (portrait ? 0.16 : 0.2)
  const pw = Math.min(box.w * 0.17, box.h * 0.14) // pan half-width
  const lpx = cx - beamHalf
  const rpx = cx + beamHalf
  const panY = beamY + panDrop

  // stand + LEVEL beam (the equation is balanced — always)
  prims.push({
    k: 'path',
    d: `M ${cx - box.w * 0.07} ${beamY + box.h * 0.36} L ${cx} ${beamY} L ${cx + box.w * 0.07} ${beamY + box.h * 0.36} Z`,
    fill: TOK.faint,
    color: TOK.ink,
    weight: 'sm',
    closed: true,
    z: 1,
  })
  prims.push({
    k: 'line',
    x1: lpx,
    y1: beamY,
    x2: rpx,
    y2: beamY,
    color: TOK.ink,
    weight: 'lg',
    cap: 'round',
    z: 3,
  })
  prims.push({
    k: 'circle',
    cx,
    cy: beamY,
    r: box.h * 0.018,
    fill: TOK.ink,
    color: TOK.ink,
    weight: 'sm',
    z: 4,
  })

  // pans
  const pan = (px: number) => {
    prims.push({
      k: 'line',
      x1: px,
      y1: beamY,
      x2: px,
      y2: panY,
      color: TOK.soft,
      weight: 'sm',
      z: 2,
    })
    prims.push({
      k: 'path',
      d: `M ${px - pw} ${panY} A ${pw} ${pw * 0.55} 0 0 0 ${px + pw} ${panY}`,
      fill: 'none',
      color: TOK.ink,
      weight: 'md',
      z: 2,
    })
  }
  pan(lpx)
  pan(rpx)

  // ---- left pan: a bags + b weights -------------------------------------
  const a = T.a
  const bagW = Math.min(pw * 0.62, (pw * 1.8) / a)
  const bagH = bagW * 1.2
  const showPop = seg.verb === 'showX' ? seg.p : T.showX ? 1 : 0
  const xVal = balanceSolution(T)
  for (let i = 0; i < a; i++) {
    const bx = lpx - (a * bagW * 1.06) / 2 + (i + 0.5) * bagW * 1.06
    if (showPop > 0) {
      prims.push({
        k: 'circle',
        cx: bx,
        cy: panY - bagH * 0.45,
        r: bagW * 0.75,
        fill: TOK.good,
        opacity: 0.22 * showPop,
        z: 3,
      })
    }
    prims.push({
      k: 'path',
      d: bagPath(bx, panY - bagW * 0.04, bagW, bagH),
      fill: TOK.accent,
      color: TOK.ink,
      weight: 'sm',
      closed: true,
      z: 4,
    })
    prims.push({
      k: 'circle',
      cx: bx,
      cy: panY - bagH * 0.86,
      r: bagW * 0.14,
      fill: TOK.accent,
      color: TOK.ink,
      weight: 'sm',
      z: 4,
    })
    prims.push({
      k: 'label',
      x: bx,
      y: panY - bagH * 0.38,
      text: T.showX ? fmt(xVal) : 'x',
      color: TOK.paper,
      size: bagW * 0.42,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    })
  }

  // unit-weight grid helper (5 per row, stacked upward from y0)
  const u = Math.min(pw * 0.3, (pw * 1.9) / 5.5)
  const wSlot = (px: number, j: number, y0: number) => ({
    x: px - (5 * u * 1.08) / 2 + (j % 5) * u * 1.08 + u * 0.04,
    y: y0 - (Math.floor(j / 5) + 1) * u * 1.12,
  })
  const weight = (x: number, y: number, s: number, op: number, z = 4) => {
    if (op <= 0.01) return
    prims.push({
      k: 'rect',
      x,
      y,
      w: s,
      h: s,
      fill: TOK.warn,
      color: TOK.ink,
      weight: 'sm',
      rx: s * 0.18,
      opacity: op,
      z,
    })
  }

  // during takeFromBoth the last k weights on each pan lift off & fade upward
  const taking = seg.verb === 'takeFromBoth' && (F.b !== T.b || F.c !== T.c)
  const lift = seg.p * box.h * 0.16

  const leftY0 = panY - bagH * 1.02
  const bShown = taking ? F.b : T.b
  for (let j = 0; j < bShown; j++) {
    const s = wSlot(lpx, j, leftY0)
    const gone = taking && j >= T.b
    weight(s.x, s.y - (gone ? lift : 0), u, gone ? 1 - seg.p : 1)
  }

  // ---- right pan: c weights (grid → a clusters when divided) -------------
  const divided = T.step === 'divided'
  const qd = divided ? (seg.verb === 'divideBoth' ? seg.p : 1) : 0
  const cShown = taking ? F.c : T.c
  const span = pw * 1.9
  const clusW = span / a
  const uc = Math.max(1, Math.min(u, clusW / 2.4))
  const clusterSlot = (j: number) => {
    const r = j % a
    const idx = Math.floor(j / a)
    const ccx = rpx - span / 2 + (r + 0.5) * clusW
    return {
      x: ccx + ((idx % 2) - 0.5) * uc * 1.08 - uc / 2 + uc * 0.04,
      y: panY - (Math.floor(idx / 2) + 1) * uc * 1.12,
      r,
    }
  }
  for (let j = 0; j < cShown; j++) {
    const g = wSlot(rpx, j, panY)
    if (taking && j >= T.c) {
      weight(g.x, g.y - lift, u, 1 - seg.p)
      continue
    }
    if (qd > 0) {
      const cs = clusterSlot(j)
      const op = cs.r === 0 ? 1 : 1 - 0.7 * qd // one full cluster per bag, others ghost
      weight(lerp(g.x, cs.x, qd), lerp(g.y, cs.y, qd), lerp(u, uc, qd), op)
    } else {
      weight(g.x, g.y, u, 1)
    }
  }
  // cluster outlines fade in with the division (highlight the kept cluster)
  if (qd > 0.05 && T.c > 0) {
    const rows = Math.ceil(Math.ceil(T.c / a) / 2)
    const ch = rows * uc * 1.12 + uc * 0.3
    for (let r = 0; r < a; r++) {
      const ccx = rpx - span / 2 + (r + 0.5) * clusW
      prims.push({
        k: 'rect',
        x: ccx - clusW * 0.46,
        y: panY - ch - uc * 0.1,
        w: clusW * 0.92,
        h: ch,
        fill: 'none',
        color: r === 0 ? TOK.good : TOK.faint,
        weight: 'sm',
        rx: uc * 0.3,
        opacity: qd * (r === 0 ? 0.9 : 0.6),
        z: 3,
      })
    }
  }

  // ---- symbolic equation (computed; crossfades between steps) ------------
  const eqY = box.h * 0.8
  const eqSize = Math.max(14, box.h * (portrait ? 0.045 : 0.07))
  const from = eqText(F)
  const to = eqText(T)
  if (seg.p < 1 && from !== to) {
    prims.push({
      k: 'label',
      x: cx,
      y: eqY,
      text: from,
      color: TOK.ink,
      size: eqSize,
      align: 'middle',
      baseline: 'middle',
      opacity: 1 - seg.p,
      z: 6,
    })
    prims.push({
      k: 'label',
      x: cx,
      y: eqY + eqSize * 0.5 * (1 - seg.p),
      text: to,
      color: TOK.ink,
      size: eqSize,
      align: 'middle',
      baseline: 'middle',
      opacity: seg.p,
      z: 6,
    })
  } else {
    prims.push({
      k: 'label',
      x: cx,
      y: eqY,
      text: to,
      color: TOK.ink,
      size: eqSize,
      align: 'middle',
      baseline: 'middle',
      z: 6,
    })
  }

  // ---- the answer, computed, popping when the bags open ------------------
  if (T.showX) {
    prims.push({
      k: 'label',
      x: cx,
      y: box.h * 0.9,
      text: `x = ${fmt(xVal)}`,
      color: TOK.good,
      size: Math.max(14, box.h * (portrait ? 0.05 : 0.085)) * (0.7 + 0.3 * showPop),
      align: 'middle',
      baseline: 'middle',
      opacity: showPop,
      z: 6,
    })
  }

  return { prims, view: box }
}

export const EquationBalance: Manipulative<EquationBalanceP> = {
  kind: 'equationbalance',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
