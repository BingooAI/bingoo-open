// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * ratiotable.ts — RatioTable (bảng tỉ số / quy tắc tam suất). Ratio &
 * proportion on a double-row table for upper primary / middle school (9–13):
 * row A and row B stay in the fixed ratio baseA : baseB, every column is the
 * base pair × a multiplier m (every cell COMPUTED from base × m), and ×m
 * arrow arcs above/below link column 1 to column m — the "scale both
 * quantities by the same factor" idea behind proportional reasoning. An
 * optional unit-rate badge shows baseB/baseA per one unit of A.
 * verbs: addColumn(m) · highlight(m) · showUnitRate · setBase(a,b) · fillCell(m,row,v).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK, fmt, lerp, clamp01 } from './util'

export type RatioFill = { m: number; row: 'A' | 'B'; v: number }
export type RatioTableP = {
  baseA: number
  baseB: number
  unitA: string
  unitB: string
  columns: number[] // multipliers currently shown (1 always present)
  highlight: number | null // a multiplier
  showUnitRate: boolean
  filled: RatioFill | null // learner's cell answer (gradable)
}

const MAX_COLS = 8
const DEFAULT: RatioTableP = {
  baseA: 2,
  baseB: 3,
  unitA: 'cups',
  unitB: 'lemons',
  columns: [1],
  highlight: null,
  showUnitRate: false,
  filled: null,
}

function num(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}
function pos(v: unknown, d: number): number {
  const n = num(v, d)
  return n > 0 ? n : d
}

function normalize(raw: unknown): RatioTableP {
  const r = (raw ?? {}) as Partial<RatioTableP>
  const rawCols = Array.isArray(r.columns) ? r.columns : DEFAULT.columns
  const cols: number[] = []
  for (const c of rawCols) {
    const m = num(c)
    if (m > 0 && !cols.includes(m) && cols.length < MAX_COLS) cols.push(m)
  }
  if (!cols.includes(1)) cols.unshift(1)
  const f = r.filled as Partial<RatioFill> | null | undefined
  return {
    baseA: pos(r.baseA, 2),
    baseB: pos(r.baseB, 3),
    unitA: typeof r.unitA === 'string' && r.unitA ? r.unitA : 'cups',
    unitB: typeof r.unitB === 'string' && r.unitB ? r.unitB : 'lemons',
    columns: cols.slice(0, MAX_COLS),
    highlight: r.highlight == null ? null : num(r.highlight),
    showUnitRate: !!r.showUnitRate,
    filled: f && (f.row === 'A' || f.row === 'B') ? { m: num(f.m, 1), row: f.row, v: num(f.v) } : null,
  }
}

const verbs: Manipulative<RatioTableP>['verbs'] = {
  addColumn(p, args): VerbClip<RatioTableP> {
    let m = num(args?.m ?? args, 0)
    if (!(m > 0)) m = [2, 3, 4, 5, 10].find((c) => !p.columns.includes(c)) ?? Math.max(...p.columns) + 1
    if (p.columns.includes(m) || p.columns.length >= MAX_COLS) {
      return tween(p, { ...p, highlight: p.columns.includes(m) ? m : p.highlight }, 0.35, 'easeOutCubic')
    }
    return tween(p, { ...p, columns: [...p.columns, m], highlight: m }, 0.65, 'easeOutCubic')
  },
  highlight(p, args): VerbClip<RatioTableP> {
    const m = num(args?.m ?? args, 1)
    return tween(p, { ...p, highlight: p.columns.includes(m) ? m : null }, 0.3, 'easeOutCubic')
  },
  showUnitRate(p): VerbClip<RatioTableP> {
    return tween(p, { ...p, showUnitRate: true }, 0.45, 'easeOutBack')
  },
  setBase(p, args): VerbClip<RatioTableP> {
    return tween(p, { ...p, baseA: pos(args?.a, p.baseA), baseB: pos(args?.b, p.baseB) }, 0.5, 'easeOutCubic')
  },
  fillCell(p, args): VerbClip<RatioTableP> {
    const row: 'A' | 'B' = args?.row === 'B' ? 'B' : 'A'
    return tween(p, { ...p, filled: { m: num(args?.m, 1), row, v: num(args?.v, 0) } }, 0.35, 'easeOutBack')
  },
}

