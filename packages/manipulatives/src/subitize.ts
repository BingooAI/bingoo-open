/**
 * subitize.ts — Subitize (nhìn nhanh số lượng — instant recognition of 1–10
 * without counting). A big dot card shows `count` dots in one of four
 * arrangements (dice / pairs / random / tenframe); the SAME number can be
 * rearranged and the dots glide between layouts — same quantity, different
 * look. Card can be face-down ("?"), flipped to reveal, and the numeral only
 * appears after a `reveal`. All "random" positions come from a fixed
 * hand-placed table — fully deterministic, no RNG. Ages 4–6.
 * verbs: show(count, arrangement) · hideCard · reveal · rearrange(arrangement)
 * · guess(n).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, lerp, TOK } from './util'
import { drawIcon } from './icons'

export type SubArrangement = 'dice' | 'pairs' | 'random' | 'tenframe'
export type SubitizeP = {
  count: number // 1..10
  arrangement: SubArrangement
  revealed: boolean // dots visible (card face-up)
  flash: boolean // "quick look" styling (warn border on the card)
  showNumeral: boolean // set by the reveal verb only
  guess: number | null // learner's answer (gradable)
  /** the object shown on the card — draws real stars/apples/… to match the
   *  narration instead of a plain dot (default keeps the classic dot). */
  icon: string
  /** media library: an image URL for the icon (overrides the built-in art). */
  assets?: Partial<Record<string, string>>
  assetMode?: boolean
}

const ARRS: SubArrangement[] = ['dice', 'pairs', 'random', 'tenframe']
const DEFAULT: SubitizeP = {
  count: 5,
  arrangement: 'dice',
  revealed: true,
  flash: false,
  showNumeral: false,
  guess: null,
  icon: 'dot',
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
function clampCount(v: number): number {
  return Math.max(1, Math.min(10, Math.floor(v)))
}
function arrOf(v: unknown): SubArrangement | null {
  return ARRS.includes(v as SubArrangement) ? (v as SubArrangement) : null
}

function normalize(raw: unknown): SubitizeP {
  const r = (raw ?? {}) as Partial<SubitizeP>
  return {
    count: clampCount(r.count == null ? DEFAULT.count : num(r.count)),
    arrangement: arrOf(r.arrangement) ?? 'dice',
    revealed: r.revealed == null ? true : !!r.revealed,
    flash: !!r.flash,
    showNumeral: !!r.showNumeral,
    guess: r.guess == null ? null : Math.max(0, Math.min(10, Math.floor(num(r.guess)))),
    icon: (typeof r.icon === 'string' && r.icon) || 'dot',
    assets: r.assets,
    assetMode: !!r.assetMode,
  }
}

/* -------------------------------------------------- deterministic layouts */
/** unit-square [0..1]² positions, hand-placed per count — NO RNG anywhere. */

const DICE: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.3, 0.2],
    [0.3, 0.5],
    [0.3, 0.8],
    [0.7, 0.2],
    [0.7, 0.5],
    [0.7, 0.8],
  ],
  7: [
    [0.3, 0.2],
    [0.3, 0.5],
    [0.3, 0.8],
    [0.7, 0.2],
    [0.7, 0.5],
    [0.7, 0.8],
    [0.5, 0.5],
  ],
  8: [
    [0.3, 0.14],
    [0.3, 0.38],
    [0.3, 0.62],
    [0.3, 0.86],
    [0.7, 0.14],
    [0.7, 0.38],
    [0.7, 0.62],
    [0.7, 0.86],
  ],
  9: [
    [0.25, 0.25],
    [0.5, 0.25],
    [0.75, 0.25],
    [0.25, 0.5],
    [0.5, 0.5],
    [0.75, 0.5],
    [0.25, 0.75],
    [0.5, 0.75],
    [0.75, 0.75],
  ],
  10: [
    [0.3, 0.1],
    [0.3, 0.3],
    [0.3, 0.5],
    [0.3, 0.7],
    [0.3, 0.9],
    [0.7, 0.1],
    [0.7, 0.3],
    [0.7, 0.5],
    [0.7, 0.7],
    [0.7, 0.9],
  ],
}

