/**
 * minimalpair.ts — MinimalPair (cặp âm tối thiểu: ship–sheep). Two word cards
 * whose ONLY difference is one grapheme/phoneme — the contrasting letters are
 * rendered bigger + accent inside each word, the IPA row highlights the
 * differing phoneme, and a simple mouth-shape ellipse (wide / round / flat /
 * open) on the focused card is the pronunciation cue. The differing slice is
 * COMPUTED from the two words (common prefix/suffix), never authored wrong.
 * Primary English pronunciation, ages 6–11.
 * verbs: focus(side) · contrast · showIpa · choose(side) · setPair(a,b).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, TOK } from './util'

export type Mouth = 'wide' | 'round' | 'flat' | 'open'
export type PairSide = { word: string; ipa: string; mouth: Mouth }
export type MinPairP = {
  a: PairSide
  b: PairSide
  /** index of the contrasting grapheme (common-prefix length). */
  diffIndex: number
  focus: 'a' | 'b' | null
  showIpa: boolean
  chosen: 'a' | 'b' | null
}

const DEFAULT: MinPairP = {
  a: { word: 'ship', ipa: '/ʃɪp/', mouth: 'flat' },
  b: { word: 'sheep', ipa: '/ʃiːp/', mouth: 'wide' },
  diffIndex: 2,
  focus: null,
  showIpa: false,
  chosen: null,
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const MOUTHS: Mouth[] = ['wide', 'round', 'flat', 'open']
function side(raw: unknown, dflt: PairSide): PairSide {
  const r = (raw ?? {}) as Partial<PairSide>
  return {
    word: typeof r.word === 'string' && r.word ? r.word : dflt.word,
    ipa: typeof r.ipa === 'string' && r.ipa ? r.ipa : dflt.ipa,
    mouth: MOUTHS.includes(r.mouth as Mouth) ? (r.mouth as Mouth) : dflt.mouth,
  }
}

/** first index where the two strings differ (clamped to a valid char index). */
function firstDiff(a: string, b: string): number {
  const m = Math.min(a.length, b.length)
  let i = 0
  while (i < m && a[i] === b[i]) i++
  return Math.max(0, Math.min(i, Math.max(a.length, b.length) - 1))
}

/** split w into pre/diff/post given the pair's common prefix length. The
 *  common SUFFIX is measured against `other` so multi-letter contrasts
 *  (i ↔ ee) come out whole. Pure string logic — never authored. */
function splitParts(w: string, other: string, cp: number): { pre: string; diff: string; post: string } {
  const la = w.length,
    lb = other.length
  const minL = Math.min(la, lb)
  const cpc = Math.max(0, Math.min(cp, Math.max(0, la - 1)))
  let cs = 0
  while (cs < minL - cpc - 1 && w[la - 1 - cs] === other[lb - 1 - cs]) cs++
  const cut = Math.max(cpc, la - cs)
  return { pre: w.slice(0, cpc), diff: w.slice(cpc, cut), post: w.slice(cut) }
}

function normalize(raw: unknown): MinPairP {
  const r = (raw ?? {}) as Partial<MinPairP>
  const a = side(r.a, DEFAULT.a)
  const b = side(r.b, DEFAULT.b)
  const di: unknown = (r as { diffIndex?: unknown }).diffIndex
  const diffIndex =
    Number.isFinite(Number(di)) && di !== null && di !== undefined && di !== ''
      ? Math.max(0, Math.min(Math.max(a.word.length, b.word.length) - 1, Math.floor(num(di))))
      : firstDiff(a.word, b.word)
  return {
    a,
    b,
    diffIndex,
    focus: r.focus === 'a' || r.focus === 'b' ? r.focus : null,
    showIpa: !!r.showIpa,
    chosen: r.chosen === 'a' || r.chosen === 'b' ? r.chosen : null,
  }
}

const verbs: Manipulative<MinPairP>['verbs'] = {
  focus(p, args): VerbClip<MinPairP> {
    const s = (args?.side ?? args) === 'b' ? 'b' : 'a'
    return tween(p, { ...p, focus: s }, 0.45, 'easeOutCubic')
  },
  contrast(p): VerbClip<MinPairP> {
    // pulse: p goes 0→1→0 — both diff letters swell together (a compare moment)
    return tween(p, { ...p }, 0.8, 'pulse')
  },
  showIpa(p): VerbClip<MinPairP> {
    return tween(p, { ...p, showIpa: true }, 0.4, 'easeOutCubic')
  },
  choose(p, args): VerbClip<MinPairP> {
    const s = (args?.side ?? args) === 'b' ? 'b' : 'a'
    return tween(p, { ...p, chosen: s }, 0.4, 'easeOutBack')
  },
  setPair(p, args): VerbClip<MinPairP> {
    const a = side(args?.a, p.a)
    const b = side(args?.b, p.b)
    const di = args?.diffIndex
    const diffIndex =
      Number.isFinite(Number(di)) && di != null && di !== ''
        ? Math.max(0, Math.min(Math.max(a.word.length, b.word.length) - 1, Math.floor(num(di))))
        : firstDiff(a.word, b.word)
    return tween(p, { ...p, a, b, diffIndex, focus: null, chosen: null }, 0.5, 'easeOutCubic')
  },
}

/* ---------------------------------------------------------------- render */

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523
  return `M ${cx - rx} ${cy} C ${cx - rx} ${cy - ry * k} ${cx - rx * k} ${cy - ry} ${cx} ${cy - ry} C ${cx + rx * k} ${cy - ry} ${cx + rx} ${cy - ry * k} ${cx + rx} ${cy} C ${cx + rx} ${cy + ry * k} ${cx + rx * k} ${cy + ry} ${cx} ${cy + ry} C ${cx - rx * k} ${cy + ry} ${cx - rx} ${cy + ry * k} ${cx - rx} ${cy} Z`
}