/** Polyline along a quadratic bezier up to fraction uEnd, plus end tangent (for the arrowhead). */
function quadArc(x1: number, y1: number, qx: number, qy: number, x2: number, y2: number, uEnd: number) {
  const N = 20
  const ue = clamp01(uEnd)
  let d = ''
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * ue
    const a = 1 - s
    const x = a * a * x1 + 2 * a * s * qx + s * s * x2
    const y = a * a * y1 + 2 * a * s * qy + s * s * y2
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `
  }
  const a = 1 - ue
  return {
    d,
    ex: a * a * x1 + 2 * a * ue * qx + ue * ue * x2,
    ey: a * a * y1 + 2 * a * ue * qy + ue * ue * y2,
    dx: 2 * a * (qx - x1) + 2 * ue * (x2 - qx),
    dy: 2 * a * (qy - y1) + 2 * ue * (y2 - qy),
  }
}

function render(_p: RatioTableP, state: ManipState<RatioTableP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const u = clamp01(seg.p)
  const portrait = box.h > box.w
  const n = P.columns.length
  const adding = seg.verb === 'addColumn' && n > seg.from.columns.length
  const rebasing = seg.verb === 'setBase'
  const fs = Math.min(box.w, box.h) * 0.05
  const rate = P.baseB / P.baseA

  // every cell is COMPUTED: base × multiplier (morphs during setBase)
  const dispA = (m: number) => (rebasing ? lerp(seg.from.baseA * m, P.baseA * m, u) : P.baseA * m)
  const dispB = (m: number) => (rebasing ? lerp(seg.from.baseB * m, P.baseB * m, u) : P.baseB * m)
  const fillHere = (row: 'A' | 'B', m: number) => P.filled != null && P.filled.row === row && P.filled.m === m

  const arrow = (ex: number, ey: number, dx: number, dy: number, size: number, op: number) => {
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len,
      uy = dy / len
    const nx = -uy,
      ny = ux
    prims.push({
      k: 'path',
      d: `M ${ex} ${ey} L ${ex - ux * size + nx * size * 0.5} ${ey - uy * size + ny * size * 0.5} L ${ex - ux * size - nx * size * 0.5} ${ey - uy * size - ny * size * 0.5} Z`,
      fill: TOK.accent,
      closed: true,
      opacity: op,
      z: 4,
    })
  }
  const drawArc = (
    x1: number,
    y1: number,
    qx: number,
    qy: number,
    x2: number,
    y2: number,
    du: number,
    op: number,
  ) => {
    const q = quadArc(x1, y1, qx, qy, x2, y2, du)
    prims.push({
      k: 'path',
      d: q.d,
      fill: 'none',
      color: TOK.accent,
      weight: 'md',
      opacity: op,
      z: 4,
    })
    const aop = clamp01((du - 0.65) / 0.35) * op
    if (aop > 0) arrow(q.ex, q.ey, q.dx, q.dy, fs * 0.55, aop)
  }
  // learner's filled answer replaces the computed cell text (ring marks it)
  const cell = (
    cx: number,
    cy: number,
    w: number,
    h: number,
    row: 'A' | 'B',
    m: number,
    truth: number,
    op: number,
    size: number,
  ) => {
    prims.push({
      k: 'rect',
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      fill: 'none',
      color: TOK.faint,
      weight: 'sm',
      opacity: op,
      z: 2,
    })
    if (fillHere(row, m)) {
      const fop = (seg.verb === 'fillCell' ? u : 1) * op
      prims.push({
        k: 'rect',
        x: cx - w / 2 + 2,
        y: cy - h / 2 + 2,
        w: w - 4,
        h: h - 4,
        fill: 'none',
        color: TOK.accent,
        weight: 'md',
        rx: 4,
        opacity: fop,
        z: 4,
      })
      prims.push({
        k: 'label',
        x: cx,
        y: cy,
        text: fmt(P.filled!.v),
        color: TOK.accent,
        size,
        align: 'middle',
        baseline: 'middle',
        opacity: op,
        z: 3,
      })
    } else {
      prims.push({
        k: 'label',
        x: cx,
        y: cy,
        text: fmt(truth),
        color: TOK.ink,
        size,
        align: 'middle',
        baseline: 'middle',
        opacity: op,
        z: 3,
      })
    }
  }
  const badge = (bx: number, by: number, op: number) => {
    const txt = `1 ${P.unitA} → ${fmt(rate)} ${P.unitB}`
    const bfs = fs * 0.9
    const bw = txt.length * bfs * 0.55 + bfs * 1.6
    prims.push({
      k: 'rect',
      x: bx - bw / 2,
      y: by - bfs * 0.85,
      w: bw,
      h: bfs * 1.7,
      fill: TOK.good,
      opacity: 0.15 * op,
      rx: bfs * 0.85,
      z: 5,
    })
    prims.push({
      k: 'rect',
      x: bx - bw / 2,
      y: by - bfs * 0.85,
      w: bw,
      h: bfs * 1.7,
      fill: 'none',
      color: TOK.good,
      weight: 'sm',
      rx: bfs * 0.85,
      opacity: op,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: bx,
      y: by,
      text: txt,
      color: TOK.good,
      size: bfs,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 6,
    })
  }
  const i1 = P.columns.indexOf(1)

  if (!portrait) {
    /* ---------- landscape: two rows × n columns ---------- */
    // keep in sync with interactions.ts onTap (column hit-test)
    const x0 = box.w * 0.05,
      lw = box.w * 0.15,
      tw = box.w * 0.9
    const nEff = adding ? lerp(seg.from.columns.length, n, u) : n
    const colW = (tw - lw) / Math.max(nEff, 2)
    const rowH = box.h * 0.135
    const yA = box.h * 0.4,
      yB = yA + rowH
    const colCX = (i: number) => {
      const cx = x0 + lw + (i + 0.5) * colW
      return adding && i === n - 1 ? lerp(box.w + colW, cx, u) : cx // new column slides in from the right
    }
    const colOp = (i: number) => (adding && i === n - 1 ? u : 1)
    const unitFs = Math.min(rowH * 0.36, (lw * 1.7) / Math.max(3, P.unitA.length, P.unitB.length))
    const cellFs = Math.min(rowH * 0.42, colW * 0.42)

    // row-label cells
    prims.push({ k: 'rect', x: x0, y: yA, w: lw, h: rowH, fill: TOK.accent, opacity: 0.1, z: 1 })
    prims.push({ k: 'rect', x: x0, y: yB, w: lw, h: rowH, fill: TOK.accent2, opacity: 0.1, z: 1 })
    prims.push({
      k: 'rect',
      x: x0,
      y: yA,
      w: lw,
      h: rowH * 2,
      fill: 'none',
      color: TOK.faint,
      weight: 'sm',
      z: 2,
    })
    prims.push({
      k: 'label',
      x: x0 + lw / 2,
      y: yA + rowH / 2,
      text: P.unitA,
      color: TOK.ink,
      size: unitFs,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    })
    prims.push({
      k: 'label',
      x: x0 + lw / 2,
      y: yB + rowH / 2,
      text: P.unitB,
      color: TOK.ink,
      size: unitFs,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    })

    // base-change flash over the data area
    if (rebasing && u < 1)
      prims.push({
        k: 'rect',
        x: x0 + lw,
        y: yA,
        w: tw - lw,
        h: rowH * 2,
        fill: TOK.warn,
        opacity: Math.sin(Math.PI * u) * 0.2,
        z: 1,
      })

    for (let i = 0; i < n; i++) {
      const m = P.columns[i]!
      const cx = colCX(i),
        op = colOp(i)
      if (P.highlight === m)
        prims.push({
          k: 'rect',
          x: cx - colW / 2,
          y: yA,
          w: colW,
          h: rowH * 2,
          fill: TOK.warn,
          opacity: 0.18 * op,
          z: 0,
        })
      cell(cx, yA + rowH / 2, colW, rowH, 'A', m, dispA(m), op, cellFs)
      cell(cx, yB + rowH / 2, colW, rowH, 'B', m, dispB(m), op, cellFs)
    }

    // ×m arcs: above for row A, below for row B (draw on for the new column)
    let rank = 0
    const pad = rowH * 0.12
    for (let i = 0; i < n; i++) {
      const m = P.columns[i]!
      if (m === 1) continue
      const isNew = adding && i === n - 1
      const du = isNew ? u : 1
      const op = isNew ? u : 1
      const xs = colCX(i1),
        xe = colCX(i)
      const lift = Math.min(box.h * (0.09 + 0.05 * rank), box.h * 0.22)
      drawArc(xs, yA - pad, (xs + xe) / 2, yA - pad - 2 * lift, xe, yA - pad, du, op)
      prims.push({
        k: 'label',
        x: (xs + xe) / 2,
        y: yA - pad - lift - fs * 0.55,
        text: `×${fmt(m)}`,
        color: TOK.accent,
        size: fs,
        align: 'middle',
        baseline: 'middle',
        opacity: op,
        z: 5,
      })
      const yBase = yB + rowH + pad
      const liftB = Math.min(box.h * (0.09 + 0.05 * rank), box.h * 0.2)
      drawArc(xs, yBase, (xs + xe) / 2, yBase + 2 * liftB, xe, yBase, du, op)
      prims.push({
        k: 'label',
        x: (xs + xe) / 2,
        y: yBase + liftB + fs * 0.55,
        text: `×${fmt(m)}`,
        color: TOK.accent,
        size: fs,
        align: 'middle',
        baseline: 'middle',
        opacity: op,
        z: 5,
      })
      rank++
    }

    if (P.showUnitRate) badge(box.w / 2, box.h * 0.085, seg.verb === 'showUnitRate' ? u : 1)
  } else {
    /* ---------- portrait: columns become rows (×m | A | B) ---------- */
    // keep in sync with interactions.ts onTap (row hit-test)
    const y0 = box.h * 0.16
    const rowH = Math.min(box.h * 0.1, (box.h * 0.72) / Math.max(n, 2))
    const cxM = box.w * 0.16,
      cxA = box.w * 0.46,
      cxB = box.w * 0.76
    const cw = box.w * 0.26
    const unitFs = Math.min(rowH * 0.4, (cw * 1.5) / Math.max(3, P.unitA.length, P.unitB.length))
    const cellFs = Math.min(rowH * 0.42, cw * 0.4)
    const rowCY = (i: number) => y0 + i * rowH + rowH / 2

    prims.push({
      k: 'label',
      x: cxA,
      y: y0 - rowH * 0.5,
      text: P.unitA,
      color: TOK.ink,
      size: unitFs,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    })
    prims.push({
      k: 'label',
      x: cxB,
      y: y0 - rowH * 0.5,
      text: P.unitB,
      color: TOK.ink,
      size: unitFs,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    })
    if (rebasing && u < 1)
      prims.push({
        k: 'rect',
        x: cxA - cw / 2,
        y: y0,
        w: cxB + cw / 2 - (cxA - cw / 2),
        h: n * rowH,
        fill: TOK.warn,
        opacity: Math.sin(Math.PI * u) * 0.2,
        z: 1,
      })

    for (let i = 0; i < n; i++) {
      const m = P.columns[i]!
      const isNew = adding && i === n - 1
      const op = isNew ? u : 1
      const xoff = isNew ? (1 - u) * box.w * 0.35 : 0 // new row slides in from the right
      const cy = rowCY(i)
      if (P.highlight === m)
        prims.push({
          k: 'rect',
          x: box.w * 0.04,
          y: cy - rowH / 2,
          w: box.w * 0.92,
          h: rowH,
          fill: TOK.warn,
          opacity: 0.18 * op,
          z: 0,
        })
      prims.push({
        k: 'label',
        x: cxM + xoff,
        y: cy,
        text: `×${fmt(m)}`,
        color: TOK.soft,
        size: cellFs,
        align: 'middle',
        baseline: 'middle',
        opacity: op,
        z: 3,
      })
      cell(cxA + xoff, cy, cw, rowH, 'A', m, dispA(m), op, cellFs)
      cell(cxB + xoff, cy, cw, rowH, 'B', m, dispB(m), op, cellFs)
    }

    // ×m arcs on the left (row 1 → row m); B side omitted in portrait to stay in the box
    let rank = 0
    const bx = cxA - cw / 2 - box.w * 0.02
    for (let i = 0; i < n; i++) {
      const m = P.columns[i]!
      if (m === 1) continue
      const isNew = adding && i === n - 1
      const du = isNew ? u : 1
      const op = isNew ? u : 1
      const ys = rowCY(i1),
        ye = rowCY(i)
      const lift = Math.min(box.w * (0.06 + 0.03 * rank), box.w * 0.13)
      drawArc(bx, ys, bx - 2 * lift, (ys + ye) / 2, bx, ye, du, op)
      prims.push({
        k: 'label',
        x: Math.max(bx - lift, fs * 1.4),
        y: (ys + ye) / 2,
        text: `×${fmt(m)}`,
        color: TOK.accent,
        size: fs * 0.9,
        align: 'end',
        baseline: 'middle',
        opacity: op,
        z: 5,
      })
      rank++
    }

    if (P.showUnitRate) badge(box.w / 2, box.h * 0.94, seg.verb === 'showUnitRate' ? u : 1)
  }

  return { prims, view: box }
}

export const RatioTable: Manipulative<RatioTableP> = {
  kind: 'ratiotable',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