const RANDOM: Record<number, [number, number][]> = {
  1: [[0.5, 0.48]],
  2: [
    [0.32, 0.35],
    [0.68, 0.62],
  ],
  3: [
    [0.28, 0.3],
    [0.7, 0.4],
    [0.45, 0.72],
  ],
  4: [
    [0.25, 0.28],
    [0.65, 0.2],
    [0.35, 0.68],
    [0.75, 0.65],
  ],
  5: [
    [0.22, 0.25],
    [0.6, 0.16],
    [0.8, 0.5],
    [0.3, 0.6],
    [0.55, 0.8],
  ],
  6: [
    [0.2, 0.2],
    [0.55, 0.14],
    [0.82, 0.35],
    [0.25, 0.55],
    [0.5, 0.82],
    [0.78, 0.72],
  ],
  7: [
    [0.18, 0.25],
    [0.45, 0.14],
    [0.75, 0.2],
    [0.3, 0.5],
    [0.62, 0.45],
    [0.22, 0.8],
    [0.55, 0.74],
  ],
  8: [
    [0.18, 0.18],
    [0.5, 0.12],
    [0.8, 0.2],
    [0.25, 0.45],
    [0.6, 0.4],
    [0.86, 0.55],
    [0.35, 0.74],
    [0.68, 0.82],
  ],
  9: [
    [0.15, 0.2],
    [0.45, 0.12],
    [0.75, 0.18],
    [0.2, 0.45],
    [0.5, 0.4],
    [0.82, 0.45],
    [0.3, 0.72],
    [0.6, 0.68],
    [0.85, 0.8],
  ],
  10: [
    [0.15, 0.15],
    [0.42, 0.1],
    [0.7, 0.15],
    [0.9, 0.3],
    [0.2, 0.4],
    [0.5, 0.38],
    [0.78, 0.52],
    [0.3, 0.66],
    [0.58, 0.7],
    [0.82, 0.86],
  ],
}

export function layoutFor(a: SubArrangement, n: number): { x: number; y: number }[] {
  const c = clampCount(n)
  if (a === 'pairs') {
    const rows = Math.ceil(c / 2)
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < c; i++) {
      const row = Math.floor(i / 2),
        col = i % 2
      const alone = i === c - 1 && c % 2 === 1
      pts.push({ x: alone ? 0.5 : 0.35 + col * 0.3, y: (row + 0.5) / rows })
    }
    return pts
  }
  if (a === 'tenframe') {
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < c; i++) pts.push({ x: ((i % 5) + 0.5) / 5, y: i < 5 ? 0.3 : 0.7 })
    return pts
  }
  const table = a === 'random' ? RANDOM : DICE
  return table[c]!.map(([x, y]) => ({ x, y }))
}

/* ------------------------------------------------------------------ verbs */

const verbs: Manipulative<SubitizeP>['verbs'] = {
  /** deal a new card: dots pop in one-by-one, numeral hidden again. */
  show(p, args): VerbClip<SubitizeP> {
    const count = clampCount(num(args?.count ?? args) || p.count)
    const arrangement = arrOf(args?.arrangement) ?? p.arrangement
    return tween(
      p,
      { ...p, count, arrangement, revealed: true, showNumeral: false, guess: null },
      Math.min(0.8, 0.45 + 0.03 * count),
      'easeOutCubic',
    )
  },
  /** flip the card face-down (big "?"). */
  hideCard(p): VerbClip<SubitizeP> {
    return tween(p, { ...p, revealed: false, showNumeral: false }, 0.45, 'easeInOutCubic')
  },
  /** flip face-up + pop the numeral. */
  reveal(p): VerbClip<SubitizeP> {
    return tween(p, { ...p, revealed: true, showNumeral: true }, 0.6, 'easeInOutCubic')
  },
  /** the wow moment: SAME number, dots glide to a different arrangement. */
  rearrange(p, args): VerbClip<SubitizeP> {
    const want = arrOf(args?.arrangement ?? args)
    const arrangement = want ?? ARRS[(ARRS.indexOf(p.arrangement) + 1) % ARRS.length]!
    return tween(p, { ...p, arrangement }, 0.7, 'spring')
  },
  /** learner's answer (gradable). */
  guess(p, args): VerbClip<SubitizeP> {
    const n = Math.max(0, Math.min(10, Math.floor(num(args?.n ?? args))))
    return tween(p, { ...p, guess: n }, 0.3, 'easeOutBack')
  },
}

