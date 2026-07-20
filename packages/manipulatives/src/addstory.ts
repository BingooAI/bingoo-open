// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * addstory.ts — AdditionStory (bài toán có lời văn trực quan: gộp vào / bớt
 * đi). A scene: `a` icons (birds / fish / apples / dots) settled on a branch;
 * for "+" the `b` group flies IN from the right edge along an arc, for "−"
 * they fly OUT. The number sentence builds progressively underneath — "a",
 * then "+ b" during the action, and "= c" only after `showResult`, with c
 * always COMPUTED (a+b or a−b), never authored. Departed icons stay as faint
 * ghosts so the child sees what left. Ages 4–7.
 * verbs: setStory(a,b,op) · act · showResult · answer(n) · reset.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, lerp, TOK } from './util'

export type AddStoryIcon = 'bird' | 'fish' | 'apple' | 'dot' | (string & {})
export type AddStoryP = {
  a: number
  b: number
  op: '+' | '-'
  icon: AddStoryIcon
  phase: 'start' | 'acting' | 'done'
  /** learner's answer (set via the `answer` verb); graded against a±b */
  answer: number | null
  /** media library: image per icon (URL/data-URI). Overrides the line-art. */
  assets?: Partial<Record<string, string>>
  /** treat `assets` values as built-in SVG-asset ids rather than URLs. */
  assetMode?: boolean
}

const DEFAULT: AddStoryP = { a: 3, b: 2, op: '+', icon: 'bird', phase: 'done', answer: null }

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)))
}

function normalize(raw: unknown): AddStoryP {
  const r = (raw ?? {}) as Partial<AddStoryP>
  const op = r.op === '-' ? '-' : '+'
  const a = clampInt(num(r.a ?? 3), 0, 10)
  let b = clampInt(num(r.b ?? 2), 0, 10)
  if (op === '-') b = Math.min(b, a) // never a negative story
  return {
    a,
    b,
    op,
    icon: (typeof r.icon === 'string' && r.icon) || 'bird',
    phase: r.phase === 'acting' || r.phase === 'done' ? r.phase : 'start',
    answer: r.answer == null ? null : Math.floor(num(r.answer)),
    assets: r.assets,
    assetMode: !!r.assetMode,
  }
}

const verbs: Manipulative<AddStoryP>['verbs'] = {
  setStory(p, args): VerbClip<AddStoryP> {
    const op = args?.op === '-' ? '-' : args?.op === '+' ? '+' : p.op
    const a = clampInt(num(args?.a ?? p.a), 0, 10)
    let b = clampInt(num(args?.b ?? p.b), 0, 10)
    if (op === '-') b = Math.min(b, a)
    return tween(p, { ...p, a, b, op, phase: 'start', answer: null }, 0.4, 'easeOutCubic')
  },
  /** the join/leave animation: the b group flies in (+) or away (−) */
  act(p): VerbClip<AddStoryP> {
    return tween({ ...p, phase: 'start' }, { ...p, phase: 'acting' }, 0.9, 'easeOutCubic')
  },
  /** reveal the computed result: "= c" pops + a brief good underline */
  showResult(p): VerbClip<AddStoryP> {
    return tween(
      { ...p, phase: p.phase === 'start' ? 'acting' : p.phase },
      { ...p, phase: 'done' },
      0.55,
      'easeOutBack',
    )
  },
  /** the learner's answer (gradable — checked against the computed a±b) */
  answer(p, args): VerbClip<AddStoryP> {
    const n = Math.floor(num(args?.n ?? (typeof args === 'number' ? args : 0)))
    return tween(p, { ...p, answer: n }, 0.3, 'easeOutCubic')
  },
  reset(p): VerbClip<AddStoryP> {
    return tween(p, { ...p, phase: 'start', answer: null }, 0.35, 'easeInCubic')
  },
}

/* ---------------------------------------------------------------- icons */

