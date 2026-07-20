// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * stresspattern.ts — WordStress: word stress & syllables (academic
 * pronunciation, IELTS speaking; teens–adult). Syllable boxes joined by dots;
 * the learner marks the stressed syllable (big accent dot glides above it),
 * metronome beat bars show the TRUE pattern, and a compare row (e.g.
 * PHOtograph → phoTOgraphy) draws a dashed arc showing the stress SHIFT.
 * Correctness is marked === stressed (real, code-verifiable).
 * verbs: mark(i) · showBeats · showCompare · reveal · setWord(word,…).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, lerp, TOK } from './util'

export type StressCompare = { word: string; syllables: string[]; stressed: number }
export type StressP = {
  word: string
  syllables: string[]
  /** the TRUE stressed syllable (the answer). */
  stressed: number
  /** learner/author's current mark. */
  marked: number | null
  /** classic stress-shift pair shown below when showCompare. */
  compare: StressCompare
  showCompare: boolean
  showBeats: boolean
}

const DEFAULT: StressP = {
  word: 'photograph',
  syllables: ['pho', 'to', 'graph'],
  stressed: 0,
  marked: null,
  compare: { word: 'photography', syllables: ['pho', 'to', 'gra', 'phy'], stressed: 1 },
  showCompare: false,
  showBeats: false,
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normCompare(raw: unknown): StressCompare {
  const r = (raw ?? {}) as Partial<StressCompare>
  const syl =
    Array.isArray(r.syllables) && r.syllables.length
      ? r.syllables.map(String)
      : [...DEFAULT.compare.syllables]
  return {
    word: String(r.word ?? DEFAULT.compare.word),
    syllables: syl,
    stressed: Math.max(0, Math.min(syl.length - 1, Math.floor(num(r.stressed ?? DEFAULT.compare.stressed)))),
  }
}

function normalize(raw: unknown): StressP {
  const r = (raw ?? {}) as Partial<StressP>
  const syllables =
    Array.isArray(r.syllables) && r.syllables.length ? r.syllables.map(String) : [...DEFAULT.syllables]
  const n = syllables.length
  return {
    word: String(
      r.word ?? (Array.isArray(r.syllables) && r.syllables.length ? syllables.join('') : DEFAULT.word),
    ),
    syllables,
    stressed: Math.max(0, Math.min(n - 1, Math.floor(num(r.stressed ?? 0)))),
    marked: r.marked == null ? null : Math.max(0, Math.min(n - 1, Math.floor(num(r.marked)))),
    compare: normCompare(r.compare),
    showCompare: !!r.showCompare,
    showBeats: !!r.showBeats,
  }
}

const verbs: Manipulative<StressP>['verbs'] = {
  mark(p, args): VerbClip<StressP> {
    const i = Math.max(0, Math.min(p.syllables.length - 1, Math.floor(num(args?.i ?? args ?? 0))))
    return tween(p, { ...p, marked: i }, 0.45, 'easeOutCubic')
  },
  showBeats(p): VerbClip<StressP> {
    return tween(p, { ...p, showBeats: true }, Math.min(0.9, 0.3 + 0.15 * p.syllables.length), 'easeOutCubic')
  },
  showCompare(p): VerbClip<StressP> {
    return tween(p, { ...p, showCompare: true }, 0.6, 'easeOutCubic')
  },
  reveal(p): VerbClip<StressP> {
    return tween(p, { ...p, marked: p.stressed }, 0.6, 'easeOutBack')
  },
  setWord(p, args): VerbClip<StressP> {
    const next = normalize({
      ...p,
      word: args?.word ?? p.word,
      syllables: args?.syllables ?? p.syllables,
      stressed: args?.stressed ?? p.stressed,
      compare: args?.compare ?? p.compare,
      marked: null,
    })
    return tween(p, next, 0.45, 'easeOutCubic')
  },
}

/* ---------------------------------------------------------------- layout */

// keep in sync with contrib/stresspattern.interactions.ts.txt onTap
function rowGeom(n: number, box: { w: number; h: number }, scaleK: number) {
  const totalW = box.w * 0.84
  const ox = (box.w - totalW) / 2
  const slotW = totalW / Math.max(1, n)
  const bh = Math.min(box.h * 0.15, slotW * 0.62) * scaleK
  return { ox, slotW, bh, center: (i: number) => ox + i * slotW + slotW / 2 }
}

function drawRow(
  prims: Prim[],
  syllables: string[],
  g: ReturnType<typeof rowGeom>,
  cy: number,
  op: number,
  scaleOf: (i: number) => number,
) {
  const maxLen = syllables.reduce((a, s) => Math.max(a, s.length), 1)
  const size = Math.min(g.bh * 0.5, (g.slotW * 0.72) / (maxLen * 0.58))
  syllables.forEach((s, i) => {
    const sc = scaleOf(i)
    const bw = g.slotW * 0.84 * sc
    const bhh = g.bh * sc
    const cx = g.center(i)
    prims.push({
      k: 'rect',
      x: cx - bw / 2,
      y: cy - bhh / 2,
      w: bw,
      h: bhh,
      fill: TOK.paper,
      color: TOK.ink,
      weight: 'sm',
      rx: g.bh * 0.18,
      opacity: op,
      z: 3,
    })
    prims.push({
      k: 'label',
      x: cx,
      y: cy,
      text: s,
      color: TOK.ink,
      size: size * sc,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 4,
    })
    if (i > 0)
      prims.push({
        k: 'circle',
        cx: g.ox + i * g.slotW,
        cy,
        r: g.bh * 0.06,
        fill: TOK.soft,
        opacity: op,
        z: 2,
      })
  })
  return size
}

function render(_params: StressP, state: ManipState<StressP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const n = P.syllables.length

  // compare visibility drives the layout blend (main row slides up to make room)
  const cv = P.showCompare ? (seg.verb === 'showCompare' ? seg.p : 1) : 0
  const cy = box.h * lerp(0.48, 0.34, cv)
  const g = rowGeom(n, box, 1)

  // marked-dot glide (mark / reveal interpolate position + box scale)
  const isMark = seg.verb === 'mark' || seg.verb === 'reveal'
  const fromM = seg.from.marked
  const toM = P.marked
  const scaleOf = (i: number): number => {
    if (isMark) {
      if (i === toM && i === fromM) return 1.15
      if (i === toM) return lerp(1, 1.15, seg.p)
      if (i === fromM) return lerp(1.15, 1, seg.p)
      return 1
    }
    return i === toM ? 1.15 : 1
  }

  const size = drawRow(prims, P.syllables, g, cy, 1, scaleOf)
  // the word itself (caption, from params)
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.07,
    text: P.word,
    color: TOK.soft,
    size: Math.min(box.h * 0.055, size * 0.9),
    align: 'middle',
    baseline: 'middle',
    z: 4,
  })

  // big stress dot above the marked syllable
  if (toM != null) {
    const dotY = cy - g.bh * 0.95
    let dotX = g.center(toM)
    let dotOp = 1
    if (isMark) {
      if (fromM == null) dotOp = seg.p
      else dotX = lerp(g.center(fromM), g.center(toM), seg.p)
    }
    prims.push({
      k: 'circle',
      cx: dotX,
      cy: dotY,
      r: g.bh * 0.16,
      fill: TOK.accent,
      opacity: dotOp,
      z: 6,
    })
    // reveal: a "correct" flash ring on the true stressed syllable
    if (seg.verb === 'reveal') {
      const flash = Math.sin(Math.PI * clamp01(seg.p))
      prims.push({
        k: 'circle',
        cx: g.center(P.stressed),
        cy,
        r: g.bh * (0.7 + 0.35 * seg.p),
        fill: 'none',
        color: TOK.good,
        weight: 'md',
        opacity: flash,
        z: 6,
      })
    }
  }

  // beat bars (metronome): tall = TRUE stressed, short = unstressed, pulsing in
  // sequence with a deterministic function of t
  if (P.showBeats || seg.verb === 'showBeats') {
    const beatOp = P.showBeats ? 1 : 0
    const per = 0.55 // seconds per syllable beat
    const ph = (t / per) % n
    const act = Math.min(n - 1, Math.max(0, Math.floor(ph)))
    const frac = ph - act
    const barY = cy + g.bh * 0.75
    for (let i = 0; i < n; i++) {
      const grow = seg.verb === 'showBeats' ? clamp01(seg.p * n - i) : beatOp // staggered in
      if (grow <= 0.001) continue
      const tall = i === P.stressed
      const pulse = i === act ? 1 + 0.35 * Math.sin(Math.PI * frac) : 1
      const bh = (tall ? g.bh * 0.55 : g.bh * 0.22) * grow * pulse
      const bw = g.slotW * 0.3
      prims.push({
        k: 'rect',
        x: g.center(i) - bw / 2,
        y: barY,
        w: bw,
        h: bh,
        fill: tall ? TOK.accent : TOK.soft,
        rx: bw * 0.2,
        opacity: grow * (i === act ? 1 : 0.6),
        z: 3,
      })
    }
  }

  // compare row (stress-shift pair) + dashed arc from stress to stress
  if (cv > 0.001) {
    const cmp = P.compare
    const g2 = rowGeom(cmp.syllables.length, box, 0.75)
    const cy2 = box.h * 0.72
    const size2 = drawRow(prims, cmp.syllables, g2, cy2, cv, (i) => (i === cmp.stressed ? 1.15 : 1))
    prims.push({
      k: 'circle',
      cx: g2.center(cmp.stressed),
      cy: cy2 - g2.bh * 0.95,
      r: g2.bh * 0.16,
      fill: TOK.accent2,
      opacity: cv,
      z: 6,
    })
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.9,
      text: cmp.word,
      color: TOK.soft,
      size: Math.min(box.h * 0.05, size2 * 0.9),
      align: 'middle',
      baseline: 'middle',
      opacity: cv,
      z: 4,
    })
    // the SHIFT: dashed arc from the word's stressed syllable to the compare's
    const x1 = g.center(P.stressed),
      y1 = cy + g.bh * 0.62
    const x2 = g2.center(cmp.stressed),
      y2 = cy2 - g2.bh * 1.25
    const mx = (x1 + x2) / 2 + (x2 >= x1 ? 1 : -1) * box.w * 0.06
    prims.push({
      k: 'path',
      d: `M ${x1} ${y1} Q ${mx} ${(y1 + y2) / 2} ${x2} ${y2}`,
      fill: 'none',
      color: TOK.warn,
      weight: 'md',
      dash: 7,
      opacity: cv,
      z: 5,
    })
    const ah = g2.bh * 0.22
    prims.push({
      k: 'path',
      d: `M ${x2 - ah * 0.8} ${y2 - ah} L ${x2} ${y2} L ${x2 + ah * 0.8} ${y2 - ah}`,
      color: TOK.warn,
      weight: 'md',
      opacity: cv,
      z: 5,
    })
  }

  return { prims, view: box }
}

export const WordStress: Manipulative<StressP> = {
  kind: 'stresspattern',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
