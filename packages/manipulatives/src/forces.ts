// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * forces.ts — forces & motion (Cambridge Primary Science: Physics — pushes,
 * pulls, balanced/unbalanced forces). Arrows on a box; the net force shifts it.
 * verbs: pushLeft(n) · pushRight(n) · showNet · reset.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, TOK } from './util'

export type ForcesP = {
  left: number
  right: number
  showNet: boolean
  labels: { balanced: string; net: string; left: string; right: string }
}

const DEFAULT: ForcesP = {
  left: 0,
  right: 0,
  showNet: false,
  labels: {
    balanced: 'Balanced — object at rest',
    net: 'Net force {n} to the {dir} — object moves',
    left: 'left',
    right: 'right',
  },
}

function normalize(raw: unknown): ForcesP {
  const r = (raw ?? {}) as Partial<ForcesP>
  return {
    left: num(r.left ?? 0),
    right: num(r.right ?? 0),
    showNet: !!r.showNet,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
function fill(t: string, v: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))
}

const verbs: Manipulative<ForcesP>['verbs'] = {
  pushLeft(p, args): VerbClip<ForcesP> {
    return tween(p, { ...p, left: p.left + num(args?.n ?? args ?? 1) }, 0.5, 'easeOutBack')
  },
  pushRight(p, args): VerbClip<ForcesP> {
    return tween(p, { ...p, right: p.right + num(args?.n ?? args ?? 1) }, 0.5, 'easeOutBack')
  },
  setForces(p, args): VerbClip<ForcesP> {
    return tween(
      p,
      { ...p, left: num(args?.left ?? p.left), right: num(args?.right ?? p.right) },
      0.5,
      'spring',
    )
  },
  showNet(p): VerbClip<ForcesP> {
    return tween(p, { ...p, showNet: true }, 0.6, 'easeInOutCubic')
  },
  reset(p): VerbClip<ForcesP> {
    return tween(p, { ...p, left: 0, right: 0, showNet: false }, 0.4, 'easeInCubic')
  },
}

function arrow(prims: Prim[], x: number, y: number, dir: number, len: number, color: string) {
  if (len < 1) return
  const ex = x + dir * len
  prims.push({ k: 'line', x1: x, y1: y, x2: ex, y2: y, color, weight: 'lg', cap: 'round', z: 3 })
  const h = 12
  prims.push({
    k: 'path',
    d: `M ${ex - dir * h} ${y - h * 0.7} L ${ex} ${y} L ${ex - dir * h} ${y + h * 0.7}`,
    color,
    weight: 'lg',
    z: 3,
  })
}

function render(_params: ForcesP, state: ManipState<ForcesP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const animating = seg.verb && seg.verb !== 'showNet'
  const left = animating ? lerp(seg.from.left, P.left, seg.p) : P.left
  const right = animating ? lerp(seg.from.right, P.right, seg.p) : P.right
  const net = right - left

  // object shifts under the net force when showNet runs
  const shiftMax = box.w * 0.16
  const shift = P.showNet
    ? (seg.verb === 'showNet' ? seg.p : 1) * Math.sign(net) * Math.min(1, Math.abs(net) / 5) * shiftMax
    : 0
  const cx = box.w / 2 + shift
  const cy = box.h * 0.5
  const bw = box.w * 0.16,
    bh = box.h * 0.18

  prims.push({
    k: 'line',
    x1: box.w * 0.05,
    y1: cy + bh / 2,
    x2: box.w * 0.95,
    y2: cy + bh / 2,
    color: TOK.faint,
    weight: 'md',
    z: 0,
  })
  prims.push({
    k: 'rect',
    x: cx - bw / 2,
    y: cy - bh / 2,
    w: bw,
    h: bh,
    fill: TOK.accent,
    color: TOK.ink,
    weight: 'md',
    rx: 8,
    z: 2,
  })

  const scale = box.w * 0.03
  arrow(prims, cx - bw / 2, cy, -1, left * scale, TOK.accent2)
  arrow(prims, cx + bw / 2, cy, 1, right * scale, TOK.warn)
  prims.push({
    k: 'label',
    x: cx - bw / 2 - left * scale - 14,
    y: cy,
    text: left ? String(left) : '',
    color: TOK.accent2,
    size: box.h * 0.06,
    align: 'end',
    baseline: 'middle',
    z: 3,
  })
  prims.push({
    k: 'label',
    x: cx + bw / 2 + right * scale + 14,
    y: cy,
    text: right ? String(right) : '',
    color: TOK.warn,
    size: box.h * 0.06,
    align: 'start',
    baseline: 'middle',
    z: 3,
  })

  if (P.showNet) {
    const msg =
      net === 0
        ? P.labels.balanced
        : fill(P.labels.net, { n: Math.abs(net), dir: net > 0 ? P.labels.right : P.labels.left })
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.86,
      text: msg,
      color: net === 0 ? TOK.good : TOK.accent,
      size: box.h * 0.06,
      align: 'middle',
      baseline: 'middle',
      z: 4,
    })
  }
  return { prims, view: box }
}

export const ForcesArrows: Manipulative<ForcesP> = {
  kind: 'forces',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
