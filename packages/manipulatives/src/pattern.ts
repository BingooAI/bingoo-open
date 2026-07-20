/**
 * pattern.ts — PatternTrain (quy luật lặp: AB, AAB, ABC…). A train of coloured
 * shapes sits on a baseline; the repeating unit is bracketed and lettered
 * (A B / A A B …) so the child SEES the rule, then extends the train or fills
 * a hidden "?" slot. The correct item at index i is ALWAYS unit[i % unit.length]
 * — derived by code, never authored. Ages 4–6 (preschool / early primary).
 * verbs: extend(n) · hide(i) · revealHidden · setUnit(unit) · chooseNext(v).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { clamp01, TOK } from './util'

export type PatternP = {
  /** repeating unit: colour words (red/blue/green/yellow) or shape words
   *  (circle/square/triangle/star), 1–6 tokens. */
  unit: string[]
  /** how many items are currently laid out on the train. */
  items: number
  /** index rendered as a "?" slot (null = none). */
  hidden: number | null
  /** learner's pick for the NEXT item (gradable). */
  choice: string | null
  /** relative item size, 0.6–1.3. */
  sizeHint: number
}

/** token → shape + colour-token. Colour words draw circles; shape words draw
 *  that shape. Palette: red→accent, blue→accent2, green→good, yellow→warn. */
const STYLE: Record<string, { shape: 'circle' | 'square' | 'triangle' | 'star'; fill: string }> = {
  red: { shape: 'circle', fill: TOK.accent },
  blue: { shape: 'circle', fill: TOK.accent2 },
  green: { shape: 'circle', fill: TOK.good },
  yellow: { shape: 'circle', fill: TOK.warn },
  circle: { shape: 'circle', fill: TOK.accent },
  square: { shape: 'square', fill: TOK.accent2 },
  triangle: { shape: 'triangle', fill: TOK.good },
  star: { shape: 'star', fill: TOK.warn },
}

const MAX_ITEMS = 18
const DEFAULT: PatternP = {
  unit: ['red', 'blue'],
  items: 6,
  hidden: null,
  choice: null,
  sizeHint: 1,
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)))
}

function sanitizeToken(v: unknown): string | null {
  const s = String(v ?? '')
    .toLowerCase()
    .trim()
  return s in STYLE ? s : null
}
function sanitizeUnit(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const u = raw
    .map(sanitizeToken)
    .filter((x): x is string => x !== null)
    .slice(0, 6)
  return u.length >= 1 ? u : null
}

function normalize(raw: unknown): PatternP {
  const r = (raw ?? {}) as Partial<PatternP>
  const unit = sanitizeUnit(r.unit) ?? [...DEFAULT.unit]
  const items = clampInt(r.items == null ? DEFAULT.items : num(r.items), 1, MAX_ITEMS)
  const hidden = r.hidden == null ? null : clampInt(num(r.hidden), 0, items - 1)
  const sizeHint = Math.max(0.6, Math.min(1.3, num(r.sizeHint) || 1))
  return { unit, items, hidden, choice: sanitizeToken(r.choice), sizeHint }
}

/** THE rule: the correct token at position i. */
export function patternAt(p: PatternP, i: number): string {
  const n = p.unit.length
  return p.unit[((i % n) + n) % n]!
}

const verbs: Manipulative<PatternP>['verbs'] = {
  /** append n items that FOLLOW the rule; they pop in one-by-one. */
  extend(p, args): VerbClip<PatternP> {
    const n = Math.max(1, Math.min(8, Math.floor(num(args?.n ?? args)) || 1))
    const items = Math.min(MAX_ITEMS, p.items + n)
    return tween(p, { ...p, items }, Math.min(0.9, 0.3 + 0.15 * Math.max(1, items - p.items)), 'easeOutBack')
  },
  /** turn item i into a "?" slot. */
  hide(p, args): VerbClip<PatternP> {
    const i = clampInt(num(args?.i ?? args ?? p.items - 1), 0, p.items - 1)
    return tween(p, { ...p, hidden: i }, 0.4, 'easeOutCubic')
  },
  /** fill the "?" with the correct item (derived from the rule) + brief glow. */
  revealHidden(p): VerbClip<PatternP> {
    return tween(p, { ...p, hidden: null }, 0.55, 'easeOutBack')
  },
  /** change the repeating unit (existing items re-dress to the new rule). */
  setUnit(p, args): VerbClip<PatternP> {
    const unit = sanitizeUnit(args?.unit ?? args) ?? p.unit
    return tween(p, { ...p, unit, choice: null }, 0.45, 'easeOutCubic')
  },
  /** learner picks what comes NEXT (gradable via check). */
  chooseNext(p, args): VerbClip<PatternP> {
    const v = sanitizeToken(args?.v ?? args)
    return tween(p, { ...p, choice: v ?? p.choice }, 0.3, 'easeOutBack')
  },
}

