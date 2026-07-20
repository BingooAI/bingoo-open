/**
 * circuit.ts — simple electric circuit (Cambridge Primary Science: Physics —
 * electricity). A loop with a cell, a bulb and a switch. Closing the switch lets
 * current flow (dots travel the loop, bulb lights). verbs: closeSwitch ·
 * openSwitch · setBulbs(n).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type CircuitP = { closed: boolean; bulbs: number; labels: { closed: string; open: string } }

const DEFAULT: CircuitP = {
  closed: false,
  bulbs: 1,
  labels: { closed: 'Circuit closed — lamp on', open: 'Circuit open — lamp off' },
}

function normalize(raw: unknown): CircuitP {
  const r = (raw ?? {}) as Partial<CircuitP>
  return {
    closed: !!r.closed,
    bulbs: Math.max(1, Math.min(3, Math.floor(r.bulbs ?? 1))),
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<CircuitP>['verbs'] = {
  closeSwitch(p): VerbClip<CircuitP> {
    return tween(p, { ...p, closed: true }, 0.5, 'easeOutBack')
  },
  openSwitch(p): VerbClip<CircuitP> {
    return tween(p, { ...p, closed: false }, 0.4, 'easeInCubic')
  },
  setBulbs(p, args): VerbClip<CircuitP> {
    return tween(
      p,
      { ...p, bulbs: Math.max(1, Math.min(3, Math.floor(num(args?.n ?? args ?? 1)))) },
      0.4,
      'easeOutBack',
    )
  },
}

function render(_params: CircuitP, state: ManipState<CircuitP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const x0 = box.w * 0.2,
    x1 = box.w * 0.8,
    y0 = box.h * 0.25,
    y1 = box.h * 0.8
  const closing =
    seg.verb === 'closeSwitch' ? seg.p : seg.verb === 'openSwitch' ? 1 - seg.p : P.closed ? 1 : 0

  // wire loop (top has bulb gap, bottom has switch gap)
  const segs: [number, number, number, number][] = [
    [x0, y0, box.w * 0.42, y0],
    [box.w * 0.58, y0, x1, y0], // top with bulb gap
    [x1, y0, x1, y1], // right
    [x1, y1, box.w * 0.6, y1],
    [box.w * 0.44, y1, x0, y1], // bottom with switch gap
    [x0, y1, x0, y0], // left (cell)
  ]
  for (const [a, b, c, d] of segs)
    prims.push({ k: 'line', x1: a, y1: b, x2: c, y2: d, color: TOK.ink, weight: 'md', z: 1 })

  // cell (battery) on the left wire
  const cy = (y0 + y1) / 2
  prims.push({
    k: 'line',
    x1: x0 - box.w * 0.02,
    y1: cy - box.h * 0.05,
    x2: x0 - box.w * 0.02,
    y2: cy + box.h * 0.05,
    color: TOK.ink,
    weight: 'lg',
    z: 2,
  })
  prims.push({
    k: 'line',
    x1: x0 + box.w * 0.02,
    y1: cy - box.h * 0.025,
    x2: x0 + box.w * 0.02,
    y2: cy + box.h * 0.025,
    color: TOK.ink,
    weight: 'md',
    z: 2,
  })

  // bulb on top
  const bx = box.w * 0.5,
    by = y0
  const glow = closing
  prims.push({
    k: 'circle',
    cx: bx,
    cy: by,
    r: box.h * 0.06,
    fill: glow > 0.5 ? TOK.warn : TOK.paper,
    color: TOK.ink,
    weight: 'md',
    opacity: glow > 0.5 ? 0.4 + 0.6 * glow : 1,
    z: 3,
  })
  prims.push({
    k: 'path',
    d: `M ${bx - box.h * 0.03} ${by - box.h * 0.03} L ${bx + box.h * 0.03} ${by + box.h * 0.03} M ${bx + box.h * 0.03} ${by - box.h * 0.03} L ${bx - box.h * 0.03} ${by + box.h * 0.03}`,
    color: TOK.ink,
    weight: 'sm',
    z: 4,
  })
  if (glow > 0.6)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      prims.push({
        k: 'line',
        x1: bx + Math.cos(a) * box.h * 0.08,
        y1: by + Math.sin(a) * box.h * 0.08,
        x2: bx + Math.cos(a) * box.h * 0.11,
        y2: by + Math.sin(a) * box.h * 0.11,
        color: TOK.warn,
        weight: 'sm',
        opacity: (glow - 0.6) / 0.4,
        z: 4,
      })
    }

  // switch on the bottom (arm lifts when open, drops when closed)
  const sx = box.w * 0.52,
    sy = y1
  prims.push({
    k: 'circle',
    cx: sx,
    cy: sy,
    r: box.h * 0.012,
    fill: TOK.ink,
    color: TOK.ink,
    weight: 'sm',
    z: 3,
  })
  const openAng = (1 - closing) * -0.6 // radians up
  const armLen = box.w * 0.09
  prims.push({
    k: 'line',
    x1: sx,
    y1: sy,
    x2: sx - Math.cos(openAng) * armLen,
    y2: sy + Math.sin(openAng) * armLen,
    color: TOK.ink,
    weight: 'md',
    cap: 'round',
    z: 3,
  })
  prims.push({
    k: 'circle',
    cx: box.w * 0.43,
    cy: sy,
    r: box.h * 0.012,
    fill: TOK.ink,
    color: TOK.ink,
    weight: 'sm',
    z: 3,
  })

  // current dots travel the loop when closed (t-based, seekable)
  if (closing > 0.6) {
    const perim: [number, number][] = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ]
    const nDots = 8
    for (let k = 0; k < nDots; k++) {
      const u = (t * 0.25 + k / nDots) % 1
      const seg4 = Math.floor(u * 4)
      const f = u * 4 - seg4
      const A = perim[seg4]!,
        B = perim[(seg4 + 1) % 4]!
      prims.push({
        k: 'circle',
        cx: A[0] + (B[0] - A[0]) * f,
        cy: A[1] + (B[1] - A[1]) * f,
        r: box.h * 0.012,
        fill: TOK.accent,
        color: TOK.accent,
        weight: 'sm',
        opacity: (closing - 0.6) / 0.4,
        z: 5,
      })
    }
  }

  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.94,
    text: P.closed || closing > 0.6 ? P.labels.closed : P.labels.open,
    color: TOK.soft,
    size: box.h * 0.06,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  })
  return { prims, view: box }
}

export const Circuit: Manipulative<CircuitP> = {
  kind: 'circuit',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
