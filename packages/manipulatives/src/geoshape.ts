/**
 * geoshape.ts — geometry shape (kit #9). A polygon (normalised vertices) with
 * side labels, angle arcs and tick marks. Rigid transforms are stored as a POSE
 * (rot / mirror / translate) over fixed base vertices, so rotate/reflect animate
 * as true rigid motions and seek exactly.
 * verbs: labelSide · markAngle · rotate(deg) · reflect(axis) · translate(dx,dy)
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, TOK } from './util'

export type GeoShapeP = {
  base: [number, number][] // normalised 0..1
  rot: number // degrees
  sx: number // mirror flags as ±1
  sy: number
  tx: number // normalised translation
  ty: number
  sideLabels: Record<number, string> // edge index → label
  angleArcs: number[] // vertex indices
  ticks: number[] // edge indices
}

const DEFAULT: GeoShapeP = {
  base: [
    [0.3, 0.7],
    [0.7, 0.7],
    [0.5, 0.3],
  ],
  rot: 0,
  sx: 1,
  sy: 1,
  tx: 0,
  ty: 0,
  sideLabels: {},
  angleArcs: [],
  ticks: [],
}

function normalize(raw: unknown): GeoShapeP {
  const r = (raw ?? {}) as Partial<GeoShapeP> & { vertices?: [number, number][] }
  return {
    base: (r.base ?? r.vertices ?? DEFAULT.base).map((v) => [v[0], v[1]] as [number, number]),
    rot: r.rot ?? 0,
    sx: r.sx ?? 1,
    sy: r.sy ?? 1,
    tx: r.tx ?? 0,
    ty: r.ty ?? 0,
    sideLabels: { ...(r.sideLabels ?? {}) },
    angleArcs: [...(r.angleArcs ?? [])],
    ticks: [...(r.ticks ?? [])],
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<GeoShapeP>['verbs'] = {
  rotate(p, args): VerbClip<GeoShapeP> {
    return tween(p, { ...p, rot: p.rot + num(args?.deg ?? args ?? 90) }, 0.7, 'easeInOutCubic')
  },
  reflect(p, args): VerbClip<GeoShapeP> {
    const axis = (args?.axis ?? args) === 'y' ? 'y' : 'x'
    return tween(p, axis === 'x' ? { ...p, sy: -p.sy } : { ...p, sx: -p.sx }, 0.7, 'easeInOutCubic')
  },
  translate(p, args): VerbClip<GeoShapeP> {
    return tween(p, { ...p, tx: p.tx + num(args?.dx ?? 0), ty: p.ty + num(args?.dy ?? 0) }, 0.6, 'spring')
  },
  labelSide(p, args): VerbClip<GeoShapeP> {
    const edge = Math.floor(num(args?.edge ?? 0))
    const label = String(args?.label ?? '')
    return tween(p, { ...p, sideLabels: { ...p.sideLabels, [edge]: label } }, 0.4, 'easeOutCubic')
  },
  markAngle(p, args): VerbClip<GeoShapeP> {
    const v = Math.floor(num(args?.vertex ?? args ?? 0))
    return tween(
      p,
      { ...p, angleArcs: p.angleArcs.includes(v) ? p.angleArcs : [...p.angleArcs, v] },
      0.4,
      'easeOutBack',
    )
  },
}

function centroid(base: [number, number][]): [number, number] {
  let x = 0,
    y = 0
  for (const v of base) {
    x += v[0]
    y += v[1]
  }
  return [x / base.length, y / base.length]
}

function render(_params: GeoShapeP, state: ManipState<GeoShapeP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const A = seg.from
  const B = seg.to
  const p = seg.p
  const rot = lerp(A.rot, B.rot, p) * (Math.PI / 180)
  const sx = lerp(A.sx, B.sx, p)
  const sy = lerp(A.sy, B.sy, p)
  const tx = lerp(A.tx, B.tx, p)
  const ty = lerp(A.ty, B.ty, p)
  const base = B.base
  const [cx, cy] = centroid(base)

  const toPx = ([x, y]: [number, number]): [number, number] => {
    // scale (mirror) about centroid, then rotate, then translate — normalised
    let nx = cx + (x - cx) * sx
    let ny = cy + (y - cy) * sy
    const dx = nx - cx
    const dy = ny - cy
    nx = cx + dx * Math.cos(rot) - dy * Math.sin(rot)
    ny = cy + dx * Math.sin(rot) + dy * Math.cos(rot)
    nx += tx
    ny += ty
    return [nx * box.w, ny * box.h]
  }

  const pts = base.map(toPx)
  const prims: Prim[] = []
  let d = ''
  pts.forEach(([x, y], i) => {
    d += `${i === 0 ? 'M' : 'L'} ${x} ${y} `
  })
  d += 'Z'
  prims.push({
    k: 'path',
    d,
    fill: TOK.accent2,
    opacity: 0.18,
    color: TOK.ink,
    weight: 'md',
    closed: true,
    z: 2,
  })
  prims.push({ k: 'path', d, fill: 'none', color: TOK.ink, weight: 'md', closed: true, z: 3 })

  // side labels + ticks
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const mx = (a[0] + b[0]) / 2
    const my = (a[1] + b[1]) / 2
    const sideLabel = B.sideLabels[i]
    if (sideLabel !== undefined) {
      prims.push({
        k: 'label',
        x: mx,
        y: my,
        text: sideLabel,
        color: TOK.accent,
        size: box.h * 0.08,
        align: 'middle',
        baseline: 'middle',
        z: 5,
      })
    }
    if (B.ticks.includes(i)) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1]
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len,
        ny = dx / len
      prims.push({
        k: 'line',
        x1: mx - nx * 8,
        y1: my - ny * 8,
        x2: mx + nx * 8,
        y2: my + ny * 8,
        color: TOK.ink,
        weight: 'sm',
        z: 4,
      })
    }
  }
  // angle arcs
  const newArc = seg.verb === 'markAngle' ? B.angleArcs[B.angleArcs.length - 1] : -1
  for (const vi of B.angleArcs) {
    const grow = vi === newArc ? p : 1
    const c = pts[vi]!
    prims.push({
      k: 'circle',
      cx: c[0],
      cy: c[1],
      r: box.h * 0.06 * grow,
      fill: 'none',
      color: TOK.warn,
      weight: 'sm',
      opacity: grow,
      z: 4,
    })
  }

  return { prims, view: box }
}

export const GeoShape: Manipulative<GeoShapeP> = {
  kind: 'geoshape',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
