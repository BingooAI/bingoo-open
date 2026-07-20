/**
 * calculusgraph.ts — CalculusGraph (giải tích: đạo hàm là hệ số góc tiếp tuyến,
 * tích phân là diện tích dưới đường cong). One curve, two modes:
 *  · tangent — a point that GLIDES along the curve with its tangent line,
 *    a rise/run right-triangle, and the live slope readout f'(x0) (exact
 *    derivative, computed in code).
 *  · area — midpoint-Riemann rectangles over [a,b] next to the EXACT area
 *    (analytic antiderivative); `refine` doubles the bars so the Σ label is
 *    SEEN converging to the ∫ label. High school (15–18).
 * Fixed fns over x∈[-6,6], y clamped to view (formulas documented below):
 *  quadratic f(x)=x²/8   f'(x)=x/4       F(x)=x³/24
 *  cubic     f(x)=x³/32  f'(x)=3x²/32    F(x)=x⁴/128
 *  sin       f(x)=3·sin(x/1.5)  f'(x)=2·cos(x/1.5)  F(x)=−4.5·cos(x/1.5)
 * verbs: setPoint(x) · setInterval(a,b) · refine() · setBars(n) · showValue() ·
 *        setMode(mode) · setFn(fn) · answer(v)   [gradable]
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, mapRange, fmt, TOK } from './util'

export type CalcFnName = 'quadratic' | 'cubic' | 'sin'
export type CalcGraphP = {
  fn: CalcFnName
  mode: 'tangent' | 'area'
  x0: number // tangent point
  a: number // area interval start
  b: number // area interval end
  bars: number // midpoint-Riemann rectangles
  showValue: boolean
  /** learner's answer for the gate (a slope or an area); null = not answered. */
  answer: number | null
}

// math view window — keep in sync with calculusgraph onDrag in interactions.ts
export const CG_XLO = -6,
  CG_XHI = 6
const YLO = -5.5,
  YHI = 5.5

const DEFAULT: CalcGraphP = {
  fn: 'quadratic',
  mode: 'tangent',
  x0: 2,
  a: 0,
  b: 4,
  bars: 4,
  showValue: false,
  answer: null,
}

function num(v: unknown, dflt = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : dflt
}
const clampX = (x: number) => Math.max(CG_XLO, Math.min(CG_XHI, x))

/** f — the curve. */
export function cgF(fn: CalcFnName, x: number): number {
  if (fn === 'cubic') return (x * x * x) / 32
  if (fn === 'sin') return 3 * Math.sin(x / 1.5)
  return (x * x) / 8 // quadratic
}
/** f' — EXACT derivative (d/dx of the formulas above). */
export function cgD(fn: CalcFnName, x: number): number {
  if (fn === 'cubic') return (3 * x * x) / 32
  if (fn === 'sin') return 2 * Math.cos(x / 1.5) // 3·cos(x/1.5)·(1/1.5)
  return x / 4
}
/** F — antiderivative; exact area over [a,b] is F(b) − F(a). */
export function cgAnti(fn: CalcFnName, x: number): number {
  if (fn === 'cubic') return (x * x * x * x) / 128
  if (fn === 'sin') return -4.5 * Math.cos(x / 1.5) // ∫3sin(x/1.5)dx = −3·1.5·cos(x/1.5)
  return (x * x * x) / 24
}
/** exact signed area under f over [a,b] (analytic, never a Riemann estimate). */
export function cgArea(fn: CalcFnName, a: number, b: number): number {
  return cgAnti(fn, b) - cgAnti(fn, a)
}

const FNS: CalcFnName[] = ['quadratic', 'cubic', 'sin']

function normalize(raw: unknown): CalcGraphP {
  const r = (raw ?? {}) as Partial<CalcGraphP>
  const fn = FNS.includes(r.fn as CalcFnName) ? (r.fn as CalcFnName) : 'quadratic'
  let a = clampX(num(r.a, DEFAULT.a)),
    b = clampX(num(r.b, DEFAULT.b))
  if (b < a) [a, b] = [b, a]
  return {
    fn,
    mode: r.mode === 'area' ? 'area' : 'tangent',
    x0: clampX(num(r.x0, DEFAULT.x0)),
    a,
    b,
    bars: Math.max(1, Math.min(64, Math.floor(num(r.bars, 4)))),
    showValue: !!r.showValue,
    answer: r.answer == null ? null : num(r.answer),
  }
}