/** word (or IPA) as pre/diff/post labels laid out to look like ONE word —
 *  positions share the width by character count. */
function drawSplitWord(
  prims: Prim[],
  parts: { pre: string; diff: string; post: string },
  cx: number,
  y: number,
  size: number,
  boost: number,
  baseColor: string,
  op: number,
  z: number,
) {
  const charW = size * 0.62
  const total = (parts.pre.length + parts.diff.length + parts.post.length) * charW
  const startX = cx - total / 2
  if (parts.pre)
    prims.push({
      k: 'label',
      x: startX + (parts.pre.length * charW) / 2,
      y,
      text: parts.pre,
      color: baseColor,
      size,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z,
    })
  if (parts.diff)
    prims.push({
      k: 'label',
      x: startX + parts.pre.length * charW + (parts.diff.length * charW) / 2,
      y,
      text: parts.diff,
      color: TOK.accent,
      size: size * (1.16 + 0.3 * boost),
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: z + 1,
    })
  if (parts.post)
    prims.push({
      k: 'label',
      x: startX + (parts.pre.length + parts.diff.length) * charW + (parts.post.length * charW) / 2,
      y,
      text: parts.post,
      color: baseColor,
      size,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z,
    })
}

function mouthShape(m: Mouth, u: number): { rx: number; ry: number } {
  switch (m) {
    case 'wide':
      return { rx: u * 1.8, ry: u * 0.5 }
    case 'round':
      return { rx: u * 0.9, ry: u * 0.9 }
    case 'open':
      return { rx: u * 1.0, ry: u * 1.3 }
    case 'flat':
    default:
      return { rx: u * 1.3, ry: u * 0.25 }
  }
}

