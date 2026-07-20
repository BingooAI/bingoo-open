/**
 * hundredsquare.ts — 1..100 grid (Cambridge: counting, patterns, multiples).
 * verbs: highlightNumber(n) · highlightMultiples(k) · countBy(step) · coverRange(a,b).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, TOK } from './util'

export type HundredSquareP = {
  rows: number
  cols: number
  highlight: number[]
  multiples: number | null
  countStep: number | null
  cover: [number, number] | null
}

const DEFAULT: HundredSquareP = {
  rows: 10,
  cols: 10,
  highlight: [],
  multiples: null,
  countStep: null,
  cover: null,
}

function normalize(raw: unknown): HundredSquareP {
  const r = (raw ?? {}) as Partial<HundredSquareP>
  return {
    rows: Math.max(1, Math.floor(r.rows ?? 10)),
    cols: Math.max(1, Math.floor(r.cols ?? 10)),
    highlight: [...(r.highlight ?? [])],
    multiples: r.multiples ?? null,
    countStep: r.countStep ?? null,
    cover: r.cover ?? null,
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<HundredSquareP>['verbs'] = {
  highlightNumber(p, args): VerbClip<HundredSquareP> {
    const n = Math.floor(num(args?.n ?? args ?? 1))
    return tween(
      p,
      { ...p, highlight: p.highlight.includes(n) ? p.highlight : [...p.highlight, n] },
      0.4,
      'easeOutBack',
    )
  },
  highlightMultiples(p, args): VerbClip<HundredSquareP> {
    return tween(
      p,
      { ...p, multiples: Math.max(1, Math.floor(num(args?.k ?? args ?? 2))) },
      0.6,
      'easeOutCubic',
    )
  },
  countBy(p, args): VerbClip<HundredSquareP> {
    return tween(
      p,
      { ...p, countStep: Math.max(1, Math.floor(num(args?.step ?? args ?? 2))) },
      0.8,
      'easeInOutCubic',
    )
  },
  coverRange(p, args): VerbClip<HundredSquareP> {
    const a = Math.floor(num(args?.a ?? 1))
    const b = Math.floor(num(args?.b ?? 10))
    return tween(p, { ...p, cover: [a, b] }, 0.5, 'easeOutCubic')
  },
}

function render(
  _params: HundredSquareP,
  state: ManipState<HundredSquareP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const { rows, cols } = P
  const total = rows * cols
  const cell = Math.min((box.w * 0.92) / cols, (box.h * 0.86) / rows)
  const gw = cell * cols,
    gh = cell * rows
  const ox = (box.w - gw) / 2,
    oy = (box.h - gh) / 2
  const cellOf = (v: number) => {
    const r = Math.floor((v - 1) / cols)
    const c = (v - 1) % cols
    return { x: ox + c * cell, y: oy + r * cell }
  }
  const fontSize = cell * 0.42

  const countRevealed = P.countStep
    ? Math.floor(clamp01(seg.verb === 'countBy' ? seg.p : 1) * (total / P.countStep))
    : 0

  for (let v = 1; v <= total; v++) {
    const { x, y } = cellOf(v)
    const isMult = P.multiples ? v % P.multiples === 0 : false
    const isHi = P.highlight.includes(v)
    const isCount = P.countStep ? v % P.countStep === 0 : false
    const covered = P.cover ? v >= P.cover[0] && v <= P.cover[1] : false
    let fill: string = TOK.paper
    let op = 1
    if (covered) fill = TOK.faint
    else if (isHi) fill = TOK.warn
    else if (isCount) {
      fill = TOK.accent
      op = v / P.countStep! <= countRevealed ? 1 : 0.12
    } else if (isMult) {
      fill = TOK.accent2
      op = seg.verb === 'highlightMultiples' ? clamp01(seg.p * 1.2) : 1
    }
    prims.push({
      k: 'rect',
      x,
      y,
      w: cell,
      h: cell,
      fill,
      color: TOK.faint,
      weight: 'sm',
      opacity: op,
      z: 1,
    })
    prims.push({
      k: 'label',
      x: x + cell / 2,
      y: y + cell / 2,
      text: covered ? '' : String(v),
      color: isMult || isHi || isCount ? TOK.ink : TOK.soft,
      size: fontSize,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 2,
    })
  }
  return { prims, view: box }
}

export const HundredSquare: Manipulative<HundredSquareP> = {
  kind: 'hundredsquare',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
