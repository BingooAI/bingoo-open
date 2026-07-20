/**
 * lifecycle.ts — life cycle (Cambridge Primary Science: Biology — life cycles of
 * plants & animals). Stages arranged in a ring with arrows; advance moves the
 * marker. verbs: advance · setStage(i) · reveal.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, TOK } from './util'

export type LifeCycleP = { stages: string[]; current: number; revealed: boolean }

const DEFAULT: LifeCycleP = {
  stages: ['Egg', 'Larva', 'Pupa', 'Butterfly'],
  current: 0,
  revealed: false,
}

function normalize(raw: unknown): LifeCycleP {
  const r = (raw ?? {}) as Partial<LifeCycleP>
  return {
    stages: [...(r.stages ?? DEFAULT.stages)],
    current: Math.floor(r.current ?? 0),
    revealed: !!r.revealed,
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<LifeCycleP>['verbs'] = {
  advance(p): VerbClip<LifeCycleP> {
    return tween(p, { ...p, current: (p.current + 1) % p.stages.length }, 0.6, 'easeInOutCubic')
  },
  setStage(p, args): VerbClip<LifeCycleP> {
    return tween(
      p,
      {
        ...p,
        current:
          ((Math.floor(num(args?.i ?? args ?? 0)) % p.stages.length) + p.stages.length) % p.stages.length,
      },
      0.5,
      'spring',
    )
  },
  reveal(p): VerbClip<LifeCycleP> {
    return tween(p, { ...p, revealed: true }, 0.6, 'easeOutCubic')
  },
}

function render(_params: LifeCycleP, state: ManipState<LifeCycleP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const n = P.stages.length
  const cx = box.w / 2,
    cy = box.h * 0.52
  const R = Math.min(box.w, box.h) * 0.34
  const nodeR = Math.min(box.w, box.h) * 0.11
  const ang = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2

  // cyclic arrows between nodes
  for (let i = 0; i < n; i++) {
    const a0 = ang(i) + 0.35,
      a1 = ang((i + 1) % n) - 0.35
    const show =
      P.revealed || seg.verb === 'reveal'
        ? seg.verb === 'reveal'
          ? Math.max(0, Math.min(1, seg.p * n - i))
          : 1
        : 0.35
    const steps = 8
    let d = ''
    for (let s = 0; s <= steps; s++) {
      const a = a0 + (a1 - a0) * (s / steps)
      d += `${s === 0 ? 'M' : 'L'} ${cx + Math.cos(a) * R} ${cy + Math.sin(a) * R} `
    }
    prims.push({
      k: 'path',
      d,
      fill: 'none',
      color: TOK.accent2,
      weight: 'sm',
      opacity: show,
      z: 1,
    })
  }

  P.stages.forEach((s, i) => {
    const x = cx + Math.cos(ang(i)) * R,
      y = cy + Math.sin(ang(i)) * R
    const active = i === P.current
    prims.push({
      k: 'circle',
      cx: x,
      cy: y,
      r: nodeR,
      fill: active ? TOK.accent : TOK.paper,
      color: TOK.ink,
      weight: 'md',
      z: 2,
    })
    prims.push({
      k: 'label',
      x,
      y,
      text: s,
      color: TOK.ink,
      size: nodeR * 0.5,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    })
  })

  // marker ring animates from old to new stage
  const iFrom = seg.from.current,
    iTo = P.current
  const iInterp = seg.verb === 'advance' || seg.verb === 'setStage' ? lerp(iFrom, iTo, seg.p) : iTo
  const mx = cx + Math.cos(ang(iInterp)) * R,
    my = cy + Math.sin(ang(iInterp)) * R
  prims.push({
    k: 'circle',
    cx: mx,
    cy: my,
    r: nodeR * 1.18,
    fill: 'none',
    color: TOK.warn,
    weight: 'md',
    z: 4,
  })

  return { prims, view: box }
}

export const LifeCycle: Manipulative<LifeCycleP> = {
  kind: 'lifecycle',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
