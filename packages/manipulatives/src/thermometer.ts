/**
 * thermometer.ts — thermometer (Cambridge Primary Science: measuring temperature;
 * enquiry). A scale + liquid column. verbs: setTemp(n) · mark(n) · compare(n).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, mapRange, clamp01, TOK } from './util'

export type ThermometerP = { temp: number; min: number; max: number; marks: number[] }

const DEFAULT: ThermometerP = { temp: 20, min: -10, max: 110, marks: [] }

function normalize(raw: unknown): ThermometerP {
  const r = (raw ?? {}) as Partial<ThermometerP>
  return {
    temp: num(r.temp ?? 20),
    min: num(r.min ?? -10),
    max: num(r.max ?? 110),
    marks: [...(r.marks ?? [])],
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<ThermometerP>['verbs'] = {
  setTemp(p, args): VerbClip<ThermometerP> {
    return tween(p, { ...p, temp: num(args?.n ?? args ?? p.temp) }, 0.7, 'easeInOutCubic')
  },
  mark(p, args): VerbClip<ThermometerP> {
    const m = num(args?.n ?? args)
    return tween(p, { ...p, marks: p.marks.includes(m) ? p.marks : [...p.marks, m] }, 0.4, 'easeOutBack')
  },
  compare(p, args): VerbClip<ThermometerP> {
    return tween(p, { ...p, temp: num(args?.n ?? args ?? p.temp) }, 0.7, 'easeInOutCubic')
  },
}

function render(
  _params: ThermometerP,
  state: ManipState<ThermometerP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const cx = box.w * 0.42
  const top = box.h * 0.1,
    bot = box.h * 0.82
  const tubeW = Math.min(box.w * 0.08, box.h * 0.06)
  const bulbR = tubeW * 1.5
  const animating = seg.verb === 'setTemp' || seg.verb === 'compare'
  const temp = animating ? lerp(seg.from.temp, P.temp, seg.p) : P.temp
  const Y = (v: number) => mapRange(clamp01Range(v, P.min, P.max), 0, 1, bot, top)

  // tube outline + bulb
  prims.push({
    k: 'rect',
    x: cx - tubeW / 2,
    y: top,
    w: tubeW,
    h: bot - top,
    fill: TOK.paper,
    color: TOK.ink,
    weight: 'md',
    rx: tubeW / 2,
    z: 1,
  })
  prims.push({
    k: 'circle',
    cx,
    cy: bot + bulbR * 0.6,
    r: bulbR,
    fill: TOK.accent,
    color: TOK.ink,
    weight: 'md',
    z: 1,
  })
  // liquid column
  const yT = Y(temp)
  prims.push({
    k: 'rect',
    x: cx - tubeW * 0.28,
    y: yT,
    w: tubeW * 0.56,
    h: bot + bulbR * 0.6 - yT,
    fill: TOK.accent,
    color: 'none',
    z: 2,
  })

  // scale ticks
  const stepV = (P.max - P.min) / 6
  for (let i = 0; i <= 6; i++) {
    const v = P.min + i * stepV
    const y = Y(v)
    prims.push({
      k: 'line',
      x1: cx + tubeW * 0.7,
      y1: y,
      x2: cx + tubeW * 1.1,
      y2: y,
      color: TOK.ink,
      weight: 'sm',
      z: 2,
    })
    prims.push({
      k: 'label',
      x: cx + tubeW * 1.4,
      y,
      text: `${Math.round(v)}°`,
      color: TOK.soft,
      size: box.h * 0.05,
      align: 'start',
      baseline: 'middle',
      z: 2,
    })
  }
  // marks (e.g. 0 = freeze, 100 = boil)
  for (const m of P.marks) {
    const y = Y(m)
    prims.push({
      k: 'line',
      x1: cx - tubeW * 1.1,
      y1: y,
      x2: cx - tubeW * 0.7,
      y2: y,
      color: TOK.accent2,
      weight: 'md',
      z: 3,
    })
    prims.push({
      k: 'label',
      x: cx - tubeW * 1.3,
      y,
      text: `${m}°`,
      color: TOK.accent2,
      size: box.h * 0.045,
      align: 'end',
      baseline: 'middle',
      z: 3,
    })
  }
  prims.push({
    k: 'label',
    x: box.w * 0.5,
    y: box.h * 0.95,
    text: `${Math.round(temp)}°C`,
    color: TOK.ink,
    size: box.h * 0.1,
    align: 'middle',
    baseline: 'middle',
    z: 4,
  })
  return { prims, view: box }
}

function clamp01Range(v: number, a: number, b: number): number {
  return clamp01((v - a) / (b - a || 1))
}

export const Thermometer: Manipulative<ThermometerP> = {
  kind: 'thermometer',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
