// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * alphabet.ts — alphabet arc (Cambridge Primary English: phonics/handwriting —
 * letter knowledge, upper/lower case, vowels). verbs: highlightLetter(ch) ·
 * matchCase(ch) · showVowels.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type AlphabetP = { highlight: string | null; match: string | null; vowels: boolean }

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])
const DEFAULT: AlphabetP = { highlight: null, match: null, vowels: false }

function normalize(raw: unknown): AlphabetP {
  const r = (raw ?? {}) as Partial<AlphabetP>
  return { highlight: r.highlight ?? null, match: r.match ?? null, vowels: !!r.vowels }
}

const verbs: Manipulative<AlphabetP>['verbs'] = {
  highlightLetter(p, args): VerbClip<AlphabetP> {
    return tween(
      p,
      { ...p, highlight: String(args?.ch ?? args ?? 'a').toLowerCase(), match: null },
      0.4,
      'easeOutBack',
    )
  },
  matchCase(p, args): VerbClip<AlphabetP> {
    return tween(
      p,
      {
        ...p,
        match: String(args?.ch ?? args ?? 'a').toLowerCase(),
        highlight: String(args?.ch ?? args ?? 'a').toLowerCase(),
      },
      0.5,
      'easeOutBack',
    )
  },
  showVowels(p): VerbClip<AlphabetP> {
    return tween(p, { ...p, vowels: true }, 0.6, 'easeOutCubic')
  },
}

function render(_params: AlphabetP, state: ManipState<AlphabetP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const cx = box.w / 2,
    cy = box.h * 0.92
  const R = Math.min(box.w * 0.46, box.h * 0.78)
  const size = R * 0.12

  LETTERS.forEach((ch, i) => {
    const ang = Math.PI - (i / (LETTERS.length - 1)) * Math.PI // left→right arc
    const x = cx + Math.cos(ang) * R
    const y = cy - Math.sin(ang) * R
    const hi = P.highlight === ch
    const vowel = P.vowels && VOWELS.has(ch)
    const grow = hi && (seg.verb === 'highlightLetter' || seg.verb === 'matchCase') ? seg.p : 1
    prims.push({
      k: 'circle',
      cx: x,
      cy: y,
      r: size * (hi ? 1.05 : 0.9),
      fill: hi ? TOK.warn : vowel ? TOK.accent : TOK.paper,
      color: TOK.ink,
      weight: 'sm',
      opacity: hi ? 0.5 + 0.5 * grow : 1,
      z: 2,
    })
    prims.push({
      k: 'label',
      x,
      y,
      text: ch,
      color: TOK.ink,
      size: size * 0.9,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    })
  })

  // case match: show the pair big in the centre
  if (P.match) {
    const grow = seg.verb === 'matchCase' ? seg.p : 1
    prims.push({
      k: 'label',
      x: cx - R * 0.14,
      y: cy - R * 0.5,
      text: P.match.toUpperCase(),
      color: TOK.accent,
      size: R * 0.3 * grow,
      align: 'middle',
      baseline: 'middle',
      opacity: grow,
      z: 4,
    })
    prims.push({
      k: 'label',
      x: cx + R * 0.14,
      y: cy - R * 0.5,
      text: P.match,
      color: TOK.accent2,
      size: R * 0.3 * grow,
      align: 'middle',
      baseline: 'middle',
      opacity: grow,
      z: 4,
    })
  }

  return { prims, view: box }
}

export const AlphabetArc: Manipulative<AlphabetP> = {
  kind: 'alphabet',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
