/**
 * wordform.ts — WordFormFamily (họ từ / word form — exam prep TOEIC/TOEFL/IELTS,
 * e.g. decide → decision → decisive → decisively). The root word sits in a hub;
 * POS satellites reveal each derived form with its suffix highlighted (suffix =
 * the part after the longest common prefix with the root — computed, never
 * hardcoded). A usage sentence below grades the placed form against its
 * required part of speech. verbs: reveal(pos) · revealAll() · highlightSuffix()
 * · place(pos) · setFamily(root, family, sentence?).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, lerp, TOK } from './util'

export type WordForm = { pos: string; word: string }
export type WordFormP = {
  root: string
  family: WordForm[]
  posLabels: Record<string, string>
  revealed: string[] // pos values revealed so far
  sentence: { template: string; correctPos: string } | null
  placed: string | null // pos placed into the sentence slot
  /** transient: pos values newly revealed by the active verb (stagger gate). */
  _new?: string[]
}

const DEFAULT: WordFormP = {
  root: 'decide',
  family: [
    { pos: 'noun', word: 'decision' },
    { pos: 'verb', word: 'decide' },
    { pos: 'adjective', word: 'decisive' },
    { pos: 'adverb', word: 'decisively' },
  ],
  posLabels: { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb' },
  revealed: [],
  sentence: { template: 'Her ___ was final.', correctPos: 'noun' },
  placed: null,
}

function normalize(raw: unknown): WordFormP {
  const r = (raw ?? {}) as Partial<WordFormP>
  const root = typeof r.root === 'string' && r.root.trim().length ? r.root.trim() : DEFAULT.root
  const famRaw: unknown[] = Array.isArray(r.family) ? r.family : DEFAULT.family
  const family: WordForm[] = []
  for (const item of famRaw) {
    const f = item as { word?: unknown; pos?: unknown } | null
    if (!f || typeof f !== 'object' || typeof f.word !== 'string') continue
    const pos = String(f.pos ?? '').trim()
    if (!pos || !f.word.trim() || family.some((x) => x.pos === pos)) continue
    family.push({ pos, word: f.word.trim() })
  }
  if (!family.length) family.push(...DEFAULT.family.map((f) => ({ ...f })))
  const posLabels: Record<string, string> = {
    ...DEFAULT.posLabels,
    ...(r.posLabels && typeof r.posLabels === 'object' ? r.posLabels : {}),
  }
  for (const f of family) if (!posLabels[f.pos]) posLabels[f.pos] = f.pos
  const revealed = (Array.isArray(r.revealed) ? r.revealed : [])
    .map((s) => String(s))
    .filter((s, i, a) => family.some((f) => f.pos === s) && a.indexOf(s) === i)
  let sentence: WordFormP['sentence'] = null
  if (r.sentence !== null) {
    const s = (r.sentence ?? DEFAULT.sentence) as { template?: unknown; correctPos?: unknown }
    let template =
      typeof s?.template === 'string' && s.template.length ? s.template : DEFAULT.sentence!.template
    if (!template.includes('___')) template += ' ___'
    const cp = String(s?.correctPos ?? '')
    const correctPos = family.some((f) => f.pos === cp) ? cp : family[0]!.pos
    sentence = { template, correctPos }
  }
  const placed = r.placed != null && family.some((f) => f.pos === String(r.placed)) ? String(r.placed) : null
  return { root, family, posLabels, revealed, sentence, placed }
}

/** longest common prefix length (case-insensitive) — the suffix begins here. */
function lcpLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a[i]!.toLowerCase() === b[i]!.toLowerCase()) i++
  return i
}

/** read args.key (or a bare scalar arg) as a valid pos, else null. */
function posArg(p: WordFormP, args: unknown, key: string): string | null {
  const v: unknown = args != null && typeof args === 'object' ? (args as Record<string, unknown>)[key] : args
  if (v == null || typeof v === 'object') return null
  const s = String(v)
  return p.family.some((f) => f.pos === s) ? s : null
}

