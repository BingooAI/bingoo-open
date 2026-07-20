// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * statplot.ts — StatPlot (thống kê mô tả: trung bình, trung vị, mốt, khoảng
 * biến thiên). A dot plot on a number axis with live COMPUTED statistics:
 * mean (balance-triangle + dashed line), median (flag), mode (ringed column),
 * range (bracket). Adding a point drops a dot from above and every shown
 * marker GLIDES to its new value — see how one outlier drags the mean but
 * barely moves the median. High school / upper secondary (13–18).
 * verbs: addData(v) · removeData(v) · showMean · showMedian · showMode ·
 *        showRange · setData(data) · answer(v)   [gradable]
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, mapRange, fmt, TOK } from './util'

export type StatShow = { mean: boolean; median: boolean; mode: boolean; range: boolean }
export type StatPlotP = {
  data: number[]
  /** axis range; null → derived from data (render always widens to fit data). */
  min: number | null
  max: number | null
  show: StatShow
  /** learner-visible marker names (authorable; English defaults). */
  labels: { mean: string; median: string; mode: string; range: string }
  /** learner's answer for the gate; null = not answered. */
  answer: number | null
}

const DEFAULT: StatPlotP = {
  data: [3, 5, 5, 6, 7, 8, 8, 8, 10],
  min: 0,
  max: 15,
  show: { mean: false, median: false, mode: false, range: false },
  labels: { mean: 'mean', median: 'median', mode: 'mode', range: 'range' },
  answer: null,
}

function num(v: unknown, dflt = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : dflt
}

function normalize(raw: unknown): StatPlotP {
  const r = (raw ?? {}) as Partial<StatPlotP>
  const data = (Array.isArray(r.data) ? r.data : DEFAULT.data).map((v) => num(v)).slice(0, 60)
  const sh = (r.show ?? {}) as Partial<StatShow>
  const lb = (r.labels ?? {}) as Partial<StatPlotP['labels']>
  return {
    data,
    min: r.min == null ? null : num(r.min),
    max: r.max == null ? null : num(r.max),
    show: { mean: !!sh.mean, median: !!sh.median, mode: !!sh.mode, range: !!sh.range },
    labels: {
      mean: typeof lb.mean === 'string' ? lb.mean : DEFAULT.labels.mean,
      median: typeof lb.median === 'string' ? lb.median : DEFAULT.labels.median,
      mode: typeof lb.mode === 'string' ? lb.mode : DEFAULT.labels.mode,
      range: typeof lb.range === 'string' ? lb.range : DEFAULT.labels.range,
    },
    answer: r.answer == null ? null : num(r.answer),
  }
}

/** All descriptive stats, COMPUTED from data (the truth the render shows).
 *  median: even length averages the middle two; mode: most frequent value,
 *  FIRST occurring wins a tie. keep in sync with statplot check in interactions.ts */
export function statsOf(data: number[]): {
  mean: number
  median: number
  mode: number
  lo: number
  hi: number
  range: number
} {
  if (!data.length) return { mean: 0, median: 0, mode: 0, lo: 0, hi: 0, range: 0 }
  const s = [...data].sort((a, b) => a - b)
  const n = s.length
  const mean = s.reduce((a, v) => a + v, 0) / n
  const median = n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2
  const counts = new Map<number, number>()
  for (const v of data) counts.set(v, (counts.get(v) ?? 0) + 1)
  let mode = data[0]!,
    best = 0
  for (const v of data) {
    const c = counts.get(v) ?? 0
    if (c > best) {
      best = c
      mode = v
    } // strictly greater → first of a tie wins
  }
  return { mean, median, mode, lo: s[0]!, hi: s[n - 1]!, range: s[n - 1]! - s[0]! }
}

/** Axis lo/hi: authored min/max (or data±1), always widened to contain data. */
function axisOf(p: StatPlotP): { lo: number; hi: number } {
  const d = p.data
  const dmin = d.length ? Math.min(...d) : 0
  const dmax = d.length ? Math.max(...d) : 10
  let lo = p.min ?? Math.floor(dmin) - 1
  let hi = p.max ?? Math.ceil(dmax) + 1
  lo = Math.min(lo, Math.floor(dmin))
  hi = Math.max(hi, Math.ceil(dmax))
  if (hi <= lo) hi = lo + 1
  return { lo, hi }
}

