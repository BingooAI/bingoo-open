/**
 * wordclass.ts — parts of speech (Cambridge Primary English: Grammar). Each word
 * in a sentence carries a word class; revealing/ tagging colours it and shows a
 * legend. verbs: tag(i,cls) · revealClass(cls) · highlightClass(cls) · reveal.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type WordTok = { word: string; cls: string }
export type WordClassP = {
  tokens: WordTok[]
  revealed: string[]
  highlight: string | null
  labels: Record<string, string>
}

const CLASS_COLOR: Record<string, string> = {
  noun: TOK.accent,
  verb: TOK.accent2,
  adj: TOK.good,
  adv: TOK.warn,
  pron: TOK.soft,
  det: TOK.faint,
  prep: TOK.soft,
  conj: TOK.faint,
}
const CLASS_LABEL: Record<string, string> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  pron: 'pronoun',
  det: 'determiner',
  prep: 'preposition',
  conj: 'conjunction',
}

const DEFAULT: WordClassP = {
  tokens: [
    { word: 'the', cls: 'det' },
    { word: 'big', cls: 'adj' },
    { word: 'dog', cls: 'noun' },
    { word: 'runs', cls: 'verb' },
  ],
  revealed: [],
  highlight: null,
  labels: CLASS_LABEL,
}

function normalize(raw: unknown): WordClassP {
  const r = (raw ?? {}) as Partial<WordClassP>
  return {
    tokens: (r.tokens ?? DEFAULT.tokens).map((t) => ({ word: t.word ?? '', cls: t.cls ?? 'noun' })),
    revealed: [...(r.revealed ?? [])],
    highlight: r.highlight ?? null,
    labels: { ...CLASS_LABEL, ...(r.labels ?? {}) },
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<WordClassP>['verbs'] = {
  tag(p, args): VerbClip<WordClassP> {
    const i = Math.floor(num(args?.i ?? 0))
    const cls = String(args?.cls ?? 'noun')
    const tokens = p.tokens.map((t, k) => (k === i ? { ...t, cls } : t))
    const revealed = p.revealed.includes(cls) ? p.revealed : [...p.revealed, cls]
    return tween(
      { ...p, highlight: cls },
      { ...p, tokens, revealed, highlight: cls, _tagged: i } as WordClassP,
      0.45,
      'easeOutBack',
    )
  },
  revealClass(p, args): VerbClip<WordClassP> {
    const cls = String(args?.cls ?? args ?? 'noun')
    return tween(
      p,
      {
        ...p,
        revealed: p.revealed.includes(cls) ? p.revealed : [...p.revealed, cls],
        highlight: cls,
      },
      0.45,
      'easeOutCubic',
    )
  },
  highlightClass(p, args): VerbClip<WordClassP> {
    return tween(p, { ...p, highlight: String(args?.cls ?? args ?? 'noun') }, 0.35, 'easeOutCubic')
  },
  reveal(p): VerbClip<WordClassP> {
    return tween(
      p,
      { ...p, revealed: [...new Set(p.tokens.map((t) => t.cls))], highlight: null },
      0.5,
      'easeOutCubic',
    )
  },
}

function render(_params: WordClassP, state: ManipState<WordClassP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const totalChars = P.tokens.reduce((a, tk) => a + tk.word.length + 2, 0)
  const size = Math.min(box.h * 0.16, (box.w * 0.9) / (totalChars * 0.6))
  const charW = size * 0.6,
    pad = size * 0.5,
    gap = size * 0.4
  const ws = P.tokens.map((tk) => tk.word.length * charW + pad)
  const total = ws.reduce((a, b) => a + b, 0) + gap * (P.tokens.length - 1)
  let x = (box.w - total) / 2
  const cy = box.h * 0.42
  const cardH = size * 1.6
  const tagged = (seg.to as WordClassP & { _tagged?: number })._tagged

  P.tokens.forEach((tk, i) => {
    const shown = P.revealed.includes(tk.cls)
    const dim = P.highlight && P.highlight !== tk.cls ? 0.35 : 1
    const grow = seg.verb === 'tag' && i === tagged ? seg.p : 1
    const fill = shown ? (CLASS_COLOR[tk.cls] ?? TOK.faint) : TOK.paper
    prims.push({
      k: 'rect',
      x,
      y: cy - cardH / 2,
      w: ws[i]!,
      h: cardH,
      fill,
      color: TOK.ink,
      weight: 'sm',
      rx: size * 0.2,
      opacity: (shown ? 0.4 + 0.6 * grow : 1) * dim,
      z: 2,
    })
    prims.push({
      k: 'label',
      x: x + ws[i]! / 2,
      y: cy,
      text: tk.word,
      color: TOK.ink,
      size,
      align: 'middle',
      baseline: 'middle',
      opacity: dim,
      z: 3,
    })
    x += ws[i]! + gap
  })

  // legend
  let lx = box.w * 0.5 - (P.revealed.length * box.w * 0.14) / 2
  P.revealed.forEach((cls) => {
    prims.push({
      k: 'rect',
      x: lx,
      y: box.h * 0.82,
      w: box.h * 0.06,
      h: box.h * 0.06,
      fill: CLASS_COLOR[cls] ?? TOK.faint,
      color: TOK.ink,
      weight: 'sm',
      rx: 4,
      z: 4,
    })
    prims.push({
      k: 'label',
      x: lx + box.h * 0.08,
      y: box.h * 0.85,
      text: P.labels[cls] ?? cls,
      color: TOK.soft,
      size: box.h * 0.055,
      align: 'start',
      baseline: 'middle',
      z: 4,
    })
    lx += box.w * 0.14
  })

  return { prims, view: box }
}

export const WordClass: Manipulative<WordClassP> = {
  kind: 'wordclass',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
