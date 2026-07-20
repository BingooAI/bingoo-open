// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * functionmachine.ts — FunctionMachine (máy hàm số). A linear function
 * y = kx + b as an input → rule → output machine for upper primary / middle
 * school (ages 9–14): a number ball is fed into the left chute, the gears turn,
 * and it comes out the right chute transformed by the rule; every processed
 * pair accumulates in an I/O table so learners can induce the hidden rule.
 * The y of every history pair is ALWAYS recomputed from the rule (never
 * trusted from authoring) — the math is real by construction.
 * verbs: feed(x) · setRule(k,b) · revealRule · clear · guessRule(k,b) · answer(y).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK, fmt, lerp, clamp01 } from './util'

export type FMRule = { k: number; b: number }
export type FMPair = { x: number; y: number }
export type FunctionMachineP = {
  rule: FMRule
  ruleVisible: boolean
  history: FMPair[] // y always = k·x + b (enforced in normalize + feed/setRule)
  feeding: number | null // an x resting in the input chute (authored start state)
  guess: FMRule | null // learner's rule guess (gradable)
  answer: number | null // learner's output answer (gradable)
}

const MAX_HISTORY = 24
const DEFAULT: FunctionMachineP = {
  rule: { k: 2, b: 1 },
  ruleVisible: false,
  history: [
    { x: 1, y: 3 },
    { x: 2, y: 5 },
  ],
  feeding: null,
  guess: null,
  answer: null,
}

function num(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}
const apply = (r: FMRule, x: number): number => r.k * x + r.b

/** "×k + b" (or "×k − b"); b = 0 → just "×k". */
function ruleStr(r: FMRule): string {
  const bPart = r.b === 0 ? '' : ` ${r.b > 0 ? '+' : '−'} ${fmt(Math.abs(r.b))}`
  return `×${fmt(r.k)}${bPart}`
}

function normalize(raw: unknown): FunctionMachineP {
  const r = (raw ?? {}) as Partial<FunctionMachineP>
  const rl = (r.rule ?? {}) as Partial<FMRule>
  const rule = { k: num(rl.k, 2), b: num(rl.b, 1) }
  const hist = Array.isArray(r.history) ? r.history : DEFAULT.history
  // y is ALWAYS derived from the rule — authored y is never trusted.
  const history = hist.slice(-MAX_HISTORY).map((h) => {
    const x = num((h as Partial<FMPair> | null)?.x)
    return { x, y: apply(rule, x) }
  })
  const g = r.guess as Partial<FMRule> | null | undefined
  return {
    rule,
    ruleVisible: !!r.ruleVisible,
    history,
    feeding: r.feeding == null ? null : num(r.feeding),
    guess: g ? { k: num(g.k), b: num(g.b) } : null,
    answer: r.answer == null ? null : num(r.answer),
  }
}

const verbs: Manipulative<FunctionMachineP>['verbs'] = {
  feed(p, args): VerbClip<FunctionMachineP> {
    const x = num(args?.x ?? args, 0)
    const history = [...p.history, { x, y: apply(p.rule, x) }].slice(-MAX_HISTORY)
    return tween(p, { ...p, feeding: null, history }, 0.9, 'easeInOutCubic')
  },
  setRule(p, args): VerbClip<FunctionMachineP> {
    const rule = { k: num(args?.k, p.rule.k), b: num(args?.b, p.rule.b) }
    // history y recomputes — the table stays logically true under the new rule
    const history = p.history.map((h) => ({ x: h.x, y: apply(rule, h.x) }))
    return tween(p, { ...p, rule, history }, 0.55, 'easeOutCubic')
  },
  revealRule(p): VerbClip<FunctionMachineP> {
    return tween(p, { ...p, ruleVisible: true }, 0.4, 'easeOutBack')
  },
  clear(p): VerbClip<FunctionMachineP> {
    return tween(p, { ...p, history: [], feeding: null, answer: null }, 0.35, 'easeInCubic')
  },
  guessRule(p, args): VerbClip<FunctionMachineP> {
    return tween(p, { ...p, guess: { k: num(args?.k), b: num(args?.b) } }, 0.35, 'easeOutCubic')
  },
  answer(p, args): VerbClip<FunctionMachineP> {
    return tween(p, { ...p, answer: num(args?.y ?? args, 0) }, 0.35, 'easeOutCubic')
  },
}

/** Machine body box — keep in sync with the tap-machine hit-test in interactions.ts. */
function machineBox(box: { w: number; h: number }) {
  const portrait = box.h > box.w
  return portrait
    ? { mx: box.w * 0.5, my: box.h * 0.26, mw: box.w * 0.56, mh: box.h * 0.22, portrait }
    : { mx: box.w * 0.34, my: box.h * 0.46, mw: box.w * 0.3, mh: box.h * 0.4, portrait }
}