function icon(prims: Prim[], kind: string, cx: number, cy: number, r: number, op: number) {
  if (op <= 0.01) return
  switch (kind) {
    case 'bird':
      prims.push({
        k: 'circle',
        cx,
        cy,
        r: r * 0.78,
        fill: TOK.accent,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z: 3,
      })
      prims.push({
        k: 'path',
        d: `M ${cx + r * 0.7} ${cy - r * 0.1} L ${cx + r * 1.05} ${cy} L ${cx + r * 0.7} ${cy + r * 0.15} Z`,
        fill: TOK.warn,
        color: TOK.ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z: 4,
      })
      prims.push({
        k: 'circle',
        cx: cx + r * 0.32,
        cy: cy - r * 0.25,
        r: r * 0.09,
        fill: TOK.ink,
        opacity: op,
        z: 4,
      })
      prims.push({
        k: 'path',
        d: `M ${cx - r * 0.55} ${cy} Q ${cx - r * 0.15} ${cy - r * 0.55} ${cx + r * 0.25} ${cy - r * 0.05}`,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z: 4,
      })
      break
    case 'fish':
      prims.push({
        k: 'path',
        d: `M ${cx - r * 0.85} ${cy} Q ${cx - r * 0.1} ${cy - r * 0.7} ${cx + r * 0.75} ${cy} Q ${cx - r * 0.1} ${cy + r * 0.7} ${cx - r * 0.85} ${cy} Z`,
        fill: TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z: 3,
      })
      prims.push({
        k: 'path',
        d: `M ${cx - r * 0.8} ${cy} L ${cx - r * 1.15} ${cy - r * 0.45} L ${cx - r * 1.15} ${cy + r * 0.45} Z`,
        fill: TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z: 3,
      })
      prims.push({
        k: 'circle',
        cx: cx + r * 0.35,
        cy: cy - r * 0.12,
        r: r * 0.09,
        fill: TOK.ink,
        opacity: op,
        z: 4,
      })
      break
    case 'apple':
      prims.push({
        k: 'circle',
        cx,
        cy: cy + r * 0.08,
        r: r * 0.8,
        fill: TOK.accent,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z: 3,
      })
      prims.push({
        k: 'line',
        x1: cx,
        y1: cy - r * 0.6,
        x2: cx + r * 0.12,
        y2: cy - r * 0.95,
        color: TOK.ink,
        weight: 'sm',
        cap: 'round',
        opacity: op,
        z: 4,
      })
      break
    case 'dot':
    default:
      prims.push({
        k: 'circle',
        cx,
        cy,
        r: r * 0.75,
        fill: TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z: 3,
      })
      break
  }
}

