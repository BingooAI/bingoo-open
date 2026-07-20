/**
 * tense.ts — verb tense timeline (Cambridge Primary English: Grammar — past /
 * present / future). A verb form sits in the active time zone; `conjugate`
 * reveals all three. verbs: setTense(t) · conjugate · highlight(t).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, TOK } from './util'

export type TenseP = {
  forms: { past: string; present: string; future: string }
  tense: 'past' | 'present' | 'future'
  showAll: boolean
  labels: { past: string; present: string; future: string }
}

const ZONES = ['past', 'present', 'future'] as const
const DEFAULT: TenseP = {
  forms: { past: 'walked', present: 'walk', future: 'will walk' },
  tense: 'present',
  showAll: false,
  labels: { past: 'Past', present: 'Present', future: 'Future' },
}

function normalize(raw: unknown): TenseP {
  const r = (raw ?? {}) as Partial<TenseP>
  const f = r.forms ?? DEFAULT.forms
  return {
    forms: { past: f.past ?? '', present: f.present ?? '', future: f.future ?? '' },
    tense: r.tense ?? 'present',
    showAll: !!r.showAll,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  }
}

const verbs: Manipulative<TenseP>['verbs'] = {
  setTense(p, args): VerbClip<TenseP> {
    const tn = (args?.t ?? args) as TenseP['tense']
    return tween(p, { ...p, tense: ZONES.includes(tn) ? tn : 'present' }, 0.6, 'spring')
  },
  conjugate(p): VerbClip<TenseP> {
    return tween(p, { ...p, showAll: true }, 0.6, 'easeOutCubic')
  },
  highlight(p, args): VerbClip<TenseP> {
    const tn = (args?.t ?? args) as TenseP['tense']
    return tween(p, { ...p, tense: ZONES.includes(tn) ? tn : p.tense }, 0.4, 'easeOutCubic')
  },
}

function render(_params: TenseP, state: ManipState<TenseP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const cy = box.h * 0.5
  const zoneW = box.w / 3
  // timeline with arrow
  prims.push({
    k: 'line',
    x1: box.w * 0.04,
    y1: cy,
    x2: box.w * 0.96,
    y2: cy,
    color: TOK.ink,
    weight: 'md',
    z: 1,
  })
  const ax = box.w * 0.96
  prims.push({
    k: 'path',
    d: `M ${ax - 18} ${cy - 10} L ${ax} ${cy} L ${ax - 18} ${cy + 10}`,
    color: TOK.ink,
    weight: 'md',
    z: 1,
  })

  ZONES.forEach((z, i) => {
    const zx = zoneW * (i + 0.5)
    prims.push({
      k: 'circle',
      cx: zx,
      cy,
      r: box.h * 0.02,
      fill: TOK.soft,
      color: TOK.ink,
      weight: 'sm',
      z: 2,
    })
    prims.push({
      k: 'label',
      x: zx,
      y: cy + box.h * 0.1,
      text: P.labels[z],
      color: TOK.soft,
      size: box.h * 0.06,
      align: 'middle',
      baseline: 'middle',
      z: 2,
    })
    const active = P.showAll || P.tense === z
    if (active) {
      const op = P.showAll || P.tense === z ? 1 : 0
      prims.push({
        k: 'rect',
        x: zx - zoneW * 0.4,
        y: cy - box.h * 0.18,
        w: zoneW * 0.8,
        h: box.h * 0.11,
        fill: P.tense === z ? TOK.accent : TOK.paper,
        color: TOK.ink,
        weight: 'sm',
        rx: 8,
        opacity: op,
        z: 3,
      })
      prims.push({
        k: 'label',
        x: zx,
        y: cy - box.h * 0.125,
        text: P.forms[z],
        color: TOK.ink,
        size: box.h * 0.06,
        align: 'middle',
        baseline: 'middle',
        opacity: op,
        z: 4,
      })
    }
  })

  // marker pointer to active tense (animates when changing tense)
  const idxFrom = ZONES.indexOf(seg.from.tense)
  const idxTo = ZONES.indexOf(P.tense)
  const idx = seg.verb === 'setTense' || seg.verb === 'highlight' ? lerp(idxFrom, idxTo, seg.p) : idxTo
  const mx = zoneW * (idx + 0.5)
  prims.push({
    k: 'path',
    d: `M ${mx} ${cy - box.h * 0.04} L ${mx - box.h * 0.02} ${cy - box.h * 0.08} L ${mx + box.h * 0.02} ${cy - box.h * 0.08} Z`,
    fill: TOK.accent,
    color: TOK.ink,
    weight: 'sm',
    z: 5,
  })

  return { prims, view: box }
}

export const TenseTimeline: Manipulative<TenseP> = {
  kind: 'tense',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