const verbs: Manipulative<CalcGraphP>['verbs'] = {
  setPoint(p, args): VerbClip<CalcGraphP> {
    return tween(p, { ...p, x0: clampX(num(args?.x ?? args, p.x0)) }, 0.6, 'easeOutCubic')
  },
  setInterval(p, args): VerbClip<CalcGraphP> {
    let a = clampX(num(args?.a, p.a)),
      b = clampX(num(args?.b, p.b))
    if (b < a) [a, b] = [b, a]
    return tween(p, { ...p, a, b }, 0.6, 'easeOutCubic')
  },
  refine(p): VerbClip<CalcGraphP> {
    return tween(p, { ...p, bars: Math.min(64, p.bars * 2) }, 0.7, 'easeInOutCubic')
  },
  setBars(p, args): VerbClip<CalcGraphP> {
    return tween(
      p,
      { ...p, bars: Math.max(1, Math.min(64, Math.floor(num(args?.n ?? args, p.bars)))) },
      0.5,
      'easeInOutCubic',
    )
  },
  showValue(p): VerbClip<CalcGraphP> {
    return tween(p, { ...p, showValue: true }, 0.45, 'easeOutBack')
  },
  setMode(p, args): VerbClip<CalcGraphP> {
    const m = (args?.mode ?? args) as CalcGraphP['mode']
    return tween(p, { ...p, mode: m === 'area' || m === 'tangent' ? m : p.mode }, 0.5, 'easeOutCubic')
  },
  setFn(p, args): VerbClip<CalcGraphP> {
    const f = (args?.fn ?? args) as CalcFnName
    return tween(p, { ...p, fn: FNS.includes(f) ? f : p.fn }, 0.6, 'easeInOutCubic')
  },
  answer(p, args): VerbClip<CalcGraphP> {
    return tween(p, { ...p, answer: num(args?.v ?? args) }, 0.3, 'easeOutCubic')
  },
}

