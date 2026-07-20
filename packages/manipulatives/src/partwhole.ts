// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * partwhole.ts — Part-whole ("cherry") model (Cambridge: number bonds, missing
 * part). A whole on top, parts below joined by connectors. verbs: split(parts)
 * · showWhole · showPart(i) · findUnknown(which). Any one value can be the ?.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type PartWholeP = {
  whole: number
  parts: number[]
  unknown: number | null // -1 = whole, 0..n-1 = a part, null = all shown
  revealed: boolean
}

const DEFAULT: PartWholeP = { whole: 10, parts: [6, 4], unknown: null, revealed: false }

function normalize(raw: unknown): PartWholeP {
  const r = (raw ?? {}) as Partial<PartWholeP>
  const parts = (r.parts ?? [6, 4]).map(num)
  return {
    whole: num(r.whole ?? parts.reduce((s, x) => s + x, 0)),
    parts,
    unknown: r.unknown ?? null,
    revealed: !!r.revealed,
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<PartWholeP>['verbs'] = {
  split(p, args): VerbClip<PartWholeP> {
    const parts = (args?.parts ?? args ?? p.parts).map(num)
    return tween(p, { ...p, parts, whole: parts.reduce((s: number, x: number) => s + x, 0) }, 0.55, 'spring')
  },
  showWhole(p): VerbClip<PartWholeP> {
    return tween(p, { ...p, unknown: null, revealed: false }, 0.4, 'easeOutBack')
  },
  showPart(p, args): VerbClip<PartWholeP> {
    const i = Math.floor(num(args?.i ?? args ?? 0))
    return tween(p, { ...p, unknown: i }, 0.4, 'easeOutCubic')
  },
  findUnknown(p, args): VerbClip<PartWholeP> {
    const which = args?.which ?? args
    const unknown = which === 'whole' ? -1 : Math.floor(num(which))
    return tween(p, { ...p, unknown, revealed: false }, 0.4, 'easeOutCubic')
  },
  reveal(p): VerbClip<PartWholeP> {
    return tween(p, { ...p, revealed: true }, 0.45, 'easeOutBack')
  },
}

function render(_params: PartWholeP, state: ManipState<PartWholeP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const n = P.parts.length
  const R = Math.min(box.w / (n + 1), box.h * 0.28) * 0.5
  const wholeC = { x: box.w / 2, y: box.h * 0.28 }
  const partY = box.h * 0.68
  const spacing = box.w / (n + 1)

  const label = (val: number, isUnknown: boolean) => (isUnknown && !P.revealed ? '?' : String(val))
  // connectors
  P.parts.forEach((_, i) => {
    const cx = spacing * (i + 1)
    prims.push({
      k: 'line',
      x1: wholeC.x,
      y1: wholeC.y + R,
      x2: cx,
      y2: partY - R,
      color: TOK.ink,
      weight: 'sm',
      z: 1,
    })
  })
  // whole
  const wUnknown = P.unknown === -1
  prims.push({
    k: 'circle',
    cx: wholeC.x,
    cy: wholeC.y,
    r: R,
    fill: wUnknown && !P.revealed ? TOK.paper : TOK.accent,
    color: TOK.ink,
    weight: 'md',
    z: 2,
  })
  prims.push({
    k: 'label',
    x: wholeC.x,
    y: wholeC.y,
    text: label(P.whole, wUnknown),
    color: TOK.ink,
    size: R * 0.9,
    align: 'middle',
    baseline: 'middle',
    z: 3,
  })
  // parts
  const newPart = seg.verb === 'split' ? true : false
  P.parts.forEach((val, i) => {
    const cx = spacing * (i + 1)
    const grow = newPart ? seg.p : 1
    const pUnknown = P.unknown === i
    prims.push({
      k: 'circle',
      cx,
      cy: partY,
      r: R * grow,
      fill: pUnknown && !P.revealed ? TOK.paper : TOK.accent2,
      color: TOK.ink,
      weight: 'md',
      opacity: grow,
      z: 2,
    })
    prims.push({
      k: 'label',
      x: cx,
      y: partY,
      text: label(val, pUnknown),
      color: TOK.ink,
      size: R * 0.9,
      align: 'middle',
      baseline: 'middle',
      opacity: grow,
      z: 3,
    })
  })

  return { prims, view: box }
}

export const PartWhole: Manipulative<PartWholeP> = {
  kind: 'partwhole',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
