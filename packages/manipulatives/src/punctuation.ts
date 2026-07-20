/**
 * punctuation.ts — capital letters & punctuation (Cambridge Primary English:
 * Writing — punctuation). Fix a plain string: capitalise words, drop in end
 * marks / commas. verbs: capitalize(i) · addMark(after,mark) · addComma(after).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type PunctuationP = {
  words: string[]
  capitals: number[]
  marks: { after: number; mark: string }[]
}

const DEFAULT: PunctuationP = { words: ['i', 'like', 'cats'], capitals: [], marks: [] }

function normalize(raw: unknown): PunctuationP {
  const r = (raw ?? {}) as Partial<PunctuationP> & { text?: string }
  const words = r.words ?? (r.text ? String(r.text).split(/\s+/) : DEFAULT.words)
  return { words: [...words], capitals: [...(r.capitals ?? [])], marks: [...(r.marks ?? [])] }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<PunctuationP>['verbs'] = {
  capitalize(p, args): VerbClip<PunctuationP> {
    const i = Math.floor(num(args?.i ?? args ?? 0))
    return tween(
      p,
      { ...p, capitals: p.capitals.includes(i) ? p.capitals : [...p.capitals, i] },
      0.4,
      'easeOutBack',
    )
  },
  addMark(p, args): VerbClip<PunctuationP> {
    const after = Math.floor(num(args?.after ?? p.words.length - 1))
    const mark = String(args?.mark ?? '.')
    return tween(p, { ...p, marks: [...p.marks, { after, mark }] }, 0.4, 'easeOutBack')
  },
  addComma(p, args): VerbClip<PunctuationP> {
    const after = Math.floor(num(args?.after ?? 0))
    return tween(p, { ...p, marks: [...p.marks, { after, mark: ',' }] }, 0.4, 'easeOutBack')
  },
}

function render(
  _params: PunctuationP,
  state: ManipState<PunctuationP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const totalChars = P.words.reduce((a, w) => a + w.length + 2, 0)
  const size = Math.min(box.h * 0.2, (box.w * 0.9) / (totalChars * 0.6))
  const charW = size * 0.6,
    gap = size * 0.55
  const disp = P.words.map((w, i) =>
    P.capitals.includes(i) && w.length ? w[0]!.toUpperCase() + w.slice(1) : w,
  )
  const ws = disp.map((w) => w.length * charW)
  // include mark widths after words
  const markAfter = new Map<number, string>()
  for (const m of P.marks) markAfter.set(m.after, (markAfter.get(m.after) ?? '') + m.mark)
  const total =
    ws.reduce((a, b) => a + b, 0) +
    gap * (P.words.length - 1) +
    [...markAfter.values()].reduce((a, m) => a + m.length * charW, 0)
  let x = (box.w - total) / 2
  const cy = box.h * 0.5
  const newMark = seg.verb === 'addMark' || seg.verb === 'addComma' ? P.marks[P.marks.length - 1] : null
  const newCap = seg.verb === 'capitalize' ? P.capitals[P.capitals.length - 1] : -1

  disp.forEach((w, i) => {
    const capGrow = i === newCap ? seg.p : 1
    // highlight the capital letter
    if (P.capitals.includes(i))
      prims.push({
        k: 'circle',
        cx: x + charW * 0.5,
        cy: cy - size * 0.55,
        r: charW * 0.55,
        fill: TOK.warn,
        opacity: 0.4 * capGrow,
        z: 1,
      })
    prims.push({
      k: 'label',
      x,
      y: cy,
      text: w,
      color: TOK.ink,
      size,
      align: 'start',
      baseline: 'middle',
      z: 3,
    })
    x += ws[i]!
    const mk = markAfter.get(i)
    if (mk) {
      const grow = newMark && newMark.after === i ? seg.p : 1
      prims.push({
        k: 'label',
        x,
        y: cy + size * 0.05,
        text: mk,
        color: TOK.accent,
        size: size * 1.1 * grow,
        align: 'start',
        baseline: 'middle',
        opacity: grow,
        z: 4,
      })
      x += mk.length * charW
    }
    x += gap
  })

  return { prims, view: box }
}

export const PunctuationFix: Manipulative<PunctuationP> = {
  kind: 'punctuation',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
