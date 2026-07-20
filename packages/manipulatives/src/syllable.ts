/**
 * syllable.ts — syllable splitting & stress (Cambridge Primary English: reading
 * longer words, spelling). verbs: split(syllables) · clap · stress(i).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, lerp, TOK } from './util'

export type SyllableP = {
  syllables: string[]
  split: boolean
  stress: number | null
  labels: { syllables: string }
}

const DEFAULT: SyllableP = {
  syllables: ['but', 'ter', 'fly'],
  split: false,
  stress: null,
  labels: { syllables: '{n} syllables' },
}

const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))

function normalize(raw: unknown): SyllableP {
  const r = (raw ?? {}) as Partial<SyllableP> & { word?: string }
  const syllables = r.syllables ?? (r.word ? [String(r.word)] : DEFAULT.syllables)
  return {
    syllables: [...syllables],
    split: !!r.split,
    stress: r.stress ?? null,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<SyllableP>['verbs'] = {
  split(p, args): VerbClip<SyllableP> {
    const syllables = args?.syllables ?? p.syllables
    return tween({ ...p, split: false }, { ...p, syllables, split: true }, 0.6, 'easeOutCubic')
  },
  clap(p): VerbClip<SyllableP> {
    return tween(p, { ...p }, Math.max(0.6, p.syllables.length * 0.35), 'linear')
  },
  stress(p, args): VerbClip<SyllableP> {
    return tween(p, { ...p, stress: Math.floor(num(args?.i ?? args ?? 0)) }, 0.4, 'easeOutBack')
  },
}

function render(_params: SyllableP, state: ManipState<SyllableP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const n = P.syllables.length
  const size = Math.min(box.h * 0.2, ((box.w * 0.8) / Math.max(4, P.syllables.join('').length)) * 1.4)
  const widths = P.syllables.map((s) => s.length * size * 0.62 + size * 0.6)
  const baseGap = size * 0.3
  const splitGap = size * 1.1
  const gapFrom = seg.from.split ? splitGap : baseGap
  const gapTo = P.split ? splitGap : baseGap
  const gap = seg.verb === 'split' ? lerp(gapFrom, gapTo, seg.p) : gapTo
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (n - 1)
  let x = (box.w - totalW) / 2
  const cy = box.h * 0.46

  // clap progression → which syllable's beat is active
  const clapActive = seg.verb === 'clap' ? Math.floor(clamp01(seg.p) * n) : -1

  P.syllables.forEach((s, i) => {
    const w = widths[i]!
    const stressed = P.stress === i
    const beat = i === clapActive
    prims.push({
      k: 'rect',
      x,
      y: cy - size * 0.75,
      w,
      h: size * 1.5,
      fill: beat ? TOK.warn : stressed ? TOK.accent : TOK.paper,
      color: TOK.ink,
      weight: 'sm',
      rx: size * 0.2,
      opacity: P.split || seg.verb === 'split' ? 1 : 0.0 + 1,
      z: 2,
    })
    prims.push({
      k: 'label',
      x: x + w / 2,
      y: cy,
      text: s,
      color: TOK.ink,
      size: stressed ? size * 1.15 : size,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    })
    // beat arc under each syllable
    prims.push({
      k: 'path',
      d: `M ${x + w * 0.2} ${cy + size} Q ${x + w / 2} ${cy + size * 1.5} ${x + w * 0.8} ${cy + size}`,
      fill: 'none',
      color: TOK.accent2,
      weight: 'sm',
      opacity: beat ? 1 : 0.5,
      z: 3,
    })
    x += w + gap
  })
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.86,
    text: fill(P.labels.syllables, { n }),
    color: TOK.soft,
    size: size * 0.7,
    align: 'middle',
    baseline: 'middle',
    z: 4,
  })

  return { prims, view: box }
}

export const SyllableSplit: Manipulative<SyllableP> = {
  kind: 'syllable',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
