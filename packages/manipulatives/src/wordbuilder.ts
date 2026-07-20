// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * wordbuilder.ts — letter tiles (Cambridge Primary English: spelling, word
 * families, minimal pairs — cat → cot → cog). verbs: addLetter(ch) ·
 * changeLetter(i,ch) · removeLetter · highlight(i).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, TOK } from './util'

export type WordBuilderP = { letters: string[]; highlight: number | null }

const DEFAULT: WordBuilderP = { letters: ['c', 'a', 't'], highlight: null }

function normalize(raw: unknown): WordBuilderP {
  const r = (raw ?? {}) as Partial<WordBuilderP> & { word?: string }
  const letters = r.letters ?? (r.word ? String(r.word).split('') : DEFAULT.letters)
  return { letters: [...letters], highlight: r.highlight ?? null }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<WordBuilderP>['verbs'] = {
  addLetter(p, args): VerbClip<WordBuilderP> {
    return tween(
      p,
      {
        ...p,
        letters: [...p.letters, String(args?.ch ?? args ?? '')],
        highlight: p.letters.length,
      },
      0.4,
      'easeOutBack',
    )
  },
  removeLetter(p): VerbClip<WordBuilderP> {
    return tween(p, { ...p, letters: p.letters.slice(0, -1), highlight: null }, 0.35, 'easeInCubic')
  },
  changeLetter(p, args): VerbClip<WordBuilderP> {
    const i = Math.max(0, Math.min(p.letters.length - 1, Math.floor(num(args?.i ?? 0))))
    const letters = [...p.letters]
    letters[i] = String(args?.ch ?? letters[i])
    return tween(p, { ...p, letters, highlight: i }, 0.5, 'easeOutBack')
  },
  highlight(p, args): VerbClip<WordBuilderP> {
    return tween(p, { ...p, highlight: Math.floor(num(args?.i ?? args ?? 0)) }, 0.35, 'easeOutCubic')
  },
}

function render(
  _params: WordBuilderP,
  state: ManipState<WordBuilderP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const n = P.letters.length
  const tile = Math.min(box.h * 0.34, (box.w * 0.86) / n)
  const gap = tile * 0.12
  const totalW = n * tile + (n - 1) * gap
  const ox = (box.w - totalW) / 2
  const cy = box.h * 0.44
  const changed = seg.verb === 'changeLetter' || (seg.verb === 'addLetter' && P.highlight === n - 1)

  P.letters.forEach((ch, i) => {
    const x = ox + i * (tile + gap)
    const hi = P.highlight === i
    // a changed/added tile flips in
    const flip = hi && changed ? clamp01(seg.p) : 1
    const sx = hi && changed ? Math.abs(Math.cos(Math.PI * (1 - flip))) : 1 // 0→1 flip on X
    prims.push({
      k: 'rect',
      x: x + (tile * (1 - sx)) / 2,
      y: cy - tile / 2,
      w: tile * sx,
      h: tile,
      fill: hi ? TOK.warn : TOK.accent,
      color: TOK.ink,
      weight: 'md',
      rx: tile * 0.12,
      z: 2,
    })
    if (sx > 0.4)
      prims.push({
        k: 'label',
        x: x + tile / 2,
        y: cy,
        text: ch,
        color: TOK.ink,
        size: tile * 0.6,
        align: 'middle',
        baseline: 'middle',
        z: 3,
      })
  })
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.82,
    text: P.letters.join(''),
    color: TOK.accent,
    size: tile * 0.55,
    align: 'middle',
    baseline: 'middle',
    z: 4,
  })

  return { prims, view: box }
}

export const WordBuilder: Manipulative<WordBuilderP> = {
  kind: 'wordbuilder',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
