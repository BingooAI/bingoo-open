// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * table.ts — data table (bảng số liệu) for Statistics. Rows × columns of values
 * with headers and optional totals; highlight a row/column while reading it.
 * verbs: highlightRow(i) · highlightCol(i) · showTotal · setData.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type TableRow = { label: string; values: number[] }
export type TableP = {
  columns: string[]
  rows: TableRow[]
  highlight: { kind: 'row' | 'col'; i: number } | null
  showTotal: boolean
  totalLabel: string
}

const DEFAULT: TableP = {
  columns: ['Mon', 'Wed', 'Fri'],
  rows: [
    { label: 'Apple', values: [3, 5, 2] },
    { label: 'Banana', values: [4, 4, 6] },
    { label: 'Orange', values: [2, 3, 3] },
  ],
  highlight: null,
  showTotal: false,
  totalLabel: 'Total',
}

function normalize(raw: unknown): TableP {
  const r = (raw ?? {}) as Partial<TableP>
  return {
    columns: [...(r.columns ?? DEFAULT.columns)],
    rows: (r.rows ?? DEFAULT.rows).map((x) => ({
      label: x.label ?? '',
      values: [...(x.values ?? [])],
    })),
    highlight: r.highlight ?? null,
    showTotal: !!r.showTotal,
    totalLabel: r.totalLabel ?? DEFAULT.totalLabel,
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<TableP>['verbs'] = {
  highlightRow(p, args): VerbClip<TableP> {
    return tween(
      p,
      { ...p, highlight: { kind: 'row', i: Math.floor(num(args?.i ?? args ?? 0)) } },
      0.35,
      'easeOutCubic',
    )
  },
  highlightCol(p, args): VerbClip<TableP> {
    return tween(
      p,
      { ...p, highlight: { kind: 'col', i: Math.floor(num(args?.i ?? args ?? 0)) } },
      0.35,
      'easeOutCubic',
    )
  },
  showTotal(p): VerbClip<TableP> {
    return tween(p, { ...p, showTotal: true }, 0.45, 'easeOutBack')
  },
  clear(p): VerbClip<TableP> {
    return tween(p, { ...p, highlight: null }, 0.3, 'easeOutCubic')
  },
}

function render(_params: TableP, state: ManipState<TableP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const nCols = 1 + P.columns.length + (P.showTotal ? 1 : 0) // label col + data + total
  const nRows = 1 + P.rows.length + (P.showTotal ? 1 : 0) // header + data + total row
  const pad = box.w * 0.05
  const gw = box.w - 2 * pad,
    gh = box.h * 0.86
  const cw = gw / nCols,
    ch = gh / nRows
  const ox = pad,
    oy = box.h * 0.06
  const fs = Math.min(ch * 0.42, cw * 0.34)

  const cellText = (c: number, r: number): string => {
    if (r === 0) return c === 0 ? '' : c <= P.columns.length ? P.columns[c - 1]! : P.totalLabel
    const isTotalRow = P.showTotal && r === P.rows.length + 1
    if (isTotalRow) {
      if (c === 0) return P.totalLabel
      if (c <= P.columns.length) return String(P.rows.reduce((s, row) => s + (row.values[c - 1] ?? 0), 0))
      return String(P.rows.reduce((s, row) => s + row.values.reduce((a, b) => a + b, 0), 0))
    }
    const row = P.rows[r - 1]!
    if (c === 0) return row.label
    if (c <= P.columns.length) return String(row.values[c - 1] ?? 0)
    return String(row.values.reduce((a, b) => a + b, 0)) // total col
  }

  // highlight band
  if (P.highlight) {
    if (P.highlight.kind === 'row') {
      const r = P.highlight.i + 1
      prims.push({
        k: 'rect',
        x: ox,
        y: oy + r * ch,
        w: gw,
        h: ch,
        fill: TOK.warn,
        opacity: 0.18,
        z: 0,
      })
    } else {
      const c = P.highlight.i + 1
      prims.push({
        k: 'rect',
        x: ox + c * cw,
        y: oy,
        w: cw,
        h: gh,
        fill: TOK.warn,
        opacity: 0.18,
        z: 0,
      })
    }
  }

  // grid + text
  for (let r = 0; r <= nRows; r++)
    prims.push({
      k: 'line',
      x1: ox,
      y1: oy + r * ch,
      x2: ox + gw,
      y2: oy + r * ch,
      color: TOK.faint,
      weight: 'sm',
      z: 1,
    })
  for (let c = 0; c <= nCols; c++)
    prims.push({
      k: 'line',
      x1: ox + c * cw,
      y1: oy,
      x2: ox + c * cw,
      y2: oy + gh,
      color: TOK.faint,
      weight: 'sm',
      z: 1,
    })
  // header + label emphasis
  prims.push({ k: 'rect', x: ox, y: oy, w: gw, h: ch, fill: TOK.accent2, opacity: 0.12, z: 0 })
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const txt = cellText(c, r)
      if (!txt) continue
      const header = r === 0 || c === 0 || (P.showTotal && (r === nRows - 1 || c === nCols - 1))
      prims.push({
        k: 'label',
        x: ox + c * cw + cw / 2,
        y: oy + r * ch + ch / 2,
        text: txt,
        color: header ? TOK.ink : TOK.ink,
        size: header ? fs * 1.0 : fs * 1.1,
        align: 'middle',
        baseline: 'middle',
        z: 3,
      })
    }
  }
  return { prims, view: box }
}

export const DataTable: Manipulative<TableP> = {
  kind: 'table',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
