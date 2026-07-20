/**
 * net3d.ts — 2D net ↔ 3D solid (Cambridge: 3D shapes, nets, faces/edges/vertices).
 * Shows a cube net and an isometric cube; `fold` crossfades net→solid.
 * verbs: showNet · fold · highlightFace(i) · showCounts.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type Net3DP = {
  solid: string
  faces: number
  edges: number
  vertices: number
  folded: boolean
  highlightFace: number | null
  showCounts: boolean
  labels: { counts: string }
}

const DEFAULT: Net3DP = {
  solid: 'cube',
  faces: 6,
  edges: 12,
  vertices: 8,
  folded: false,
  highlightFace: null,
  showCounts: false,
  labels: { counts: 'Faces {faces} · Edges {edges} · Vertices {vertices}' },
}

function normalize(raw: unknown): Net3DP {
  const r = (raw ?? {}) as Partial<Net3DP>
  return {
    solid: r.solid ?? 'cube',
    faces: num(r.faces ?? 6),
    edges: num(r.edges ?? 12),
    vertices: num(r.vertices ?? 8),
    folded: !!r.folded,
    highlightFace: r.highlightFace ?? null,
    showCounts: !!r.showCounts,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  }
}
const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<Net3DP>['verbs'] = {
  showNet(p): VerbClip<Net3DP> {
    return tween(p, { ...p, folded: false }, 0.4, 'easeOutCubic')
  },
  fold(p): VerbClip<Net3DP> {
    return tween(p, { ...p, folded: true }, 0.9, 'easeInOutCubic')
  },
  highlightFace(p, args): VerbClip<Net3DP> {
    return tween(p, { ...p, highlightFace: Math.floor(num(args?.i ?? args ?? 0)) }, 0.4, 'easeOutBack')
  },
  showCounts(p): VerbClip<Net3DP> {
    return tween(p, { ...p, showCounts: true }, 0.4, 'easeOutBack')
  },
}

// cube-net face grid (col,row) — a "cross"
const NET: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 2],
]

function render(_params: Net3DP, state: ManipState<Net3DP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const foldP = seg.verb === 'fold' ? seg.p : P.folded ? 1 : 0

  // net (fades out as it folds)
  const netOp = 1 - foldP
  if (netOp > 0.01) {
    const u = Math.min(box.w * 0.16, box.h * 0.22)
    const ox = box.w * 0.5 - 2 * u,
      oy = box.h * 0.5 - 1.5 * u
    NET.forEach(([c, r], i) => {
      const hi = P.highlightFace === i
      prims.push({
        k: 'rect',
        x: ox + c * u,
        y: oy + r * u,
        w: u,
        h: u,
        fill: hi ? TOK.warn : TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        opacity: netOp * 0.9,
        z: 2,
      })
    })
  }
  // isometric cube (fades in)
  const solidOp = foldP
  if (solidOp > 0.01) {
    const cx = box.w * 0.5,
      cy = box.h * 0.5,
      s = Math.min(box.w, box.h) * 0.22
    const top = `M ${cx} ${cy - s} L ${cx + s} ${cy - s * 0.5} L ${cx} ${cy} L ${cx - s} ${cy - s * 0.5} Z`
    const left = `M ${cx - s} ${cy - s * 0.5} L ${cx} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy + s * 0.5} Z`
    const right = `M ${cx + s} ${cy - s * 0.5} L ${cx} ${cy} L ${cx} ${cy + s} L ${cx + s} ${cy + s * 0.5} Z`
    prims.push({
      k: 'path',
      d: top,
      fill: TOK.accent,
      color: TOK.ink,
      weight: 'sm',
      opacity: solidOp,
      closed: true,
      z: 3,
    })
    prims.push({
      k: 'path',
      d: left,
      fill: TOK.accent2,
      color: TOK.ink,
      weight: 'sm',
      opacity: solidOp * 0.85,
      closed: true,
      z: 3,
    })
    prims.push({
      k: 'path',
      d: right,
      fill: TOK.good,
      color: TOK.ink,
      weight: 'sm',
      opacity: solidOp * 0.7,
      closed: true,
      z: 3,
    })
  }

  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.06,
    text: P.solid,
    color: TOK.ink,
    size: box.h * 0.08,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  })
  if (P.showCounts)
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.94,
      text: fill(P.labels.counts, { faces: P.faces, edges: P.edges, vertices: P.vertices }),
      color: TOK.soft,
      size: box.h * 0.07,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    })
  return { prims, view: box }
}

export const Net3D: Manipulative<Net3DP> = {
  kind: 'net3d',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
