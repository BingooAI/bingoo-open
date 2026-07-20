/**
 * morpheme.ts — prefix + root + suffix (Cambridge Primary English: vocabulary &
 * spelling — word building, e.g. un + happy + ness). verbs: addPrefix(p) ·
 * addSuffix(s) · removeAffix(which) · highlight(part).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type MorphemeP = {
  root: string
  prefix: string | null
  suffix: string | null
  highlight: string | null
  labels: { prefix: string; suffix: string; root: string }
}

const DEFAULT: MorphemeP = {
  root: 'happy',
  prefix: null,
  suffix: null,
  highlight: null,
  labels: { prefix: 'prefix', suffix: 'suffix', root: 'root' },
}

function normalize(raw: unknown): MorphemeP {
  const r = (raw ?? {}) as Partial<MorphemeP>
  return {
    root: r.root ?? 'happy',
    prefix: r.prefix ?? null,
    suffix: r.suffix ?? null,
    highlight: r.highlight ?? null,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  }
}

const verbs: Manipulative<MorphemeP>['verbs'] = {
  addPrefix(p, args): VerbClip<MorphemeP> {
    return tween(p, { ...p, prefix: String(args?.p ?? args ?? ''), highlight: 'prefix' }, 0.5, 'easeOutBack')
  },
  addSuffix(p, args): VerbClip<MorphemeP> {
    return tween(p, { ...p, suffix: String(args?.s ?? args ?? ''), highlight: 'suffix' }, 0.5, 'easeOutBack')
  },
  removeAffix(p, args): VerbClip<MorphemeP> {
    const which = String(args?.which ?? args ?? 'prefix')
    return tween(p, which === 'suffix' ? { ...p, suffix: null } : { ...p, prefix: null }, 0.4, 'easeInCubic')
  },
  highlight(p, args): VerbClip<MorphemeP> {
    return tween(p, { ...p, highlight: String(args?.part ?? args ?? 'root') }, 0.35, 'easeOutCubic')
  },
}

function render(_params: MorphemeP, state: ManipState<MorphemeP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const parts: { text: string; key: string; color: string }[] = []
  if (P.prefix) parts.push({ text: P.prefix, key: 'prefix', color: TOK.accent2 })
  parts.push({ text: P.root, key: 'root', color: TOK.accent })
  if (P.suffix) parts.push({ text: P.suffix, key: 'suffix', color: TOK.good })

  const totalChars = parts.reduce((a, p) => a + p.text.length, 0)
  const size = Math.min(box.h * 0.22, (box.w * 0.85) / (totalChars * 0.66))
  const charW = size * 0.62,
    pad = size * 0.5,
    gap = size * 0.25
  const ws = parts.map((p) => p.text.length * charW + pad)
  const total = ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1)
  let x = (box.w - total) / 2
  const cy = box.h * 0.42
  const cardH = size * 1.6

  parts.forEach((p, i) => {
    const isNew =
      (seg.verb === 'addPrefix' && p.key === 'prefix') || (seg.verb === 'addSuffix' && p.key === 'suffix')
    const grow = isNew ? seg.p : 1
    const dim = P.highlight && P.highlight !== p.key ? 0.4 : 1
    prims.push({
      k: 'rect',
      x,
      y: cy - cardH / 2,
      w: ws[i]!,
      h: cardH,
      fill: p.color,
      color: TOK.ink,
      weight: 'sm',
      rx: size * 0.2,
      opacity: grow * dim,
      z: 2,
    })
    prims.push({
      k: 'label',
      x: x + ws[i]! / 2,
      y: cy,
      text: p.text,
      color: TOK.ink,
      size,
      align: 'middle',
      baseline: 'middle',
      opacity: grow * dim,
      z: 3,
    })
    prims.push({
      k: 'label',
      x: x + ws[i]! / 2,
      y: cy + cardH * 0.7,
      text: p.key === 'prefix' ? P.labels.prefix : p.key === 'suffix' ? P.labels.suffix : P.labels.root,
      color: TOK.soft,
      size: size * 0.4,
      align: 'middle',
      baseline: 'middle',
      opacity: dim,
      z: 3,
    })
    x += ws[i]! + gap
  })

  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.86,
    text: (P.prefix ?? '') + P.root + (P.suffix ?? ''),
    color: TOK.ink,
    size: size * 0.8,
    align: 'middle',
    baseline: 'middle',
    z: 4,
  })
  return { prims, view: box }
}

export const PrefixSuffix: Manipulative<MorphemeP> = {
  kind: 'morpheme',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