/** A little gear: rim + 4 spokes (rotated by `ang`) + hub. */
function gear(prims: Prim[], cx: number, cy: number, r: number, ang: number) {
  prims.push({ k: 'circle', cx, cy, r, fill: 'none', color: TOK.soft, weight: 'md', z: 5 })
  for (let i = 0; i < 4; i++) {
    const a = ang + (i * Math.PI) / 4
    prims.push({
      k: 'line',
      x1: cx - Math.cos(a) * r,
      y1: cy - Math.sin(a) * r,
      x2: cx + Math.cos(a) * r,
      y2: cy + Math.sin(a) * r,
      color: TOK.soft,
      weight: 'sm',
      cap: 'round',
      z: 5,
    })
  }
  prims.push({ k: 'circle', cx, cy, r: r * 0.22, fill: TOK.soft, z: 5 })
}

function render(
  _p: FunctionMachineP,
  state: ManipState<FunctionMachineP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const { mx, my, mw, mh, portrait } = machineBox(box)
  const ballR = Math.min(box.w, box.h) * 0.042
  const fs = Math.min(box.w, box.h) * 0.052
  const inX0 = box.w * 0.04
  const outX1 = portrait ? box.w * 0.96 : box.w * 0.63
  const chuteY = my
  const enterX = mx - mw / 2
  const exitX = mx + mw / 2
  const u = clamp01(seg.p)
  const feedingNow = seg.verb === 'feed' && P.history.length > seg.from.history.length

  // ---- chute tracks with direction arrows
  const track = (x1: number, x2: number) => {
    prims.push({
      k: 'rect',
      x: x1,
      y: chuteY - ballR * 1.15,
      w: Math.max(0, x2 - x1),
      h: ballR * 2.3,
      fill: TOK.faint,
      opacity: 0.35,
      rx: ballR * 0.6,
      z: 1,
    })
    const ax = (x1 + x2) / 2
    prims.push({
      k: 'path',
      d: `M ${ax - ballR * 0.5} ${chuteY - ballR * 0.55} L ${ax + ballR * 0.55} ${chuteY} L ${ax - ballR * 0.5} ${chuteY + ballR * 0.55}`,
      fill: 'none',
      color: TOK.soft,
      weight: 'sm',
      z: 2,
    })
  }
  track(inX0, enterX)
  track(exitX, outX1)

  // ---- machine body + gears
  prims.push({
    k: 'rect',
    x: enterX,
    y: my - mh / 2,
    w: mw,
    h: mh,
    fill: TOK.accent,
    opacity: 0.14,
    rx: mh * 0.12,
    z: 3,
  })
  prims.push({
    k: 'rect',
    x: enterX,
    y: my - mh / 2,
    w: mw,
    h: mh,
    fill: 'none',
    color: TOK.ink,
    weight: 'md',
    rx: mh * 0.12,
    z: 4,
  })
  const gearAng = feedingNow ? u * Math.PI * 3 : 0.5
  const gr = Math.min(mw, mh) * 0.14
  gear(prims, mx - mw * 0.26, my - mh * 0.28, gr, gearAng)
  gear(prims, mx + mw * 0.26, my - mh * 0.28, gr * 0.75, -gearAng * 1.33)

  // ---- rule label ("?" while hidden; cross-fades on reveal)
  const ruleY = my + mh * 0.12
  if (!P.ruleVisible) {
    prims.push({
      k: 'label',
      x: mx,
      y: ruleY,
      text: '?',
      color: TOK.warn,
      size: fs * 1.5,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    })
  } else if (seg.verb === 'revealRule' && !seg.from.ruleVisible) {
    prims.push({
      k: 'label',
      x: mx,
      y: ruleY,
      text: '?',
      color: TOK.warn,
      size: fs * 1.5,
      align: 'middle',
      baseline: 'middle',
      opacity: 1 - u,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: mx,
      y: ruleY,
      text: ruleStr(P.rule),
      color: TOK.accent,
      size: fs * 1.25 * (0.6 + 0.4 * u),
      align: 'middle',
      baseline: 'middle',
      opacity: u,
      z: 5,
    })
  } else {
    prims.push({
      k: 'label',
      x: mx,
      y: ruleY,
      text: ruleStr(P.rule),
      color: TOK.accent,
      size: fs * 1.25,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    })
  }

  // ---- learner guess tag under the machine (good-colored when it IS the rule)
  if (P.guess) {
    const ok = P.guess.k === P.rule.k && P.guess.b === P.rule.b
    const gop = seg.verb === 'guessRule' ? u : 1
    prims.push({
      k: 'label',
      x: mx,
      y: my + mh / 2 + fs * 0.9,
      text: `? ${ruleStr(P.guess)}`,
      color: ok ? TOK.good : TOK.soft,
      size: fs * 0.85,
      align: 'middle',
      baseline: 'middle',
      opacity: gop,
      z: 6,
    })
  }
  // ---- learner output answer near the output chute
  if (P.answer != null) {
    const aop = seg.verb === 'answer' ? u : 1
    prims.push({
      k: 'label',
      x: outX1,
      y: chuteY - ballR * 2.1,
      text: `= ${fmt(P.answer)}`,
      color: TOK.accent2,
      size: fs * 0.9,
      align: 'end',
      baseline: 'middle',
      opacity: aop,
      z: 6,
    })
  }

  // ---- the traveling number ball (label morphs x → y at the midpoint)
  const ballLabel = (bx: number, txt: string, op: number, out: boolean) => {
    prims.push({
      k: 'circle',
      cx: bx,
      cy: chuteY,
      r: ballR,
      fill: out ? TOK.good : TOK.accent2,
      color: TOK.ink,
      weight: 'sm',
      opacity: op,
      z: 6,
    })
    prims.push({
      k: 'label',
      x: bx,
      y: chuteY,
      text: txt,
      color: TOK.ink,
      size: ballR * Math.min(1.05, 2.1 / Math.max(2, txt.length)),
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 7,
    })
  }
  if (feedingNow) {
    const pair = P.history[P.history.length - 1]!
    let bx: number
    let op = 1
    if (u < 0.38) bx = lerp(inX0 + ballR * 1.2, enterX - ballR * 0.2, u / 0.38)
    else if (u < 0.62) {
      bx = lerp(enterX, exitX, (u - 0.38) / 0.24)
      op = u < 0.5 ? 1 - clamp01((u - 0.38) / 0.12) * 0.85 : 0.15 + clamp01((u - 0.5) / 0.12) * 0.85
    } else bx = lerp(exitX + ballR * 0.2, outX1 - ballR * 1.2, (u - 0.62) / 0.38)
    const out = u >= 0.5
    ballLabel(bx, fmt(out ? pair.y : pair.x), op, out)
  } else if (P.feeding != null) {
    ballLabel(inX0 + ballR * 1.2, fmt(P.feeding), 1, false)
  }

  // ---- I/O table (right in landscape, below in portrait)
  const tx0 = portrait ? box.w * 0.15 : box.w * 0.68
  const tx1 = portrait ? box.w * 0.85 : box.w * 0.96
  const ty0 = portrait ? box.h * 0.46 : box.h * 0.1
  const ty1 = portrait ? box.h * 0.92 : box.h * 0.88
  const headerH = Math.min(box.h * 0.08, (ty1 - ty0) * 0.22)
  const rowH = Math.min(box.h * 0.075, headerH)
  const maxRows = Math.max(1, Math.floor((ty1 - ty0 - headerH) / rowH))
  const clearing = seg.verb === 'clear' && seg.from.history.length > 0 && P.history.length === 0
  const rows = (clearing ? seg.from.history : P.history).slice(-maxRows)
  const fromRows = seg.verb === 'setRule' ? seg.from.history.slice(-maxRows) : null
  const tw = tx1 - tx0
  const midX = tx0 + tw / 2
  const frameH = headerH + Math.max(1, rows.length) * rowH

  prims.push({
    k: 'rect',
    x: tx0,
    y: ty0,
    w: tw,
    h: frameH,
    fill: 'none',
    color: TOK.faint,
    weight: 'sm',
    rx: 6,
    z: 2,
  })
  prims.push({
    k: 'line',
    x1: midX,
    y1: ty0,
    x2: midX,
    y2: ty0 + frameH,
    color: TOK.faint,
    weight: 'sm',
    z: 2,
  })
  prims.push({
    k: 'line',
    x1: tx0,
    y1: ty0 + headerH,
    x2: tx1,
    y2: ty0 + headerH,
    color: TOK.ink,
    weight: 'sm',
    z: 2,
  })
  prims.push({
    k: 'label',
    x: tx0 + tw * 0.25,
    y: ty0 + headerH / 2,
    text: 'x',
    color: TOK.accent2,
    size: fs,
    align: 'middle',
    baseline: 'middle',
    z: 3,
  })
  prims.push({
    k: 'label',
    x: tx0 + tw * 0.75,
    y: ty0 + headerH / 2,
    text: 'y',
    color: TOK.good,
    size: fs,
    align: 'middle',
    baseline: 'middle',
    z: 3,
  })

  // rule-change flash over the y column while outputs recompute
  if (seg.verb === 'setRule' && u < 1 && rows.length > 0) {
    prims.push({
      k: 'rect',
      x: midX,
      y: ty0 + headerH,
      w: tw / 2,
      h: rows.length * rowH,
      fill: TOK.warn,
      opacity: Math.sin(Math.PI * u) * 0.25,
      z: 2,
    })
  }

  rows.forEach((row, i) => {
    const cy = ty0 + headerH + i * rowH + rowH / 2
    let op = clearing ? 1 - u : 1
    if (feedingNow && i === rows.length - 1) op = clamp01((u - 0.85) / 0.15) // new row lands as the ball arrives
    let yText = fmt(row.y)
    if (fromRows && fromRows.length === rows.length) yText = fmt(lerp(fromRows[i]!.y, row.y, u)) // rows morph to the new rule
    prims.push({
      k: 'label',
      x: tx0 + tw * 0.25,
      y: cy,
      text: fmt(row.x),
      color: TOK.ink,
      size: fs * 0.9,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 3,
    })
    prims.push({
      k: 'label',
      x: tx0 + tw * 0.75,
      y: cy,
      text: yText,
      color: TOK.ink,
      size: fs * 0.9,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 3,
    })
  })

  return { prims, view: box }
}

export const FunctionMachine: Manipulative<FunctionMachineP> = {
  kind: 'functionmachine',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
