// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * transformgrid.ts — TransformGrid (phép biến hình trên lưới, THPT 15–18).
 * Geometric transformations of a polygon on a −R..R coordinate grid: tịnh tiến
 * (translate), đối xứng trục (reflect across x/y axis), quay quanh gốc (rotate
 * 90/180/270 about the origin) and vị tự (dilate from the origin, factor k).
 * Vertices are computed PURELY through the transform chain; the original shape
 * stays faint, intermediates show as ghosts, and the current image animates —
 * rotation interpolates the ANGLE (each vertex swings by deg·p), dilation the
 * factor, translate/reflect the endpoints. Each verb also draws its annotation:
 * dashed arrow (translate), highlighted mirror + pairing lines (reflect), arc
 * arrow at the origin (rotate), rays from the origin (dilate).
 * verbs: translate(dx,dy) · reflect(axis) · rotate(deg) · dilate(k) ·
 *        resetShape(shape?) · toggleGhosts() · markPoint(x,y)
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { fmt, lerp, TOK } from './util'

export type Xform =
  | { op: 'translate'; dx: number; dy: number }
  | { op: 'reflect'; axis: 'x' | 'y' }
  | { op: 'rotate'; deg: number } // 90 | 180 | 270, ccw about the origin
  | { op: 'dilate'; k: number }

export type TransformGridP = {
  shape: [number, number][] // polygon vertices in grid units
  transforms: Xform[] // applied in order
  showGhosts: boolean // show each intermediate image as a ghost
  gridRange: number // grid from -range..range
  mark: [number, number] | null // learner-marked point (markPoint verb)
}

/** default: an L-tromino outline (asymmetric → reflections/rotations read clearly). */
const L_TROMINO: [number, number][] = [
  [0, 0],
  [2, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2],
]
const DEFAULT: TransformGridP = {
  shape: L_TROMINO,
  transforms: [],
  showGhosts: true,
  gridRange: 6,
  mark: null,
}

const DEG = Math.PI / 180
const MAX_XFORMS = 16

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normShape(v: unknown): [number, number][] | null {
  if (!Array.isArray(v) || v.length < 3) return null
  const out: [number, number][] = []
  for (const q of v) {
    if (!Array.isArray(q)) return null
    out.push([Math.round(num(q[0])), Math.round(num(q[1]))])
  }
  return out
}

function normXf(raw: unknown): Xform | null {
  const x = (raw ?? {}) as Record<string, unknown>
  const op = x.op
  if (op === 'translate') return { op, dx: Math.round(num(x.dx)), dy: Math.round(num(x.dy)) }
  if (op === 'reflect') return { op, axis: x.axis === 'x' ? 'x' : 'y' }
  if (op === 'rotate') {
    let d = Math.round(num(x.deg) / 90) * 90
    d = ((d % 360) + 360) % 360
    return { op, deg: d === 0 ? 90 : d }
  }
  if (op === 'dilate') {
    const k0 = Math.abs(num(x.k))
    return { op, k: Math.max(0.25, Math.min(4, k0 || 2)) }
  }
  return null
}

function normalize(raw: unknown): TransformGridP {
  const r = (raw ?? {}) as Partial<TransformGridP>
  const xs: Xform[] = []
  if (Array.isArray(r.transforms)) {
    for (const x of r.transforms) {
      const n = normXf(x)
      if (n && xs.length < MAX_XFORMS) xs.push(n)
    }
  }
  const mk =
    Array.isArray(r.mark) && r.mark.length >= 2
      ? ([Math.round(num(r.mark[0])), Math.round(num(r.mark[1]))] as [number, number])
      : null
  return {
    shape: normShape(r.shape) ?? L_TROMINO.map((q) => [...q] as [number, number]),
    transforms: xs,
    showGhosts: r.showGhosts == null ? true : !!r.showGhosts,
    gridRange: Math.max(2, Math.min(12, Math.floor(num(r.gridRange ?? 6)) || 6)),
    mark: mk,
  }
}

/* -------------------------------------------------------------- pure math */

function rotV(v: [number, number], deg: number): [number, number] {
  const t = deg * DEG
  const c = Math.cos(t),
    s = Math.sin(t)
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]
}

export function applyXf(v: [number, number], xf: Xform): [number, number] {
  switch (xf.op) {
    case 'translate':
      return [v[0] + xf.dx, v[1] + xf.dy]
    case 'reflect':
      return xf.axis === 'x' ? [v[0], -v[1]] : [-v[0], v[1]]
    case 'rotate':
      return rotV(v, xf.deg)
    case 'dilate':
      return [v[0] * xf.k, v[1] * xf.k]
  }
}