const verbs: Manipulative<WordFormP>['verbs'] = {
  reveal(p, args): VerbClip<WordFormP> {
    const pos = posArg(p, args, 'pos') ?? p.family[0]!.pos
    const had = p.revealed.includes(pos)
    return tween(
      p,
      { ...p, revealed: had ? p.revealed : [...p.revealed, pos], _new: had ? [] : [pos] },
      0.5,
      'easeOutBack',
    )
  },
  revealAll(p): VerbClip<WordFormP> {
    const all = p.family.map((f) => f.pos)
    const nw = all.filter((s) => !p.revealed.includes(s))
    return tween(p, { ...p, revealed: all, _new: nw }, 0.8, 'easeOutCubic')
  },
  highlightSuffix(p): VerbClip<WordFormP> {
    // pulse every visible suffix; reveal all first so there is something to pulse
    const revealed = p.revealed.length ? p.revealed : p.family.map((f) => f.pos)
    return tween(p, { ...p, revealed, _new: [] }, 0.7, 'linear')
  },
  place(p, args): VerbClip<WordFormP> {
    const pos = posArg(p, args, 'pos') ?? p.sentence?.correctPos ?? p.family[0]!.pos
    const had = p.revealed.includes(pos)
    return tween(
      p,
      {
        ...p,
        revealed: had ? p.revealed : [...p.revealed, pos],
        placed: pos,
        _new: had ? [] : [pos],
      },
      0.6,
      'spring',
    )
  },
  setFamily(p, args): VerbClip<WordFormP> {
    const a = (args != null && typeof args === 'object' ? args : {}) as Partial<WordFormP>
    const next = normalize({
      root: a.root ?? p.root,
      family: a.family ?? p.family,
      sentence: a.sentence !== undefined ? a.sentence : p.sentence,
      posLabels: a.posLabels ?? p.posLabels,
      revealed: [],
      placed: null,
    })
    return tween(p, next, 0.5, 'easeOutCubic')
  },
}

/* ---------------------------------------------------------------- layout */

function rrPath(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  return `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`
}

type WFLayout = {
  fs: number
  root: { cx: number; cy: number; r: number }
  sats: { cx: number; cy: number; w: number; h: number }[]
  sent: null | {
    y: number
    sfs: number
    pre: string
    post: string
    preX: number
    postX: number
    slot: { x: number; y: number; w: number; h: number }
  }
}

// keep in sync with the "wordform" entry in interactions.ts (onTap geometry)
function layoutWF(P: WordFormP, box: { w: number; h: number }): WFLayout {
  const portrait = box.h > box.w
  const n = Math.max(1, P.family.length)
  const maxLen = P.family.reduce((m, f) => Math.max(m, f.word.length), 4)
  const fs = portrait
    ? Math.min(box.h * 0.045, (box.w * 0.7) / (maxLen * 0.58 + 0.9))
    : Math.min(box.h * 0.058, (box.w * 0.3) / (maxLen * 0.58 + 0.9))
  const cardH = fs * 1.6
  const rcx = box.w * 0.5
  const rcy = portrait ? box.h * 0.11 : box.h * 0.4
  const rr = Math.min(box.w, box.h) * (portrait ? 0.085 : 0.105)
  const sats = P.family.map((f, i) => {
    const w = Math.max(fs * 2.2, f.word.length * fs * 0.58 + fs * 0.9)
    if (portrait) {
      const step = Math.min(box.h * 0.135, (box.h * 0.56) / Math.max(1, n))
      return { cx: rcx, cy: box.h * 0.26 + i * step, w, h: cardH }
    }
    const dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    const d = n <= 4 ? dirs[i]! : [Math.cos(a), Math.sin(a)]
    return { cx: rcx + d[0]! * box.w * 0.33, cy: rcy + d[1]! * box.h * 0.27, w, h: cardH }
  })
  let sent: WFLayout['sent'] = null
  if (P.sentence) {
    const parts = P.sentence.template.split('___')
    const pre = parts[0] ?? '',
      post = parts.slice(1).join('___')
    const slotChars = maxLen + 1
    const totalChars = pre.length + post.length + slotChars + 2
    const sfs = Math.min(fs, (box.w * 0.92) / (totalChars * 0.55))
    const ch = sfs * 0.55
    const slotW = slotChars * ch + sfs * 0.6
    const total = pre.length * ch + slotW + post.length * ch + sfs * 0.4
    const x0 = (box.w - total) / 2
    const y = portrait ? box.h * 0.85 : box.h * 0.86
    const slotX = x0 + pre.length * ch + sfs * 0.2
    sent = {
      y,
      sfs,
      pre,
      post,
      preX: x0,
      postX: slotX + slotW + sfs * 0.2,
      slot: { x: slotX, y: y - sfs * 0.8, w: slotW, h: sfs * 1.6 },
    }
  }
  return { fs, root: { cx: rcx, cy: rcy, r: rr }, sats, sent }
}

