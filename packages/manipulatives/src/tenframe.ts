// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * tenframe.ts — Ten frame (Cambridge Primary, early number / bonds). A 2×5 grid
 * (or two, for 20) filled with counters. verbs: add(n) · remove(n) · bond(k)
 * (split into two colours to show a number bond) · fill(n).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'
import { drawIcon } from './icons'

export type TenFrameP = {
  capacity: number
  count: number
  bond: number | null
  /** the object filling each cell — draws real stars/apples/… to match the
   *  narration instead of a plain dot (default keeps the classic dot). */
  icon: string
  /** media library: an image URL for the icon (overrides the built-in art). */
  assets?: Partial<Record<string, string>>
  assetMode?: boolean
}

const DEFAULT: TenFrameP = { capacity: 10, count: 0, bond: null, icon: 'dot' }

function normalize(raw: unknown): TenFrameP {
  const r = (raw ?? {}) as Partial<TenFrameP> & { counters?: number }
  const capacity = Math.max(10, Math.round((r.capacity ?? 10) / 10) * 10)
  const count = Math.max(0, Math.min(capacity, Math.floor(r.count ?? r.counters ?? 0)))
  return {
    capacity,
    count,
    bond: r.bond ?? null,
    icon: (typeof r.icon === 'string' && r.icon) || 'dot',
    assets: r.assets,
    assetMode: !!r.assetMode,
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<TenFrameP>['verbs'] = {
  add(p, args): VerbClip<TenFrameP> {
    const n = Math.floor(num(args?.n ?? args ?? 1))
    return tween(p, { ...p, count: Math.min(p.capacity, p.count + n) }, 0.45, 'easeOutBack')
  },
  remove(p, args): VerbClip<TenFrameP> {
    const n = Math.floor(num(args?.n ?? args ?? 1))
    return tween(p, { ...p, count: Math.max(0, p.count - n) }, 0.4, 'easeInCubic')
  },
  bond(p, args): VerbClip<TenFrameP> {
    const k = Math.max(0, Math.min(p.count, Math.floor(num(args?.k ?? args ?? 0))))
    return tween(p, { ...p, bond: k }, 0.5, 'easeOutCubic')
  },
  fill(p, args): VerbClip<TenFrameP> {
    const n = Math.max(0, Math.min(p.capacity, Math.floor(num(args?.n ?? args ?? p.capacity))))
    return tween(p, { ...p, count: n }, 0.5, 'easeOutBack')
  },
}

function render(_params: TenFrameP, state: ManipState<TenFrameP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const frames = Math.max(1, Math.round(P.capacity / 10))
  const cell = Math.min((box.w * 0.82) / 5, (box.h * 0.66) / (frames * 2))
  const gridW = 5 * cell
  const frameGap = cell * 0.45
  const gridH = frames * 2 * cell + (frames - 1) * frameGap
  const ox = (box.w - gridW) / 2
  const oy = (box.h - gridH) / 2 + box.h * 0.04

  const center = (i: number) => {
    const f = Math.floor(i / 10)
    const li = i % 10
    const row = Math.floor(li / 5)
    const col = li % 5
    return {
      x: ox + col * cell + cell / 2,
      y: oy + f * (2 * cell + frameGap) + row * cell + cell / 2,
    }
  }

  // frame cells
  for (let i = 0; i < P.capacity; i++) {
    const c = center(i)
    prims.push({
      k: 'rect',
      x: c.x - cell / 2,
      y: c.y - cell / 2,
      w: cell,
      h: cell,
      fill: 'none',
      color: TOK.ink,
      weight: 'sm',
      z: 1,
    })
  }
  // counters
  const r = cell * 0.34
  const addBase = Math.min(seg.from.count, seg.to.count)
  for (let i = 0; i < P.count; i++) {
    const c = center(i)
    const twoColor = P.bond !== null && i >= P.bond
    let op = 1
    let rr = r
    if (seg.verb === 'add' && i >= addBase) {
      op = seg.p
      rr = r * (0.3 + 0.7 * seg.p)
    }
    drawIcon(prims, P.icon, c.x, c.y, rr, op, {
      color: twoColor ? TOK.accent2 : undefined,
      src: P.assets?.[P.icon],
      assetMode: P.assetMode,
    })
  }
  // fading removed counters
  if (seg.verb === 'remove') {
    for (let i = P.count; i < seg.from.count; i++) {
      const c = center(i)
      drawIcon(prims, P.icon, c.x, c.y, r, 1 - seg.p, {
        src: P.assets?.[P.icon],
        assetMode: P.assetMode,
      })
    }
  }
  // label
  const label =
    P.bond !== null && P.bond > 0 && P.bond < P.count
      ? `${P.bond} + ${P.count - P.bond} = ${P.count}`
      : String(P.count)
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: oy + gridH + cell * 0.7,
    text: label,
    color: TOK.ink,
    size: cell * 0.7,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  })

  return { prims, view: box }
}

export const TenFrame: Manipulative<TenFrameP> = {
  kind: 'tenframe',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