/** vertices after the first `upTo` transforms (grid units). Pure. */
export function chainVertices(
  shape: [number, number][],
  transforms: Xform[],
  upTo?: number,
): [number, number][] {
  const n = upTo == null ? transforms.length : Math.max(0, Math.min(upTo, transforms.length))
  let vs = shape.map((v) => [v[0], v[1]] as [number, number])
  for (let i = 0; i < n; i++) vs = vs.map((v) => applyXf(v, transforms[i]!))
  return vs
}

/* -------------------------------------------------------------------- verbs */

function append(
  p: TransformGridP,
  xf: Xform,
  dur: number,
  easing: Parameters<typeof tween>[3],
): VerbClip<TransformGridP> {
  if (p.transforms.length >= MAX_XFORMS) return tween(p, p, 0.3, easing)
  return tween(p, { ...p, transforms: [...p.transforms, xf] }, dur, easing)
}

const verbs: Manipulative<TransformGridP>['verbs'] = {
  translate(p, args): VerbClip<TransformGridP> {
    const dx = Math.max(-12, Math.min(12, Math.round(num(args?.dx))))
    const dy = Math.max(-12, Math.min(12, Math.round(num(args?.dy))))
    return append(p, { op: 'translate', dx, dy }, 0.6, 'spring')
  },
  reflect(p, args): VerbClip<TransformGridP> {
    const axis = (args?.axis ?? args) === 'x' ? 'x' : 'y'
    return append(p, { op: 'reflect', axis }, 0.7, 'easeInOutCubic')
  },
  rotate(p, args): VerbClip<TransformGridP> {
    const xf = normXf({
      op: 'rotate',
      deg: args?.deg ?? (typeof args === 'number' || typeof args === 'string' ? args : 90),
    })!
    return append(p, xf, 0.7, 'easeInOutCubic')
  },
  dilate(p, args): VerbClip<TransformGridP> {
    const xf = normXf({
      op: 'dilate',
      k: args?.k ?? (typeof args === 'number' || typeof args === 'string' ? args : 2),
    })!
    return append(p, xf, 0.6, 'easeOutCubic')
  },
  resetShape(p, args): VerbClip<TransformGridP> {
    const shape = normShape(args?.shape) ?? p.shape
    return tween(p, { ...p, shape, transforms: [] }, 0.45, 'easeOutCubic')
  },
  toggleGhosts(p): VerbClip<TransformGridP> {
    return tween(p, { ...p, showGhosts: !p.showGhosts }, 0.3, 'easeOutCubic')
  },
  markPoint(p, args): VerbClip<TransformGridP> {
    const R = p.gridRange
    const x = Math.max(-R, Math.min(R, Math.round(num(args?.x))))
    const y = Math.max(-R, Math.min(R, Math.round(num(args?.y))))
    return tween(p, { ...p, mark: [x, y] }, 0.3, 'easeOutBack')
  },
}

/* ------------------------------------------------------------------- render */

type V2 = [number, number]

function polyPath(pts: V2[]): string {
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z'
}

function centroid(pts: V2[]): V2 {
  let x = 0,
    y = 0
  for (const q of pts) {
    x += q[0]
    y += q[1]
  }
  return [x / Math.max(1, pts.length), y / Math.max(1, pts.length)]
}

function arrowHead(
  prims: Prim[],
  x: number,
  y: number,
  ang: number,
  size: number,
  color: string,
  opacity: number,
  z: number,
): void {
  for (const da of [2.6, -2.6]) {
    prims.push({
      k: 'line',
      x1: x,
      y1: y,
      x2: x + Math.cos(ang + da) * size,
      y2: y + Math.sin(ang + da) * size,
      color,
      weight: 'md',
      cap: 'round',
      opacity,
      z,
    })
  }
}