/* ----------------------------------------------------------------- render */

function render(_p: SubitizeP, state: ManipState<SubitizeP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const portrait = box.h > box.w

  const side = Math.min(box.w, box.h) * (portrait ? 0.78 : 0.64)
  const ccx = box.w / 2
  const ccy = portrait ? box.h * 0.42 : box.h * 0.44

  // card flip: horizontal squash |1−2p| — face swaps at the midpoint
  let sx = 1
  let faceUp = P.revealed
  if (seg.verb === 'reveal' || seg.verb === 'hideCard') {
    const q = clamp01(seg.p)
    sx = Math.abs(1 - 2 * q)
    faceUp = q < 0.5 ? seg.from.revealed : seg.to.revealed
  }
  const X = (x: number) => ccx + (x - ccx) * sx // squash toward the flip axis

  // the card
  prims.push({
    k: 'rect',
    x: X(ccx - side / 2),
    y: ccy - side / 2,
    w: side * sx,
    h: side,
    rx: side * 0.07,
    fill: faceUp ? TOK.paper : TOK.faint,
    color: P.flash ? TOK.warn : TOK.ink,
    weight: 'md',
    z: 1,
  })

  if (faceUp) {
    // dot positions (unit square → card interior)
    const pad = side * 0.15
    const inner = side - 2 * pad
    const x0 = ccx - side / 2 + pad,
      y0 = ccy - side / 2 + pad
    const cnt = clampCount(P.count)
    const toPts = layoutFor(P.arrangement, cnt)
    const gliding = seg.verb === 'rearrange' && seg.from.count === P.count
    const fromPts = gliding ? layoutFor(seg.from.arrangement, cnt) : toPts
    const r = side * 0.058

    for (let i = 0; i < cnt; i++) {
      const ux = lerp(fromPts[i]!.x, toPts[i]!.x, gliding ? clamp01(seg.p) : 1)
      const uy = lerp(fromPts[i]!.y, toPts[i]!.y, gliding ? clamp01(seg.p) : 1)
      let op = 1,
        rr = r
      if (seg.verb === 'show') {
        // deal in one-by-one, gated by seg.p
        const q = clamp01(seg.p * cnt - i)
        op = q
        rr = r * (0.3 + 0.7 * q)
      }
      if (op <= 0.01) continue
      drawIcon(prims, P.icon, X(x0 + ux * inner), y0 + uy * inner, rr * Math.max(0.05, sx * 0.4 + 0.6), op, {
        src: P.assets?.[P.icon],
        assetMode: P.assetMode,
      })
    }
  } else {
    // face-down: big "?"
    prims.push({
      k: 'label',
      x: ccx,
      y: ccy,
      text: '?',
      color: TOK.soft,
      size: side * 0.4,
      align: 'middle',
      baseline: 'middle',
      opacity: Math.max(0.05, sx),
      z: 3,
    })
  }

  // numeral — ONLY after a reveal verb ran; pops in during the second half of the flip
  if (P.showNumeral) {
    const pop = seg.verb === 'reveal' ? clamp01((seg.p - 0.5) * 2) : 1
    if (pop > 0.01) {
      const size = Math.min(box.h * 0.13, side * 0.3) * (0.4 + 0.6 * pop)
      prims.push({
        k: 'label',
        x: ccx,
        y: ccy + side / 2 + Math.min(box.h * 0.09, side * 0.2),
        text: String(P.count),
        color: TOK.accent,
        size,
        align: 'middle',
        baseline: 'middle',
        opacity: pop,
        z: 6,
      })
    }
  }

  // learner's guess (small, above the card)
  if (P.guess != null) {
    const pop = seg.verb === 'guess' ? clamp01(seg.p) : 1
    prims.push({
      k: 'label',
      x: ccx,
      y: ccy - side / 2 - Math.min(box.h * 0.055, side * 0.14),
      text: String(P.guess),
      color: TOK.accent2,
      size: Math.min(box.h * 0.075, side * 0.18) * (0.5 + 0.5 * pop),
      align: 'middle',
      baseline: 'middle',
      opacity: pop,
      z: 6,
    })
  }

  return { prims, view: box }
}

export const Subitize: Manipulative<SubitizeP> = {
  kind: 'subitize',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