function render(_params: MinPairP, state: ManipState<MinPairP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const portrait = box.h > box.w

  // keep in sync with minimalpair entry in interactions (a = left/top, b = right/bottom; portrait split at 0.45h)
  const cardW = portrait ? box.w * 0.76 : box.w * 0.38
  const cardH = portrait ? box.h * 0.28 : box.h * 0.52
  const centers: Record<'a' | 'b', { x: number; y: number }> = portrait
    ? { a: { x: box.w * 0.5, y: box.h * 0.27 }, b: { x: box.w * 0.5, y: box.h * 0.63 } }
    : { a: { x: box.w * 0.27, y: box.h * 0.44 }, b: { x: box.w * 0.73, y: box.h * 0.44 } }

  const boost = seg.verb === 'contrast' ? seg.p : 0 // pulse 0→1→0
  const maxLen = Math.max(1, P.a.word.length, P.b.word.length)
  const wordSize = Math.min(cardH * 0.24, (cardW * 0.84) / (0.62 * maxLen))

  const ipaAp = seg.verb === 'showIpa' && !seg.from.showIpa ? seg.p : 1

  for (const s of ['a', 'b'] as const) {
    const S = s === 'a' ? P.a : P.b
    const other = s === 'a' ? P.b : P.a
    const c = centers[s]
    // focus scale animates 1 → 1.06
    const scFrom = seg.from.focus === s ? 1.06 : 1
    const scTo = P.focus === s ? 1.06 : 1
    const sc = seg.verb === 'focus' ? lerp(scFrom, scTo, seg.p) : scTo
    const w = cardW * sc,
      h = cardH * sc

    // card + shadow
    prims.push({
      k: 'rect',
      x: c.x - w / 2 + w * 0.02,
      y: c.y - h / 2 + w * 0.02,
      w,
      h,
      fill: TOK.soft,
      rx: w * 0.07,
      opacity: 0.22,
      z: 2,
    })
    prims.push({
      k: 'rect',
      x: c.x - w / 2,
      y: c.y - h / 2,
      w,
      h,
      fill: P.chosen === s ? TOK.good : TOK.paper,
      color: TOK.ink,
      weight: 'md',
      rx: w * 0.07,
      opacity: P.chosen === s ? 0.35 : 1,
      z: 3,
    })
    // focus ring
    if (sc > 1.001)
      prims.push({
        k: 'rect',
        x: c.x - w / 2 - w * 0.03,
        y: c.y - h / 2 - w * 0.03,
        w: w * 1.06,
        h: h + w * 0.06,
        fill: 'none',
        color: TOK.accent,
        weight: 'lg',
        rx: w * 0.09,
        opacity: (sc - 1) / 0.06,
        z: 6,
      })
    // chosen ring
    if (P.chosen === s) {
      const rp = seg.verb === 'choose' && seg.from.chosen !== s ? seg.p : 1
      prims.push({
        k: 'rect',
        x: c.x - w / 2 - w * 0.04,
        y: c.y - h / 2 - w * 0.04,
        w: w * 1.08,
        h: h + w * 0.08,
        fill: 'none',
        color: TOK.good,
        weight: 'lg',
        rx: w * 0.1,
        opacity: rp,
        z: 6,
      })
    }

    // the word, diff letters bigger + accent (computed, not authored)
    const parts = splitParts(S.word, other.word, P.diffIndex)
    drawSplitWord(prims, parts, c.x, c.y - h * 0.22, wordSize * sc, boost, TOK.ink, 1, 4)

    // IPA with the differing phoneme highlighted
    if (P.showIpa) {
      const ipaParts = splitParts(S.ipa, other.ipa, firstDiff(P.a.ipa, P.b.ipa))
      const ipaSize = Math.min(wordSize * 0.6, (cardW * 0.8) / (0.62 * Math.max(1, S.ipa.length)))
      drawSplitWord(prims, ipaParts, c.x, c.y + h * 0.06, ipaSize * sc, boost * 0.5, TOK.soft, ipaAp, 4)
    }

    // mouth-shape pronunciation cue on the focused card
    if (P.focus === s) {
      const mp = seg.verb === 'focus' && seg.from.focus !== s ? seg.p : 1
      const u = cardH * 0.09
      const { rx, ry } = mouthShape(S.mouth, u)
      const my = c.y + h * 0.3
      prims.push({
        k: 'path',
        d: ellipsePath(c.x, my, rx * sc, Math.max(0.5, ry) * sc),
        fill: TOK.warn,
        color: TOK.ink,
        weight: 'md',
        closed: true,
        opacity: 0.75 * mp,
        z: 5,
      })
      prims.push({
        k: 'line',
        x1: c.x - rx * sc,
        y1: my,
        x2: c.x + rx * sc,
        y2: my,
        color: TOK.ink,
        weight: 'sm',
        cap: 'round',
        opacity: 0.6 * mp,
        z: 5,
      })
    }
  }

  return { prims, view: box }
}

export const MinimalPair: Manipulative<MinPairP> = {
  kind: 'minimalpair',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