function render(_params: AddStoryP, state: ManipState<AddStoryP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const q = clamp01(seg.p)
  const acting = seg.verb === 'act'

  const total = P.op === '+' ? P.a + P.b : P.a
  const perRow = Math.max(1, Math.min(total, 10))
  const rows = Math.max(1, Math.ceil(Math.max(total, 1) / perRow))
  const sw = (box.w * 0.66) / perRow
  const rowH = Math.min(box.h * 0.15, (box.h * 0.34) / rows)
  const r = Math.min(sw * 0.36, box.h * 0.055, box.w * 0.05)
  const slot = (k: number) => ({
    x: box.w * 0.08 + ((k % perRow) + 0.5) * sw,
    y: box.h * 0.38 + Math.floor(k / perRow) * rowH,
  })

  // scene frame
  prims.push({
    k: 'rect',
    x: box.w * 0.03,
    y: box.h * 0.04,
    w: box.w * 0.94,
    h: box.h * 0.64,
    fill: 'none',
    color: TOK.faint,
    weight: 'sm',
    rx: 14,
    z: 1,
  })

  // branch/ground line under each occupied row
  for (let rI = 0; rI < rows; rI++) {
    const inRow = Math.min(perRow, total - rI * perRow)
    if (inRow <= 0) break
    const y = box.h * 0.38 + rI * rowH + r * 1.15
    prims.push({
      k: 'line',
      x1: box.w * 0.07,
      y1: y,
      x2: box.w * 0.08 + inRow * sw + box.w * 0.01,
      y2: y,
      color: TOK.soft,
      weight: 'md',
      cap: 'round',
      z: 2,
    })
  }

  const src = P.assets?.[P.icon]
  const drawIcon = (cx: number, cy: number, rr: number, op: number) => {
    if (op <= 0.01) return
    if (src)
      prims.push({
        k: 'image',
        x: cx - rr,
        y: cy - rr,
        w: rr * 2,
        h: rr * 2,
        ...(P.assetMode ? { asset: src } : { src }),
        opacity: op,
        z: 3,
      })
    else icon(prims, P.icon, cx, cy, rr, op)
  }
  // per-item staggered progress during `act`
  const stag = (k: number, count: number) => clamp01(q * (1 + 0.12 * Math.max(0, count - 1)) - 0.12 * k)

  if (P.op === '+') {
    for (let k = 0; k < P.a; k++) {
      const s = slot(k)
      drawIcon(s.x, s.y, r, 1)
    }
    for (let k = 0; k < P.b; k++) {
      const s = slot(P.a + k)
      if (acting) {
        const pk = stag(k, P.b)
        const ex = box.w * 0.96,
          ey = box.h * 0.12
        const x = lerp(ex, s.x, pk)
        const y = lerp(ey, s.y, pk) - Math.sin(Math.PI * pk) * box.h * 0.1 // arc
        drawIcon(x, y, r, Math.min(1, 0.25 + pk * 1.5))
      } else if (P.phase !== 'start') {
        drawIcon(s.x, s.y, r, 1)
      }
    }
  } else {
    const bEff = Math.min(P.b, P.a)
    const stay = P.a - bEff
    for (let k = 0; k < stay; k++) {
      const s = slot(k)
      drawIcon(s.x, s.y, r, 1)
    }
    for (let k = 0; k < bEff; k++) {
      const s = slot(stay + k)
      if (acting) {
        const pk = stag(k, bEff)
        const x = lerp(s.x, box.w * 0.95, pk)
        const y = lerp(s.y, box.h * 0.11, pk) - Math.sin(Math.PI * pk) * box.h * 0.08 // arc away
        drawIcon(x, y, r, 1 - 0.85 * pk)
      } else if (P.phase === 'start') {
        drawIcon(s.x, s.y, r, 1)
      } else {
        drawIcon(s.x, s.y, r, 0.15) // ghost of what left — shows the WHY
      }
    }
  }

  // --- number sentence, built progressively (c always computed)
  const c = P.op === '+' ? P.a + P.b : P.a - P.b
  const ny = box.h * 0.82
  const ns = Math.min(box.h * 0.1, box.w * 0.1)
  prims.push({
    k: 'label',
    x: box.w * 0.3,
    y: ny,
    text: String(P.a),
    color: TOK.ink,
    size: ns,
    align: 'middle',
    baseline: 'middle',
    z: 6,
  })
  const partOp = acting ? q : P.phase === 'start' ? 0 : 1
  if (partOp > 0.01) {
    prims.push({
      k: 'label',
      x: box.w * 0.46,
      y: ny,
      text: `${P.op === '+' ? '+' : '−'} ${P.b}`,
      color: TOK.ink,
      size: ns,
      align: 'middle',
      baseline: 'middle',
      opacity: Math.min(1, partOp),
      z: 6,
    })
  }
  const showing = seg.verb === 'showResult'
  if (P.phase === 'done') {
    const sc = showing ? Math.max(0.05, seg.p) : 1 // easeOutBack pop
    prims.push({
      k: 'label',
      x: box.w * 0.64,
      y: ny,
      text: `= ${c}`,
      color: TOK.good,
      size: Math.max(1, ns * sc),
      align: 'middle',
      baseline: 'middle',
      opacity: showing ? clamp01(seg.p * 1.6) : 1,
      z: 6,
    })
    // brief good-colored underline beneath the whole group
    const uop = showing ? Math.sin(Math.PI * q) : 0
    if (uop > 0.01) {
      const uy = box.h * 0.38 + (rows - 1) * rowH + r * 1.6
      prims.push({
        k: 'line',
        x1: box.w * 0.07,
        y1: uy,
        x2: box.w * 0.76,
        y2: uy,
        color: TOK.good,
        weight: 'lg',
        cap: 'round',
        opacity: uop,
        z: 5,
      })
    }
  } else if (P.answer != null) {
    // learner's own answer, shown neutrally until the reveal
    prims.push({
      k: 'label',
      x: box.w * 0.64,
      y: ny,
      text: `= ${P.answer}`,
      color: TOK.soft,
      size: ns,
      align: 'middle',
      baseline: 'middle',
      z: 6,
    })
  }

  return { prims, view: box }
}

export const AdditionStory: Manipulative<AddStoryP> = {
  kind: 'addstory',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