const verbs: Manipulative<StatPlotP>['verbs'] = {
  addData(p, args): VerbClip<StatPlotP> {
    const v = num(args?.v ?? args)
    return tween(p, { ...p, data: [...p.data, v].slice(0, 60) }, 0.6, 'easeOutBounce')
  },
  removeData(p, args): VerbClip<StatPlotP> {
    const v = num(args?.v ?? args)
    const i = p.data.lastIndexOf(v) // pop the top dot of that column
    const data = i >= 0 ? [...p.data.slice(0, i), ...p.data.slice(i + 1)] : p.data
    return tween(p, { ...p, data }, 0.4, 'easeInCubic')
  },
  showMean(p): VerbClip<StatPlotP> {
    return tween(p, { ...p, show: { ...p.show, mean: true } }, 0.45, 'easeOutCubic')
  },
  showMedian(p): VerbClip<StatPlotP> {
    return tween(p, { ...p, show: { ...p.show, median: true } }, 0.45, 'easeOutCubic')
  },
  showMode(p): VerbClip<StatPlotP> {
    return tween(p, { ...p, show: { ...p.show, mode: true } }, 0.45, 'easeOutCubic')
  },
  showRange(p): VerbClip<StatPlotP> {
    return tween(p, { ...p, show: { ...p.show, range: true } }, 0.45, 'easeOutCubic')
  },
  setData(p, args): VerbClip<StatPlotP> {
    const arr = Array.isArray(args?.data) ? args.data : Array.isArray(args) ? args : p.data
    return tween(p, { ...p, data: arr.map((v: unknown) => num(v)).slice(0, 60) }, 0.7, 'easeOutCubic')
  },
  answer(p, args): VerbClip<StatPlotP> {
    return tween(p, { ...p, answer: num(args?.v ?? args) }, 0.3, 'easeOutCubic')
  },
}

/** value → count, insertion order preserved by Map. */
function columnsOf(data: number[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const v of data) m.set(v, (m.get(v) ?? 0) + 1)
  return m
}