function render(_params: CalcGraphP, state: ManipState<CalcGraphP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const fs = Math.min(box.w, box.h) * 0.048
  const pad = Math.min(box.w, box.h) * 0.09 // keep in sync with calculusgraph onDrag in interactions.ts
  const X = (x: number) => mapRange(x, CG_XLO, CG_XHI, pad, box.w - pad)
  const Y = (y: number) => mapRange(Math.max(YLO, Math.min(YHI, y)), YLO, YHI, box.h - pad, pad)

  // during setFn the drawn curve morphs between the two formulas
  const fEval = (x: number) =>
    seg.verb === 'setFn' && seg.from.fn !== seg.to.fn
      ? lerp(cgF(seg.from.fn, x), cgF(seg.to.fn, x), seg.p)
      : cgF(P.fn, x)
  const dEval = (x: number) =>
    seg.verb === 'setFn' && seg.from.fn !== seg.to.fn
      ? lerp(cgD(seg.from.fn, x), cgD(seg.to.fn, x), seg.p)
      : cgD(P.fn, x)

  // ---- axes + ticks
  prims.push({
    k: 'line',
    x1: pad * 0.5,
    y1: Y(0),
    x2: box.w - pad * 0.5,
    y2: Y(0),
    color: TOK.soft,
    weight: 'sm',
    z: 1,
  })
  prims.push({
    k: 'line',
    x1: X(0),
    y1: pad * 0.5,
    x2: X(0),
    y2: box.h - pad * 0.5,
    color: TOK.soft,
    weight: 'sm',
    z: 1,
  })
  for (let v = CG_XLO; v <= CG_XHI; v += 2) {
    if (v === 0) continue
    prims.push({
      k: 'line',
      x1: X(v),
      y1: Y(0) - box.h * 0.008,
      x2: X(v),
      y2: Y(0) + box.h * 0.008,
      color: TOK.soft,
      weight: 'sm',
      z: 1,
    })
    prims.push({
      k: 'label',
      x: X(v),
      y: Y(0) + box.h * 0.035,
      text: fmt(v),
      color: TOK.faint,
      size: fs * 0.7,
      align: 'middle',
      baseline: 'middle',
      z: 1,
    })
  }

  // mode crossfade: area layer fades in/out with setMode
  const areaOp =
    P.mode === 'area'
      ? seg.verb === 'setMode' && seg.from.mode !== 'area'
        ? seg.p
        : 1
      : seg.verb === 'setMode' && seg.from.mode === 'area'
        ? 1 - seg.p
        : 0
  const tanOp =
    P.mode === 'tangent'
      ? seg.verb === 'setMode' && seg.from.mode !== 'tangent'
        ? seg.p
        : 1
      : seg.verb === 'setMode' && seg.from.mode === 'tangent'
        ? 1 - seg.p
        : 0

  /* ------------------------------------------------ area mode (∫ = diện tích) */
  if (areaOp > 0.001) {
    const ai = lerp(seg.from.a, seg.to.a, seg.p)
    const bi = lerp(seg.from.b, seg.to.b, seg.p)
    const n = P.bars
    const w = (bi - ai) / Math.max(1, n)

    // exact region (behind bars) + its ∫ label — only when showValue
    const valOp = P.showValue ? (seg.verb === 'showValue' && !seg.from.showValue ? seg.p : 1) : 0
    if (valOp > 0.001 && bi > ai) {
      let d = `M ${X(ai)} ${Y(0)} `
      for (let i = 0; i <= 48; i++) {
        const x = ai + ((bi - ai) * i) / 48
        d += `L ${X(x)} ${Y(fEval(x))} `
      }
      d += `L ${X(bi)} ${Y(0)} Z`
      prims.push({
        k: 'path',
        d,
        fill: TOK.good,
        opacity: 0.18 * valOp * areaOp,
        closed: true,
        z: 2,
      })
    }

    // midpoint-Riemann bars: height = f(midpoint of each slice).
    // refine/setBars animates each child bar's height from its parent's height
    // (the subdivision is literally seen splitting).
    const subdividing = (seg.verb === 'refine' || seg.verb === 'setBars') && seg.from.bars !== seg.to.bars
    const growing = seg.verb === 'setMode' || seg.verb === 'setInterval'
    let sumShown = 0 // Σ of the DISPLAYED bars (live during the animation)
    for (let k = 0; k < n && w > 0; k++) {
      const xk = ai + k * w
      const mid = xk + w / 2
      let h = fEval(mid)
      if (subdividing) {
        const pk = Math.floor((k * seg.from.bars) / n) // parent slice of this child
        const pw = (bi - ai) / Math.max(1, seg.from.bars)
        h = lerp(fEval(ai + (pk + 0.5) * pw), h, seg.p)
      } else if (growing) {
        h = h * seg.p
      }
      sumShown += h * w
      const yTop = Math.min(Y(0), Y(h))
      prims.push({
        k: 'rect',
        x: X(xk),
        y: yTop,
        w: X(xk + w) - X(xk),
        h: Math.abs(Y(h) - Y(0)),
        fill: TOK.accent,
        color: TOK.ink,
        weight: 'sm',
        opacity: 0.55 * areaOp,
        z: 3,
      })
    }

    // a / b markers under the axis
    for (const [xv, lbl] of [
      [ai, fmt(Math.round(ai * 100) / 100)],
      [bi, fmt(Math.round(bi * 100) / 100)],
    ] as [number, string][]) {
      prims.push({
        k: 'line',
        x1: X(xv),
        y1: Y(0),
        x2: X(xv),
        y2: Y(0) + box.h * 0.03,
        color: TOK.warn,
        weight: 'md',
        z: 4,
      })
      prims.push({
        k: 'label',
        x: X(xv),
        y: Y(0) + box.h * 0.062,
        text: lbl,
        color: TOK.warn,
        size: fs * 0.8,
        align: 'middle',
        baseline: 'middle',
        opacity: areaOp,
        z: 4,
      })
    }

    // Σ (Riemann, live) vs ∫ (exact) — shown together so convergence is SEEN
    prims.push({
      k: 'label',
      x: pad * 0.6,
      y: box.h * 0.055,
      text: `Σ ≈ ${fmt(Math.round(sumShown * 1000) / 1000)} (n = ${n})`,
      color: TOK.accent,
      size: fs,
      align: 'start',
      baseline: 'middle',
      opacity: areaOp,
      z: 6,
    })
    if (valOp > 0.001) {
      const exact = cgArea(P.fn, seg.to.a, seg.to.b)
      prims.push({
        k: 'label',
        x: box.w - pad * 0.6,
        y: box.h * 0.055,
        text: `∫ = ${fmt(Math.round(exact * 1000) / 1000)}`,
        color: TOK.good,
        size: fs,
        align: 'end',
        baseline: 'middle',
        opacity: valOp * areaOp,
        z: 6,
      })
    }
  }

  // ---- the curve (drawn above the shaded region/bars)
  {
    let d = ''
    for (let i = 0; i <= 80; i++) {
      const x = CG_XLO + ((CG_XHI - CG_XLO) * i) / 80
      d += `${i === 0 ? 'M' : 'L'} ${X(x)} ${Y(fEval(x))} `
    }
    prims.push({ k: 'path', d, fill: 'none', color: TOK.accent2, weight: 'md', z: 4 })
  }

  /* --------------------------------------------- tangent mode (f' = hệ số góc) */
  if (tanOp > 0.001) {
    const x0 = lerp(seg.from.x0, seg.to.x0, seg.p) // interp x0 → point glides ON the curve
    const f0 = fEval(x0)
    const m = dEval(x0)

    // tangent line y = f0 + m(x − x0), clipped to the view window
    let xA = CG_XLO,
      xB = CG_XHI
    if (Math.abs(m) > 1e-9) {
      const xs = [x0 + (YLO - f0) / m, x0 + (YHI - f0) / m]
      xA = Math.max(xA, Math.min(xs[0]!, xs[1]!))
      xB = Math.min(xB, Math.max(xs[0]!, xs[1]!))
    }
    if (xB < xA) {
      xA = x0
      xB = x0
    }
    prims.push({
      k: 'line',
      x1: X(xA),
      y1: Y(f0 + m * (xA - x0)),
      x2: X(xB),
      y2: Y(f0 + m * (xB - x0)),
      color: TOK.accent,
      weight: 'md',
      opacity: tanOp,
      z: 5,
    })

    // rise/run right-triangle on the tangent: run = 1 (flips left at the edge)
    const run = x0 + 1.6 <= CG_XHI ? 1 : -1
    const x1 = x0 + run,
      y1v = f0 + m * run
    prims.push({
      k: 'line',
      x1: X(x0),
      y1: Y(f0),
      x2: X(x1),
      y2: Y(f0),
      color: TOK.warn,
      weight: 'sm',
      dash: 5,
      opacity: tanOp,
      z: 5,
    })
    prims.push({
      k: 'line',
      x1: X(x1),
      y1: Y(f0),
      x2: X(x1),
      y2: Y(y1v),
      color: TOK.warn,
      weight: 'sm',
      dash: 5,
      opacity: tanOp,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: (X(x0) + X(x1)) / 2,
      y: Y(f0) + box.h * 0.03 * (m >= 0 ? 1 : -1),
      text: fmt(Math.abs(run)),
      color: TOK.warn,
      size: fs * 0.75,
      align: 'middle',
      baseline: 'middle',
      opacity: tanOp,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: X(x1) + box.w * 0.012 * run,
      y: (Y(f0) + Y(y1v)) / 2,
      text: fmt(Math.round(m * 100) / 100),
      color: TOK.warn,
      size: fs * 0.75,
      align: run > 0 ? 'start' : 'end',
      baseline: 'middle',
      opacity: tanOp,
      z: 5,
    })

    // the point itself + live slope readout
    prims.push({
      k: 'circle',
      cx: X(x0),
      cy: Y(f0),
      r: Math.min(box.w, box.h) * 0.016,
      fill: TOK.accent,
      color: TOK.ink,
      weight: 'sm',
      opacity: tanOp,
      z: 6,
    })
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.055,
      text: `f'(${fmt(Math.round(x0 * 100) / 100)}) = ${fmt(Math.round(m * 100) / 100)}`,
      color: TOK.accent,
      size: fs,
      align: 'middle',
      baseline: 'middle',
      opacity: tanOp,
      z: 6,
    })
  }

  return { prims, view: box }
}

export const CalculusGraph: Manipulative<CalcGraphP> = {
  kind: 'calculusgraph',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
