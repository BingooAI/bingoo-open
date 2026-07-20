// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * states.ts — states of matter (Cambridge Primary Science: Chemistry — solids,
 * liquids, gases & changes of state). A particle model: heating loosens the
 * arrangement (solid→liquid→gas), cooling tightens it. Particle jitter is a pure
 * function of t (seeded) so the "energy" reads live yet seeks exactly.
 * verbs: heat · cool · setState(state).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, TOK } from './util'

export type MatterState = 'solid' | 'liquid' | 'gas'
export type StatesP = { state: MatterState; count: number; labels: Record<MatterState, string> }

const ORDER: MatterState[] = ['solid', 'liquid', 'gas']
const ENERGY: Record<MatterState, number> = { solid: 1, liquid: 3, gas: 6 }
const DEFAULT: StatesP = {
  state: 'solid',
  count: 25,
  labels: { solid: 'Solid', liquid: 'Liquid', gas: 'Gas' },
}

function normalize(raw: unknown): StatesP {
  const r = (raw ?? {}) as Partial<StatesP>
  const state = ORDER.includes(r.state as MatterState) ? (r.state as MatterState) : 'solid'
  return {
    state,
    count: Math.max(4, Math.min(40, Math.floor(r.count ?? 25))),
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  }
}

const verbs: Manipulative<StatesP>['verbs'] = {
  heat(p): VerbClip<StatesP> {
    const next = ORDER[Math.min(2, ORDER.indexOf(p.state) + 1)]!
    return tween(p, { ...p, state: next }, 0.9, 'easeInOutCubic')
  },
  cool(p): VerbClip<StatesP> {
    const next = ORDER[Math.max(0, ORDER.indexOf(p.state) - 1)]!
    return tween(p, { ...p, state: next }, 0.9, 'easeInOutCubic')
  },
  setState(p, args): VerbClip<StatesP> {
    const s = (args?.state ?? args) as MatterState
    return tween(p, { ...p, state: ORDER.includes(s) ? s : p.state }, 0.8, 'easeInOutCubic')
  },
}

function rand(i: number, salt: number): number {
  const h = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return h - Math.floor(h)
}

/** Base (pre-jitter) position of particle i for a state, within [0,1] box. */
function basePos(state: MatterState, i: number, n: number): { x: number; y: number } {
  if (state === 'solid') {
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    const c = i % cols,
      r = Math.floor(i / cols)
    return { x: 0.5 + (c - (cols - 1) / 2) * 0.11, y: 0.62 + (r - (rows - 1) / 2) * 0.11 }
  }
  if (state === 'liquid') {
    // loose fill of the lower ~45%
    return { x: 0.15 + rand(i, 1) * 0.7, y: 0.55 + rand(i, 2) * 0.32 }
  }
  // gas — spread across the whole box
  return { x: 0.1 + rand(i, 3) * 0.8, y: 0.12 + rand(i, 4) * 0.78 }
}

function render(_params: StatesP, state: ManipState<StatesP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const n = P.count
  const prims: Prim[] = []
  const changing = seg.verb === 'heat' || seg.verb === 'cool' || seg.verb === 'setState'
  const energy = changing ? lerp(ENERGY[seg.from.state], ENERGY[P.state], seg.p) : ENERGY[P.state]
  const r = Math.min(box.w, box.h) * 0.028

  // container hint
  prims.push({
    k: 'line',
    x1: box.w * 0.1,
    y1: box.h * 0.92,
    x2: box.w * 0.9,
    y2: box.h * 0.92,
    color: TOK.faint,
    weight: 'md',
    z: 0,
  })

  for (let i = 0; i < n; i++) {
    const a = basePos(seg.from.state, i, n)
    const b = basePos(P.state, i, n)
    const bx = changing ? lerp(a.x, b.x, seg.p) : b.x
    const by = changing ? lerp(a.y, b.y, seg.p) : b.y
    // seeded, t-based jitter — amplitude grows with energy (seekable)
    const ph = rand(i, 5) * 6.28
    const amp = energy * 0.006
    const jx = Math.sin(t * (1 + energy * 0.5) + ph) * amp
    const jy = Math.cos(t * (1.2 + energy * 0.5) + ph * 1.3) * amp
    prims.push({
      k: 'circle',
      cx: (bx + jx) * box.w,
      cy: (by + jy) * box.h,
      r,
      fill: TOK.accent2,
      color: TOK.ink,
      weight: 'sm',
      z: 2,
    })
  }

  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.07,
    text: P.labels[P.state],
    color: TOK.ink,
    size: box.h * 0.09,
    align: 'middle',
    baseline: 'middle',
    z: 4,
  })
  return { prims, view: box }
}

export const StatesOfMatter: Manipulative<StatesP> = {
  kind: 'states',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