/* ---------------------------------------------------------------- drawing */

function starPath(cx: number, cy: number, r: number): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5
    const rad = i % 2 === 0 ? r : r * 0.44
    d += `${i === 0 ? 'M' : 'L'} ${cx + Math.cos(ang) * rad} ${cy + Math.sin(ang) * rad} `
  }
  return d + 'Z'
}

function drawToken(prims: Prim[], token: string, cx: number, cy: number, r: number, op: number, z = 3) {
  if (op <= 0.01 || r <= 0.1) return
  const s = STYLE[token] ?? STYLE.circle!
  switch (s.shape) {
    case 'square':
      prims.push({
        k: 'rect',
        x: cx - r * 0.88,
        y: cy - r * 0.88,
        w: r * 1.76,
        h: r * 1.76,
        rx: r * 0.18,
        fill: s.fill,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z,
      })
      break
    case 'triangle':
      prims.push({
        k: 'path',
        d: `M ${cx} ${cy - r} L ${cx + r * 0.95} ${cy + r * 0.78} L ${cx - r * 0.95} ${cy + r * 0.78} Z`,
        fill: s.fill,
        color: TOK.ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z,
      })
      break
    case 'star':
      prims.push({
        k: 'path',
        d: starPath(cx, cy, r * 1.05),
        fill: s.fill,
        color: TOK.ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z,
      })
      break
    default:
      prims.push({
        k: 'circle',
        cx,
        cy,
        r: r * 0.92,
        fill: s.fill,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z,
      })
  }
}

function dashedBox(prims: Prim[], cx: number, cy: number, half: number, color: string, op: number, z = 2) {
  if (op <= 0.01) return
  const x0 = cx - half,
    y0 = cy - half,
    x1 = cx + half,
    y1 = cy + half
  prims.push({
    k: 'path',
    d: `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`,
    fill: 'none',
    color,
    weight: 'sm',
    dash: half * 0.35,
    closed: true,
    opacity: op,
    z,
  })
}

/** pattern letters: distinct tokens (in order of first appearance) → A, B, C… */
function lettersOf(unit: string[]): string[] {
  const order: string[] = []
  for (const u of unit) if (!order.includes(u)) order.push(u)
  return unit.map((u) => String.fromCharCode(65 + order.indexOf(u)))
}