function render(
  _params: TransformGridP,
  state: ManipState<TransformGridP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const F = seg.from,
    P = seg.to,
    p = seg.p
  const prims: Prim[] = []
  const R = P.gridRange
  const S = Math.min(box.w, box.h)
  // grid geometry — keep in sync with the "transformgrid" onTap in interactions
  const pad = S * 0.08
  const unit = (S - 2 * pad) / (2 * R)
  const ox = box.w / 2,
    oy = box.h / 2
  const X = (x: number) => ox + x * unit
  const Y = (y: number) => oy - y * unit
  const MP = (v: V2): V2 => [X(v[0]), Y(v[1])]

  // grid + axes + integer labels
  for (let i = -R; i <= R; i++) {
    prims.push({
      k: 'line',
      x1: X(i),
      y1: Y(-R),
      x2: X(i),
      y2: Y(R),
      color: TOK.faint,
      weight: 'sm',
      z: 1,
    })
    prims.push({
      k: 'line',
      x1: X(-R),
      y1: Y(i),
      x2: X(R),
      y2: Y(i),
      color: TOK.faint,
      weight: 'sm',
      z: 1,
    })
  }
  prims.push({
    k: 'line',
    x1: X(-R),
    y1: oy,
    x2: X(R),
    y2: oy,
    color: TOK.ink,
    weight: 'md',
    z: 2,
  })
  prims.push({
    k: 'line',
    x1: ox,
    y1: Y(-R),
    x2: ox,
    y2: Y(R),
    color: TOK.ink,
    weight: 'md',
    z: 2,
  })
  const step = R > 6 ? 2 : 1
  for (let i = -R; i <= R; i += step) {
    if (i === 0) continue
    prims.push({
      k: 'label',
      x: X(i),
      y: oy + S * 0.028,
      text: String(i),
      color: TOK.soft,
      size: S * 0.026,
      align: 'middle',
      baseline: 'middle',
      z: 2,
    })
    prims.push({
      k: 'label',
      x: ox - S * 0.022,
      y: Y(i),
      text: String(i),
      color: TOK.soft,
      size: S * 0.026,
      align: 'end',
      baseline: 'middle',
      z: 2,
    })
  }

  // vertex positions through the chain (pure math)
  const prevV = chainVertices(F.shape, F.transforms)
  const curV = chainVertices(P.shape, P.transforms)
  const last = P.transforms[P.transforms.length - 1]
  const appended = P.transforms.length === F.transforms.length + 1 && F.shape.length === P.shape.length

  let drawV: V2[] = curV
  let crossOp = 1
  if (appended && last) {
    if (last.op === 'rotate') {
      // interpolate the ANGLE: swing every vertex by deg·p about the origin
      drawV = prevV.map((v) => rotV(v, last.deg * p))
    } else if (last.op === 'dilate') {
      const k = lerp(1, last.k, p)
      drawV = prevV.map((v) => [v[0] * k, v[1] * k] as V2)
    } else {
      drawV = prevV.map((v, i) => [lerp(v[0], curV[i]![0], p), lerp(v[1], curV[i]![1], p)] as V2)
    }
  } else if (prevV.length === curV.length) {
    drawV = prevV.map((v, i) => [lerp(v[0], curV[i]![0], p), lerp(v[1], curV[i]![1], p)] as V2)
  } else {
    crossOp = p // vertex count changed (resetShape with a new shape) → crossfade
    prims.push({
      k: 'path',
      d: polyPath(prevV.map(MP)),
      fill: TOK.accent,
      opacity: 0.2 * (1 - p),
      closed: true,
      z: 3,
    })
  }

  // ORIGINAL shape, always faint — the "before" every image is compared against
  prims.push({
    k: 'path',
    d: polyPath(P.shape.map(MP)),
    fill: TOK.faint,
    opacity: 0.55,
    color: TOK.soft,
    weight: 'sm',
    closed: true,
    z: 2,
  })

  // ghosts of each intermediate image
  const gOp = F.showGhosts === P.showGhosts ? (P.showGhosts ? 1 : 0) : P.showGhosts ? p : 1 - p
  if (gOp > 0.01) {
    for (let i = 1; i < P.transforms.length; i++) {
      prims.push({
        k: 'path',
        d: polyPath(chainVertices(P.shape, P.transforms, i).map(MP)),
        fill: 'none',
        color: TOK.soft,
        weight: 'sm',
        dash: 6,
        opacity: 0.4 * gOp,
        closed: true,
        z: 3,
      })
    }
  }

  // current image (solid accent)
  const scr = drawV.map(MP)
  prims.push({
    k: 'path',
    d: polyPath(scr),
    fill: TOK.accent,
    opacity: 0.3 * crossOp,
    closed: true,
    z: 4,
  })
  prims.push({
    k: 'path',
    d: polyPath(scr),
    fill: 'none',
    color: TOK.accent,
    weight: 'md',
    opacity: crossOp,
    closed: true,
    z: 5,
  })

  // ---- transform annotation for the active verb ----
  if (appended && last) {
    const c0 = centroid(prevV.map(MP))
    const c1 = centroid(scr)
    if (last.op === 'translate') {
      const ang = Math.atan2(c1[1] - c0[1], c1[0] - c0[0])
      prims.push({
        k: 'line',
        x1: c0[0],
        y1: c0[1],
        x2: c1[0],
        y2: c1[1],
        color: TOK.warn,
        weight: 'md',
        dash: 7,
        z: 6,
      })
      if (Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 2)
        arrowHead(prims, c1[0], c1[1], ang, S * 0.02, TOK.warn, 1, 6)
      prims.push({
        k: 'label',
        x: (c0[0] + c1[0]) / 2,
        y: (c0[1] + c1[1]) / 2 - S * 0.03,
        text: `(${fmt(last.dx)}; ${fmt(last.dy)})`,
        color: TOK.warn,
        size: S * 0.038,
        align: 'middle',
        baseline: 'middle',
        z: 6,
      })
    } else if (last.op === 'reflect') {
      // the mirror line, highlighted
      if (last.axis === 'x')
        prims.push({
          k: 'line',
          x1: X(-R),
          y1: oy,
          x2: X(R),
          y2: oy,
          color: TOK.warn,
          weight: 'md',
          opacity: 0.75,
          z: 6,
        })
      else
        prims.push({
          k: 'line',
          x1: ox,
          y1: Y(-R),
          x2: ox,
          y2: Y(R),
          color: TOK.warn,
          weight: 'md',
          opacity: 0.75,
          z: 6,
        })
      // perpendicular pairing lines, strongest at the flight midpoint
      const pairOp = Math.sin(Math.PI * Math.min(1, p)) * 0.7
      if (pairOp > 0.02) {
        prevV.forEach((v, i) => {
          const a = MP(v),
            b = MP(curV[i]!)
          prims.push({
            k: 'line',
            x1: a[0],
            y1: a[1],
            x2: b[0],
            y2: b[1],
            color: TOK.warn,
            weight: 'sm',
            dash: 5,
            opacity: pairOp,
            z: 6,
          })
        })
      }
    } else if (last.op === 'rotate') {
      // arc arrow at the origin sweeping deg·p
      const gc = centroid(prevV)
      let rr = Math.hypot(gc[0], gc[1]) * unit
      if (rr < unit * 0.8) rr = unit * 1.5
      rr = Math.min(rr, R * unit * 0.9)
      const a0 = Math.atan2(gc[1], gc[0])
      const a1 = a0 + last.deg * DEG * p
      const N = Math.max(12, Math.ceil(Math.abs(a1 - a0) / 0.1))
      let d = ''
      for (let i = 0; i <= N; i++) {
        const a = a0 + ((a1 - a0) * i) / N
        d += `${i === 0 ? 'M' : 'L'} ${(ox + Math.cos(a) * rr).toFixed(2)} ${(oy - Math.sin(a) * rr).toFixed(2)} `
      }
      prims.push({ k: 'path', d, fill: 'none', color: TOK.warn, weight: 'md', z: 6 })
      arrowHead(
        prims,
        ox + Math.cos(a1) * rr,
        oy - Math.sin(a1) * rr,
        Math.atan2(-Math.cos(a1), -Math.sin(a1)),
        S * 0.02,
        TOK.warn,
        1,
        6,
      )
      prims.push({
        k: 'label',
        x: ox + S * 0.02,
        y: oy + S * 0.045,
        text: `${fmt(last.deg)}°`,
        color: TOK.warn,
        size: S * 0.038,
        align: 'start',
        baseline: 'middle',
        z: 6,
      })
    } else if (last.op === 'dilate') {
      // rays from the origin through each vertex
      for (const v of scr) {
        prims.push({
          k: 'line',
          x1: ox,
          y1: oy,
          x2: ox + (v[0] - ox) * 1.12,
          y2: oy + (v[1] - oy) * 1.12,
          color: TOK.warn,
          weight: 'sm',
          dash: 6,
          opacity: 0.55,
          z: 6,
        })
      }
      prims.push({
        k: 'label',
        x: c1[0],
        y: c1[1] - S * 0.04,
        text: `×${fmt(last.k)}`,
        color: TOK.warn,
        size: S * 0.042,
        align: 'middle',
        baseline: 'middle',
        z: 6,
      })
    }
  }

  // learner's marked point
  if (P.mark) {
    const grow = seg.verb === 'markPoint' ? p : 1
    const mx = X(P.mark[0]),
      my = Y(P.mark[1])
    prims.push({
      k: 'circle',
      cx: mx,
      cy: my,
      r: Math.max(4, unit * 0.16) * grow,
      fill: TOK.warn,
      color: TOK.ink,
      weight: 'sm',
      opacity: grow,
      z: 7,
    })
    const flip = mx > box.w * 0.8
    prims.push({
      k: 'label',
      x: mx + (flip ? -S * 0.015 : S * 0.015),
      y: my - S * 0.03,
      text: `(${fmt(P.mark[0])}; ${fmt(P.mark[1])})`,
      color: TOK.warn,
      size: S * 0.036,
      align: flip ? 'end' : 'start',
      baseline: 'middle',
      opacity: grow,
      z: 7,
    })
  }

  return { prims, view: box }
}

export const TransformGrid: Manipulative<TransformGridP> = {
  kind: 'transformgrid',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
