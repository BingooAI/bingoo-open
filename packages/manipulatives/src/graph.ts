/**
 * graph.ts — Cartesian graph (kit #6). Functions are *descriptors* (linear /
 * quadratic / sin), not strings, so evaluation is pure & code-verifiable.
 * params: { xRange, yRange, points[], functions[] }
 * verbs: plotPoint(x,y) · drawCurve(fn) · traceValue(x) · highlightAxis
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, mapRange, TOK } from './util'

export type FnDesc =
  | { kind: 'linear'; m: number; b: number }
  | { kind: 'quadratic'; a: number; b: number; c: number }
  | { kind: 'sin'; amp: number; freq: number; phase: number }

export type GraphP = {
  xRange: [number, number]
  yRange: [number, number]
  points: { x: number; y: number }[]
  functions: FnDesc[]
  trace: number | null
  axisHi: 'x' | 'y' | null
}

const DEFAULT: GraphP = {
  xRange: [-5, 5],
  yRange: [-5, 5],
  points: [],
  functions: [],
  trace: null,
  axisHi: null,
}

function normalize(raw: unknown): GraphP {
  const r = (raw ?? {}) as Partial<GraphP>
  return {
    xRange: r.xRange ?? DEFAULT.xRange,
    yRange: r.yRange ?? DEFAULT.yRange,
    points: [...(r.points ?? [])],
    functions: [...(r.functions ?? [])],
    trace: r.trace ?? null,
    axisHi: r.axisHi ?? null,
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

export function evalFn(fn: FnDesc, x: number): number {
  switch (fn?.kind) {
    case 'linear':
      return (fn.m ?? 1) * x + (fn.b ?? 0)
    case 'quadratic':
      return (fn.a ?? 1) * x * x + (fn.b ?? 0) * x + (fn.c ?? 0)
    case 'sin':
      return (fn.amp ?? 1) * Math.sin((fn.freq ?? 1) * x + (fn.phase ?? 0))
    default:
      return 0 // unknown/empty descriptor → flat line (never NaN)
  }
}

const verbs: Manipulative<GraphP>['verbs'] = {
  plotPoint(p, args): VerbClip<GraphP> {
    return tween(p, { ...p, points: [...p.points, { x: num(args?.x), y: num(args?.y) }] }, 0.4, 'easeOutBack')
  },
  drawCurve(p, args): VerbClip<GraphP> {
    const raw = (args?.fn ?? args) as FnDesc | undefined
    const fn: FnDesc = raw && raw.kind ? raw : { kind: 'linear', m: 1, b: 0 }
    return tween(p, { ...p, functions: [...p.functions, fn] }, 0.8, 'easeInOutCubic')
  },
  traceValue(p, args): VerbClip<GraphP> {
    return tween(p, { ...p, trace: num(args?.x ?? args) }, 0.5, 'easeOutCubic')
  },
  highlightAxis(p, args): VerbClip<GraphP> {
    const axis = (args?.axis ?? args) === 'y' ? 'y' : 'x'
    return tween(p, { ...p, axisHi: axis }, 0.4, 'easeOutCubic')
  },
}

function render(_params: GraphP, state: ManipState<GraphP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const pad = Math.min(box.w, box.h) * 0.1
  const X = (x: number) => mapRange(x, P.xRange[0], P.xRange[1], pad, box.w - pad)
  const Y = (y: number) => mapRange(y, P.yRange[0], P.yRange[1], box.h - pad, pad)

  // axes
  prims.push({
    k: 'line',
    x1: pad,
    y1: Y(0),
    x2: box.w - pad,
    y2: Y(0),
    color: P.axisHi === 'x' ? TOK.accent : TOK.soft,
    weight: P.axisHi === 'x' ? 'md' : 'sm',
    z: 1,
  })
  prims.push({
    k: 'line',
    x1: X(0),
    y1: pad,
    x2: X(0),
    y2: box.h - pad,
    color: P.axisHi === 'y' ? TOK.accent : TOK.soft,
    weight: P.axisHi === 'y' ? 'md' : 'sm',
    z: 1,
  })

  // curves — the newest draws in left→right while drawCurve runs
  const newFn = seg.verb === 'drawCurve' ? P.functions.length - 1 : -1
  P.functions.forEach((fn, fi) => {
    const prog = fi === newFn ? seg.p : 1
    const N = 64
    const xEnd = P.xRange[0] + (P.xRange[1] - P.xRange[0]) * clamp01(prog)
    let d = ''
    for (let i = 0; i <= N; i++) {
      const x = P.xRange[0] + ((xEnd - P.xRange[0]) * i) / N
      const px = X(x)
      const py = Y(evalFn(fn, x))
      d += `${i === 0 ? 'M' : 'L'} ${px} ${py} `
    }
    prims.push({ k: 'path', d, fill: 'none', color: TOK.accent2, weight: 'md', z: 2 })
  })

  // trace: drop a line to the first curve
  if (P.trace !== null && P.functions.length) {
    const yv = evalFn(P.functions[0]!, P.trace)
    prims.push({
      k: 'line',
      x1: X(P.trace),
      y1: Y(0),
      x2: X(P.trace),
      y2: Y(yv),
      color: TOK.warn,
      weight: 'sm',
      dash: 6,
      z: 3,
    })
    prims.push({
      k: 'line',
      x1: X(0),
      y1: Y(yv),
      x2: X(P.trace),
      y2: Y(yv),
      color: TOK.warn,
      weight: 'sm',
      dash: 6,
      z: 3,
    })
    prims.push({
      k: 'circle',
      cx: X(P.trace),
      cy: Y(yv),
      r: box.h * 0.02,
      fill: TOK.warn,
      color: TOK.ink,
      weight: 'sm',
      z: 4,
    })
  }

  // points
  const newPt = seg.verb === 'plotPoint' ? P.points.length - 1 : -1
  P.points.forEach((pt, pi) => {
    const grow = pi === newPt ? seg.p : 1
    prims.push({
      k: 'circle',
      cx: X(pt.x),
      cy: Y(pt.y),
      r: box.h * 0.025 * grow,
      fill: TOK.accent,
      color: TOK.ink,
      weight: 'sm',
      opacity: grow,
      z: 4,
    })
  })

  return { prims, view: box }
}

export const Graph: Manipulative<GraphP> = {
  kind: 'graph',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
