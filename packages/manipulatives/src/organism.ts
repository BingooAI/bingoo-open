// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * organism.ts — labelled organism (Cambridge Primary Science: Biology — parts of
 * a plant / animal). A simple plant diagram; reveal leader-lines + labels for
 * each part. verbs: revealPart(name) · highlightPart(name) · revealAll.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type OrganismPart = { name: string; x: number; y: number } // anchor in 0..1
export type OrganismP = { parts: OrganismPart[]; revealed: string[]; highlight: string | null }

const PLANT: OrganismPart[] = [
  { name: 'flower', x: 0.5, y: 0.2 },
  { name: 'leaf', x: 0.63, y: 0.45 },
  { name: 'stem', x: 0.5, y: 0.55 },
  { name: 'root', x: 0.5, y: 0.85 },
]
const DEFAULT: OrganismP = { parts: PLANT, revealed: [], highlight: null }

function normalize(raw: unknown): OrganismP {
  const r = (raw ?? {}) as Partial<OrganismP>
  return {
    parts: r.parts ?? PLANT,
    revealed: [...(r.revealed ?? [])],
    highlight: r.highlight ?? null,
  }
}

const verbs: Manipulative<OrganismP>['verbs'] = {
  revealPart(p, args): VerbClip<OrganismP> {
    const name = String(args?.name ?? args ?? '')
    return tween(
      p,
      {
        ...p,
        revealed: p.revealed.includes(name) ? p.revealed : [...p.revealed, name],
        highlight: name,
      },
      0.45,
      'easeOutBack',
    )
  },
  highlightPart(p, args): VerbClip<OrganismP> {
    return tween(p, { ...p, highlight: String(args?.name ?? args ?? '') }, 0.35, 'easeOutCubic')
  },
  revealAll(p): VerbClip<OrganismP> {
    return tween(p, { ...p, revealed: p.parts.map((x) => x.name), highlight: null }, 0.6, 'easeOutCubic')
  },
}

function drawPlant(prims: Prim[], box: { w: number; h: number }) {
  const cx = box.w * 0.5
  const gy = box.h * 0.88
  // stem
  prims.push({
    k: 'line',
    x1: cx,
    y1: gy,
    x2: cx,
    y2: box.h * 0.28,
    color: TOK.good,
    weight: 'lg',
    cap: 'round',
    z: 2,
  })
  // leaves
  prims.push({
    k: 'path',
    d: `M ${cx} ${box.h * 0.5} Q ${cx + box.w * 0.12} ${box.h * 0.4} ${cx + box.w * 0.16} ${box.h * 0.48} Q ${cx + box.w * 0.1} ${box.h * 0.54} ${cx} ${box.h * 0.5} Z`,
    fill: TOK.good,
    color: TOK.ink,
    weight: 'sm',
    closed: true,
    z: 2,
  })
  prims.push({
    k: 'path',
    d: `M ${cx} ${box.h * 0.58} Q ${cx - box.w * 0.12} ${box.h * 0.48} ${cx - box.w * 0.16} ${box.h * 0.56} Q ${cx - box.w * 0.1} ${box.h * 0.62} ${cx} ${box.h * 0.58} Z`,
    fill: TOK.good,
    color: TOK.ink,
    weight: 'sm',
    closed: true,
    z: 2,
  })
  // flower
  prims.push({
    k: 'circle',
    cx,
    cy: box.h * 0.22,
    r: box.h * 0.06,
    fill: TOK.accent,
    color: TOK.ink,
    weight: 'sm',
    z: 3,
  })
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2
    prims.push({
      k: 'circle',
      cx: cx + Math.cos(a) * box.h * 0.08,
      cy: box.h * 0.22 + Math.sin(a) * box.h * 0.08,
      r: box.h * 0.035,
      fill: TOK.warn,
      color: TOK.ink,
      weight: 'sm',
      z: 2,
    })
  }
  prims.push({
    k: 'circle',
    cx,
    cy: box.h * 0.22,
    r: box.h * 0.045,
    fill: TOK.accent,
    color: TOK.ink,
    weight: 'sm',
    z: 4,
  })
  // roots
  prims.push({
    k: 'path',
    d: `M ${cx} ${gy} L ${cx - box.w * 0.06} ${box.h * 0.97} M ${cx} ${gy} L ${cx + box.w * 0.06} ${box.h * 0.97} M ${cx} ${gy} L ${cx} ${box.h * 0.98}`,
    color: TOK.soft,
    weight: 'md',
    z: 1,
  })
  // ground
  prims.push({
    k: 'line',
    x1: box.w * 0.2,
    y1: gy,
    x2: box.w * 0.8,
    y2: gy,
    color: TOK.faint,
    weight: 'md',
    z: 1,
  })
}

function render(_params: OrganismP, state: ManipState<OrganismP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  drawPlant(prims, box)
  const newName = seg.verb === 'revealPart' ? P.revealed[P.revealed.length - 1] : null

  for (const part of P.parts) {
    if (!P.revealed.includes(part.name)) continue
    const grow = part.name === newName ? seg.p : 1
    const ax = part.x * box.w,
      ay = part.y * box.h
    const onLeft = part.x < 0.5
    const lx = onLeft ? box.w * 0.12 : box.w * 0.88
    const dim = P.highlight && P.highlight !== part.name ? 0.4 : 1
    prims.push({
      k: 'line',
      x1: ax,
      y1: ay,
      x2: lx,
      y2: ay,
      color: TOK.ink,
      weight: 'sm',
      opacity: grow * dim,
      z: 5,
    })
    prims.push({
      k: 'circle',
      cx: ax,
      cy: ay,
      r: box.h * 0.012,
      fill: TOK.accent2,
      color: TOK.ink,
      weight: 'sm',
      opacity: grow * dim,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: onLeft ? lx - box.w * 0.01 : lx + box.w * 0.01,
      y: ay,
      text: part.name,
      color: TOK.ink,
      size: box.h * 0.06,
      align: onLeft ? 'end' : 'start',
      baseline: 'middle',
      opacity: grow * dim,
      z: 6,
    })
  }
  return { prims, view: box }
}

export const OrganismLabel: Manipulative<OrganismP> = {
  kind: 'organism',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