function render(_p: PatternP, state: ManipState<PatternP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const portrait = box.h > box.w

  const total = P.items + 1 // +1 = the "what comes next?" slot
  const perRow = portrait ? Math.ceil(total / 2) : total
  const rows = Math.ceil(total / perRow)
  const rowHFactor = 1.7
  const cell = Math.min((box.w * 0.92) / perRow, (box.h * 0.8) / (rows * rowHFactor))
  const rowH = cell * rowHFactor
  const ox = (box.w - perRow * cell) / 2
  const oy = (box.h - rows * rowH) / 2
  const r = cell * 0.34 * P.sizeHint

  const posOf = (i: number) => {
    const row = Math.floor(i / perRow),
      col = i % perRow
    return {
      x: ox + col * cell + cell / 2,
      y: oy + row * rowH + cell * 0.5,
      rowY: oy + row * rowH,
    }
  }

  // baseline under each row (the "train track")
  for (let rr = 0; rr < rows; rr++) {
    const inRow = Math.min(perRow, total - rr * perRow)
    const y = oy + rr * rowH + cell * 0.98
    prims.push({
      k: 'line',
      x1: ox,
      y1: y,
      x2: ox + inRow * cell,
      y2: y,
      color: TOK.soft,
      weight: 'sm',
      cap: 'round',
      opacity: 0.8,
      z: 1,
    })
  }

  const letters = lettersOf(P.unit)
  const addBase = seg.verb === 'extend' ? seg.from.items : P.items
  const added = Math.max(1, P.items - addBase)

  for (let i = 0; i < P.items; i++) {
    const c = posOf(i)
    // entry stagger for freshly extended items
    let op = 1,
      scale = 1
    if (seg.verb === 'extend' && i >= addBase) {
      const q = clamp01(seg.p * added - (i - addBase))
      op = q
      scale = 0.3 + 0.7 * q
    }

    const hiddenHere = P.hidden === i
    const hiding = seg.verb === 'hide' && hiddenHere && seg.from.hidden !== i
    const revealing = seg.verb === 'revealHidden' && seg.from.hidden === i && P.hidden === null

    if (hiddenHere) {
      // "?" slot: dashed pulsing box (the pulse is a pure function of t)
      const qm = hiding ? seg.p : 1
      if (hiding) drawToken(prims, patternAt(P, i), c.x, c.y, r, (1 - seg.p) * op)
      const pulse = 0.55 + 0.35 * Math.sin(t * 3.5)
      dashedBox(prims, c.x, c.y, r * 1.15, TOK.ink, qm * op, 2)
      prims.push({
        k: 'label',
        x: c.x,
        y: c.y,
        text: '?',
        color: TOK.ink,
        size: r * 1.5,
        align: 'middle',
        baseline: 'middle',
        opacity: pulse * qm * op,
        z: 4,
      })
    } else {
      if (revealing) {
        // glow + grow-in of the CORRECT item (derived from the rule)
        prims.push({
          k: 'circle',
          cx: c.x,
          cy: c.y,
          r: r * 1.55,
          fill: TOK.warn,
          opacity: Math.sin(Math.PI * clamp01(seg.p)) * 0.4,
          z: 2,
        })
        dashedBox(prims, c.x, c.y, r * 1.15, TOK.ink, 1 - seg.p, 2)
        op = seg.p
        scale = 0.3 + 0.7 * seg.p
      }
      if (seg.verb === 'setUnit' && i < seg.from.items) {
        // re-dress: old token fades out while the new rule's token fades in
        drawToken(prims, patternAt(seg.from, i), c.x, c.y, r, (1 - seg.p) * op)
        drawToken(prims, patternAt(P, i), c.x, c.y, r * scale, seg.p * op)
      } else {
        drawToken(prims, patternAt(P, i), c.x, c.y, r * scale, op)
      }
      // letter under each item — shows the rule repeating (A B A B …)
      prims.push({
        k: 'label',
        x: c.x,
        y: c.rowY + cell * 1.22,
        text: letters[i % letters.length]!,
        color: TOK.soft,
        size: cell * 0.22,
        align: 'middle',
        baseline: 'middle',
        opacity: 0.9 * op,
        z: 4,
      })
    }
  }

  // bracket + letters under the FIRST occurrence of the unit
  if (P.items >= P.unit.length && P.unit.length <= perRow) {
    const y0 = oy + cell * 1.42
    const x0 = ox + cell * 0.08,
      x1 = ox + P.unit.length * cell - cell * 0.08
    const tick = cell * 0.12
    prims.push({
      k: 'path',
      d: `M ${x0} ${y0 - tick} L ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y0 - tick}`,
      fill: 'none',
      color: TOK.accent,
      weight: 'sm',
      opacity: 0.95,
      z: 5,
    })
    prims.push({
      k: 'label',
      x: (x0 + x1) / 2,
      y: y0 + cell * 0.18,
      text: letters.join(''),
      color: TOK.accent,
      size: cell * 0.24,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    })
  }

  // the "next?" slot at the end of the train
  const nx = posOf(P.items)
  dashedBox(prims, nx.x, nx.y, r * 1.15, TOK.soft, 0.8, 2)
  if (P.choice) {
    const pop = seg.verb === 'chooseNext' ? clamp01(seg.p) : 1
    if (seg.verb === 'chooseNext' && seg.from.choice && seg.from.choice !== P.choice) {
      drawToken(prims, seg.from.choice, nx.x, nx.y, r, 1 - seg.p, 5)
    }
    drawToken(prims, P.choice, nx.x, nx.y, r * (0.3 + 0.7 * pop), pop, 5)
  }

  return { prims, view: box }
}

export const PatternTrain: Manipulative<PatternP> = {
  kind: 'pattern',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