function render(_params: StatPlotP, state: ManipState<StatPlotP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const portrait = box.h > box.w
  const fs = Math.min(box.w, box.h) * 0.045
  const baseY = box.h * (portrait ? 0.6 : 0.68)
  const padX = box.w * 0.08 // keep in sync with statplot onTap in interactions.ts

  // axis glides too when the data change stretches it
  const axF = axisOf(seg.from),
    axT = axisOf(seg.to)
  const lo = lerp(axF.lo, axT.lo, seg.p),
    hi = lerp(axF.hi, axT.hi, seg.p)
  const X = (v: number) => mapRange(v, lo, hi, padX, box.w - padX)
  const clampX = (x: number) => Math.max(box.w * 0.1, Math.min(box.w * 0.9, x))

  // ---- axis + ticks
  prims.push({
    k: 'line',
    x1: padX * 0.6,
    y1: baseY,
    x2: box.w - padX * 0.6,
    y2: baseY,
    color: TOK.ink,
    weight: 'md',
    z: 2,
  })
  const step = Math.max(1, Math.ceil((axT.hi - axT.lo) / 12))
  for (let v = axT.lo; v <= axT.hi; v += step) {
    prims.push({
      k: 'line',
      x1: X(v),
      y1: baseY,
      x2: X(v),
      y2: baseY + box.h * 0.012,
      color: TOK.ink,
      weight: 'sm',
      z: 2,
    })
    prims.push({
      k: 'label',
      x: X(v),
      y: baseY + box.h * 0.04,
      text: fmt(v),
      color: TOK.soft,
      size: fs * 0.8,
      align: 'middle',
      baseline: 'middle',
      z: 2,
    })
  }

  // ---- dot columns (to-data), with drop-in / fade for the changed dots
  const colsTo = columnsOf(P.data),
    colsFrom = columnsOf(seg.from.data)
  const maxStack = Math.max(1, ...[...colsTo.values()], ...[...colsFrom.values()])
  const slotW = (box.w - 2 * padX) / Math.max(1, hi - lo)
  const r = Math.max(3, Math.min(slotW * 0.42, (baseY - box.h * 0.16) / (maxStack * 2.1), box.h * 0.035))
  const dotY = (j: number) => baseY - r - box.h * 0.012 - j * r * 2.02
  const dataChanged = seg.verb === 'addData' || seg.verb === 'setData'
  for (const [v, c] of colsTo) {
    const fc = colsFrom.get(v) ?? 0
    for (let j = 0; j < c; j++) {
      const isNew = dataChanged && j >= fc
      const yEnd = dotY(j)
      const y = isNew && seg.verb === 'addData' ? lerp(box.h * 0.06, yEnd, seg.p) : yEnd // the drop
      const op = isNew && seg.verb === 'setData' ? seg.p : 1
      prims.push({
        k: 'circle',
        cx: X(v),
        cy: y,
        r,
        fill: TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z: 4,
      })
    }
  }
  // dots leaving (removeData / setData) fade out in place
  if (seg.verb === 'removeData' || seg.verb === 'setData') {
    for (const [v, fc] of colsFrom) {
      const c = colsTo.get(v) ?? 0
      for (let j = c; j < fc; j++) {
        prims.push({
          k: 'circle',
          cx: X(v),
          cy: dotY(j),
          r,
          fill: TOK.accent2,
          color: TOK.ink,
          weight: 'sm',
          opacity: 1 - seg.p,
          z: 3,
        })
      }
    }
  }

  // ---- statistics: computed on BOTH endpoints, positions lerped → markers glide
  const sF = statsOf(seg.from.data),
    sT = statsOf(seg.to.data)
  const hasData = P.data.length > 0
  const showOp = (key: keyof StatShow, verb: string) =>
    P.show[key] ? (seg.verb === verb && !seg.from.show[key] ? seg.p : 1) : 0

  // mean — balance triangle under the axis + dashed vertical line
  const meanOp = showOp('mean', 'showMean')
  if (meanOp > 0.001 && hasData) {
    const mx = X(lerp(sF.mean, sT.mean, seg.p))
    const tw = r * 1.5,
      th = box.h * 0.035
    prims.push({
      k: 'line',
      x1: mx,
      y1: box.h * 0.1,
      x2: mx,
      y2: baseY,
      color: TOK.accent,
      weight: 'sm',
      dash: 6,
      opacity: 0.9 * meanOp,
      z: 5,
    })
    prims.push({
      k: 'path',
      d: `M ${mx} ${baseY + box.h * 0.012} L ${mx - tw} ${baseY + box.h * 0.012 + th} L ${mx + tw} ${baseY + box.h * 0.012 + th} Z`,
      fill: TOK.accent,
      color: TOK.ink,
      weight: 'sm',
      closed: true,
      opacity: meanOp,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: clampX(mx),
      y: baseY + box.h * 0.105,
      text: `${P.labels.mean} = ${fmt(lerp(sF.mean, sT.mean, seg.p))}`,
      color: TOK.accent,
      size: fs,
      align: 'middle',
      baseline: 'middle',
      opacity: meanOp,
      z: 6,
    })
  }

  // median — a flag planted at the middle value
  const medOp = showOp('median', 'showMedian')
  if (medOp > 0.001 && hasData) {
    const mx = X(lerp(sF.median, sT.median, seg.p))
    const top = box.h * 0.135
    prims.push({
      k: 'line',
      x1: mx,
      y1: top,
      x2: mx,
      y2: baseY,
      color: TOK.accent2,
      weight: 'sm',
      opacity: 0.9 * medOp,
      z: 5,
    })
    prims.push({
      k: 'path',
      d: `M ${mx} ${top} L ${mx + box.w * 0.045} ${top + box.h * 0.022} L ${mx} ${top + box.h * 0.044} Z`,
      fill: TOK.accent2,
      color: TOK.ink,
      weight: 'sm',
      closed: true,
      opacity: medOp,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: clampX(mx),
      y: baseY + box.h * 0.16,
      text: `${P.labels.median} = ${fmt(lerp(sF.median, sT.median, seg.p))}`,
      color: TOK.accent2,
      size: fs,
      align: 'middle',
      baseline: 'middle',
      opacity: medOp,
      z: 6,
    })
  }

  // mode — ring the most frequent dot column
  const modeOp = showOp('mode', 'showMode')
  if (modeOp > 0.001 && hasData) {
    const mv = lerp(sF.mode, sT.mode, seg.p)
    const cnt = colsTo.get(sT.mode) ?? 1
    const ringTop = dotY(cnt - 1) - r * 1.35
    prims.push({
      k: 'rect',
      x: X(mv) - r * 1.5,
      y: ringTop,
      w: r * 3,
      h: baseY - box.h * 0.006 - ringTop,
      rx: r * 1.5,
      fill: 'none',
      color: TOK.warn,
      weight: 'md',
      opacity: modeOp,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: clampX(X(mv)),
      y: ringTop - box.h * 0.035,
      text: `${P.labels.mode} = ${fmt(sT.mode)}`,
      color: TOK.warn,
      size: fs,
      align: 'middle',
      baseline: 'middle',
      opacity: modeOp,
      z: 6,
    })
  }

  // range — bracket spanning data min..max, width labelled
  const rngOp = showOp('range', 'showRange')
  if (rngOp > 0.001 && hasData) {
    const x1 = X(lerp(sF.lo, sT.lo, seg.p)),
      x2 = X(lerp(sF.hi, sT.hi, seg.p))
    const y = baseY + box.h * 0.21
    prims.push({
      k: 'line',
      x1,
      y1: y,
      x2,
      y2: y,
      color: TOK.good,
      weight: 'md',
      opacity: rngOp,
      z: 5,
    })
    prims.push({
      k: 'line',
      x1,
      y1: y - box.h * 0.02,
      x2: x1,
      y2: y,
      color: TOK.good,
      weight: 'md',
      opacity: rngOp,
      z: 5,
    })
    prims.push({
      k: 'line',
      x1: x2,
      y1: y - box.h * 0.02,
      x2,
      y2: y,
      color: TOK.good,
      weight: 'md',
      opacity: rngOp,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: clampX((x1 + x2) / 2),
      y: y + box.h * 0.045,
      text: `${P.labels.range} = ${fmt(lerp(sF.range, sT.range, seg.p))}`,
      color: TOK.good,
      size: fs,
      align: 'middle',
      baseline: 'middle',
      opacity: rngOp,
      z: 6,
    })
  }

  return { prims, view: box }
}

export const StatPlot: Manipulative<StatPlotP> = {
  kind: 'statplot',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