/* ---------------------------------------------------------------- render */

function render(_params: WordFormP, state: ManipState<WordFormP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const L = layoutWF(P, box)
  const fs = L.fs,
    ch = fs * 0.58
  const newly = P._new ?? []
  const animReveal = seg.verb === 'reveal' || seg.verb === 'revealAll' || seg.verb === 'place'
  const popOf = (pos: string) => {
    if (!animReveal) return 1
    const k = newly.indexOf(pos)
    if (k < 0) return 1
    return seg.verb === 'revealAll' ? clamp01(seg.p * Math.max(1, newly.length) - k) : seg.p
  }
  const pulse = seg.verb === 'highlightSuffix' ? Math.sin(Math.PI * clamp01(seg.p)) : 0

  // root hub
  prims.push({
    k: 'circle',
    cx: L.root.cx,
    cy: L.root.cy,
    r: L.root.r,
    fill: TOK.paper,
    color: TOK.accent,
    weight: 'md',
    z: 3,
  })
  prims.push({
    k: 'circle',
    cx: L.root.cx,
    cy: L.root.cy,
    r: L.root.r,
    fill: TOK.accent,
    opacity: 0.15,
    z: 3,
  })
  const rf = Math.min(L.root.r * 0.62, (L.root.r * 1.7) / Math.max(1, P.root.length * 0.55))
  prims.push({
    k: 'label',
    x: L.root.cx,
    y: L.root.cy,
    text: P.root,
    color: TOK.ink,
    size: rf,
    align: 'middle',
    baseline: 'middle',
    z: 4,
  })

  // satellites — spoke draws on, card pops, suffix highlighted in accent
  P.family.forEach((f, i) => {
    const s = L.sats[i]!
    const on = P.revealed.includes(f.pos)
    const pk = on ? popOf(f.pos) : 1
    if (on) {
      const ex = lerp(L.root.cx, s.cx, Math.min(1, pk)),
        ey = lerp(L.root.cy, s.cy, Math.min(1, pk))
      prims.push({
        k: 'line',
        x1: L.root.cx,
        y1: L.root.cy,
        x2: ex,
        y2: ey,
        color: TOK.accent2,
        weight: 'md',
        opacity: 0.85,
        z: 2,
      })
    } else {
      prims.push({
        k: 'line',
        x1: L.root.cx,
        y1: L.root.cy,
        x2: s.cx,
        y2: s.cy,
        color: TOK.faint,
        weight: 'sm',
        dash: fs * 0.3,
        opacity: 0.5,
        z: 2,
      })
    }
    const sc = on ? 0.6 + 0.4 * pk : 1
    const cw = s.w * sc,
      chh = s.h * sc
    const x = s.cx - cw / 2,
      y = s.cy - chh / 2
    if (on) {
      const op = Math.min(1, pk)
      prims.push({
        k: 'rect',
        x,
        y,
        w: cw,
        h: chh,
        fill: TOK.paper,
        color: TOK.accent2,
        weight: 'md',
        rx: fs * 0.3,
        opacity: op,
        z: 3,
      })
      const cut = lcpLen(P.root, f.word)
      const preT = f.word.slice(0, cut),
        sufT = f.word.slice(cut)
      const x0 = s.cx - (f.word.length * ch) / 2
      if (preT)
        prims.push({
          k: 'label',
          x: x0,
          y: s.cy,
          text: preT,
          color: TOK.ink,
          size: fs,
          align: 'start',
          baseline: 'middle',
          opacity: op,
          z: 4,
        })
      if (sufT) {
        const sx = x0 + preT.length * ch
        prims.push({
          k: 'label',
          x: sx,
          y: s.cy,
          text: sufT,
          color: TOK.accent,
          size: fs * (1 + 0.3 * pulse),
          align: 'start',
          baseline: 'middle',
          opacity: op,
          z: 5,
        })
        prims.push({
          k: 'line',
          x1: sx,
          y1: s.cy + fs * 0.62,
          x2: sx + sufT.length * ch,
          y2: s.cy + fs * 0.62,
          color: TOK.accent,
          weight: 'md',
          opacity: op * (0.55 + 0.45 * pulse),
          z: 5,
        })
      }
    } else {
      prims.push({
        k: 'path',
        d: rrPath(x, y, cw, chh, fs * 0.3),
        color: TOK.soft,
        weight: 'sm',
        dash: fs * 0.3,
        opacity: 0.8,
        z: 3,
      })
      prims.push({
        k: 'label',
        x: s.cx,
        y: s.cy,
        text: '?',
        color: TOK.soft,
        size: fs,
        align: 'middle',
        baseline: 'middle',
        opacity: 0.8,
        z: 4,
      })
    }
    prims.push({
      k: 'label',
      x: s.cx,
      y: s.cy + s.h * 0.95,
      text: P.posLabels[f.pos] ?? f.pos,
      color: TOK.soft,
      size: fs * 0.5,
      align: 'middle',
      baseline: 'middle',
      z: 4,
    })
  })

  // usage sentence frame + placed form (correctness derived from correctPos)
  if (L.sent && P.sentence) {
    const S = L.sent
    prims.push({
      k: 'label',
      x: S.preX,
      y: S.y,
      text: S.pre,
      color: TOK.ink,
      size: S.sfs,
      align: 'start',
      baseline: 'middle',
      z: 3,
    })
    prims.push({
      k: 'label',
      x: S.postX,
      y: S.y,
      text: S.post,
      color: TOK.ink,
      size: S.sfs,
      align: 'start',
      baseline: 'middle',
      z: 3,
    })
    const placedIdx = P.placed ? P.family.findIndex((f) => f.pos === P.placed) : -1
    const correct = P.placed != null && P.placed === P.sentence.correctPos
    const border = placedIdx >= 0 ? (correct ? TOK.good : TOK.warn) : TOK.soft
    prims.push({
      k: 'path',
      d: rrPath(S.slot.x, S.slot.y, S.slot.w, S.slot.h, S.sfs * 0.3),
      color: border,
      weight: placedIdx >= 0 ? 'md' : 'sm',
      dash: placedIdx >= 0 ? undefined : S.sfs * 0.3,
      opacity: 0.95,
      z: 3,
    })
    if (placedIdx >= 0) {
      const word = P.family[placedIdx]!.word
      const sat = L.sats[placedIdx]!
      const flying = seg.verb === 'place' && seg.p < 1
      if (flying) {
        const cx = lerp(sat.cx, S.slot.x + S.slot.w / 2, seg.p)
        const cy = lerp(sat.cy, S.y, seg.p)
        prims.push({
          k: 'rect',
          x: cx - sat.w / 2,
          y: cy - sat.h / 2,
          w: sat.w,
          h: sat.h,
          fill: TOK.paper,
          color: TOK.accent,
          weight: 'md',
          rx: fs * 0.3,
          opacity: 0.95,
          z: 7,
        })
        prims.push({
          k: 'label',
          x: cx,
          y: cy,
          text: word,
          color: TOK.ink,
          size: fs,
          align: 'middle',
          baseline: 'middle',
          z: 8,
        })
      } else {
        prims.push({
          k: 'rect',
          x: S.slot.x,
          y: S.slot.y,
          w: S.slot.w,
          h: S.slot.h,
          fill: correct ? TOK.good : TOK.warn,
          opacity: 0.15,
          rx: S.sfs * 0.3,
          z: 2,
        })
        prims.push({
          k: 'label',
          x: S.slot.x + S.slot.w / 2,
          y: S.y,
          text: word,
          color: correct ? TOK.good : TOK.warn,
          size: S.sfs,
          align: 'middle',
          baseline: 'middle',
          z: 4,
        })
        prims.push({
          k: 'label',
          x: S.slot.x + S.slot.w / 2,
          y: S.slot.y - S.sfs * 0.45,
          text: correct ? '✓' : '✗',
          color: correct ? TOK.good : TOK.warn,
          size: S.sfs * 0.7,
          align: 'middle',
          baseline: 'middle',
          z: 6,
        })
      }
    }
  }

  return { prims, view: box }
}

export const WordFormFamily: Manipulative<WordFormP> = {
  kind: 'wordform',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
