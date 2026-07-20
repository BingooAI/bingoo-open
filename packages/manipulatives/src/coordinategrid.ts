/**
 * coordinategrid.ts — coordinate grid (Cambridge: position & direction). First-
 * quadrant integer grid; plot points, read coordinates, translate/reflect a
 * point. verbs: plot(x,y,label) · translate(dx,dy) · reflect(axis) · readCoord(x,y).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, mapRange, TOK } from './util'

export type GridPoint = { x: number; y: number; label?: string }
export type CoordinateGridP = {
  size: number
  points: GridPoint[]
  mover: number | null
  read: { x: number; y: number } | null
}

const DEFAULT: CoordinateGridP = { size: 6, points: [], mover: null, read: null }

function normalize(raw: unknown): CoordinateGridP {
  const r = (raw ?? {}) as Partial<CoordinateGridP>
  return {
    size: Math.max(1, Math.floor(num(r.size ?? 6))),
    points: [...(r.points ?? [])],
    mover: r.mover ?? null,
    read: r.read ?? null,
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<CoordinateGridP>['verbs'] = {
  plot(p, args): VerbClip<CoordinateGridP> {
    const pt: GridPoint = {
      x: num(args?.x),
      y: num(args?.y),
      label: args?.label ? String(args.label) : undefined,
    }
    return tween(
      p,
      { ...p, points: [...p.points, pt], mover: p.points.length, read: null },
      0.4,
      'easeOutBack',
    )
  },
  translate(p, args): VerbClip<CoordinateGridP> {
    const dx = num(args?.dx ?? 0),
      dy = num(args?.dy ?? 0)
    const idx = p.points.length - 1
    if (idx < 0) return tween(p, p, 0.3)
    const points = p.points.map((pt, i) => (i === idx ? { ...pt, x: pt.x + dx, y: pt.y + dy } : pt))
    return tween({ ...p, mover: idx }, { ...p, points, mover: idx }, 0.6, 'easeInOutCubic')
  },
  reflect(p, args): VerbClip<CoordinateGridP> {
    const axis = (args?.axis ?? args) === 'y' ? 'y' : 'x'
    const idx = p.points.length - 1
    if (idx < 0) return tween(p, p, 0.3)
    const points = p.points.map((pt, i) => {
      if (i !== idx) return pt
      return axis === 'x' ? { ...pt, y: p.size - pt.y } : { ...pt, x: p.size - pt.x }
    })
    return tween({ ...p, mover: idx }, { ...p, points, mover: idx }, 0.6, 'easeInOutCubic')
  },
  readCoord(p, args): VerbClip<CoordinateGridP> {
    return tween(p, { ...p, read: { x: num(args?.x), y: num(args?.y) } }, 0.45, 'easeOutCubic')
  },
}

function render(
  _params: CoordinateGridP,
  state: ManipState<CoordinateGridP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const n = P.size
  const pad = Math.min(box.w, box.h) * 0.12
  const side = Math.min(box.w, box.h) - 2 * pad
  const ox = (box.w - side) / 2,
    oy = (box.h - side) / 2
  const X = (x: number) => ox + mapRange(x, 0, n, 0, side)
  const Y = (y: number) => oy + mapRange(y, 0, n, side, 0)

  // grid
  for (let i = 0; i <= n; i++) {
    prims.push({
      k: 'line',
      x1: X(i),
      y1: Y(0),
      x2: X(i),
      y2: Y(n),
      color: TOK.faint,
      weight: 'sm',
      z: 1,
    })
    prims.push({
      k: 'line',
      x1: X(0),
      y1: Y(i),
      x2: X(n),
      y2: Y(i),
      color: TOK.faint,
      weight: 'sm',
      z: 1,
    })
    prims.push({
      k: 'label',
      x: X(i),
      y: Y(0) + box.h * 0.04,
      text: String(i),
      color: TOK.soft,
      size: box.h * 0.045,
      align: 'middle',
      baseline: 'middle',
      z: 2,
    })
    if (i > 0)
      prims.push({
        k: 'label',
        x: X(0) - box.w * 0.03,
        y: Y(i),
        text: String(i),
        color: TOK.soft,
        size: box.h * 0.045,
        align: 'middle',
        baseline: 'middle',
        z: 2,
      })
  }
  prims.push({
    k: 'line',
    x1: X(0),
    y1: Y(0),
    x2: X(n),
    y2: Y(0),
    color: TOK.ink,
    weight: 'md',
    z: 2,
  })
  prims.push({
    k: 'line',
    x1: X(0),
    y1: Y(0),
    x2: X(0),
    y2: Y(n),
    color: TOK.ink,
    weight: 'md',
    z: 2,
  })

  // read marker (dashed lines to a coordinate)
  if (P.read) {
    prims.push({
      k: 'line',
      x1: X(P.read.x),
      y1: Y(0),
      x2: X(P.read.x),
      y2: Y(P.read.y),
      color: TOK.warn,
      weight: 'sm',
      dash: 6,
      z: 3,
    })
    prims.push({
      k: 'line',
      x1: X(0),
      y1: Y(P.read.y),
      x2: X(P.read.x),
      y2: Y(P.read.y),
      color: TOK.warn,
      weight: 'sm',
      dash: 6,
      z: 3,
    })
  }

  // points
  const animating = seg.verb === 'translate' || seg.verb === 'reflect'
  P.points.forEach((pt, i) => {
    let px = pt.x,
      py = pt.y
    if (animating && i === P.mover) {
      const fromPt = seg.from.points[i]
      if (fromPt) {
        px = lerp(fromPt.x, pt.x, seg.p)
        py = lerp(fromPt.y, pt.y, seg.p)
      }
    }
    const grow = seg.verb === 'plot' && i === P.points.length - 1 ? seg.p : 1
    prims.push({
      k: 'circle',
      cx: X(px),
      cy: Y(py),
      r: box.h * 0.028 * grow,
      fill: TOK.accent,
      color: TOK.ink,
      weight: 'sm',
      opacity: grow,
      z: 4,
    })
    prims.push({
      k: 'label',
      x: X(px) + box.w * 0.02,
      y: Y(py) - box.h * 0.03,
      text: pt.label
        ? `${pt.label}(${Math.round(px)},${Math.round(py)})`
        : `(${Math.round(px)},${Math.round(py)})`,
      color: TOK.ink,
      size: box.h * 0.05,
      align: 'start',
      baseline: 'middle',
      opacity: grow,
      z: 5,
    })
  })

  return { prims, view: box }
}

export const CoordinateGrid: Manipulative<CoordinateGridP> = {
  kind: 'coordinategrid',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
