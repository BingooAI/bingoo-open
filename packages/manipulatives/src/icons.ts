/**
 * icons.ts — shared themed-object renderer so counting kits draw the ACTUAL
 * object the lesson talks about (a star, an apple, a heart…) instead of a
 * generic dot. Matches the narration ("ghép các NGÔI SAO thành đôi" → real
 * stars) and makes each lesson look distinct. Pure prim output; a lesson may
 * also pass an image URL via `assets` to use its own art.
 */
import type { Prim } from './types'
import { TOK } from './util'

export type IconShape = 'dot' | 'circle' | 'star' | 'apple' | 'heart' | 'flower' | (string & {})

function starPath(cx: number, cy: number, r: number): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5
    const rad = i % 2 === 0 ? r : r * 0.44
    d += `${i === 0 ? 'M' : 'L'} ${cx + Math.cos(ang) * rad} ${cy + Math.sin(ang) * rad} `
  }
  return d + 'Z'
}
function heartPath(cx: number, cy: number, r: number): string {
  const t = cy - r * 0.35
  return `M ${cx} ${cy + r} C ${cx - r * 1.4} ${cy - r * 0.2} ${cx - r * 0.6} ${t - r} ${cx} ${cy - r * 0.35} C ${cx + r * 0.6} ${t - r} ${cx + r * 1.4} ${cy - r * 0.2} ${cx} ${cy + r} Z`
}

export type IconOpts = {
  color?: string
  ink?: string
  hi?: boolean
  src?: string
  assetMode?: boolean
}

/** Draw one themed object centred at (cx,cy) with radius r into `prims`.
 *  `color` overrides the object's fill (e.g. a leftover/odd counter → warn). */
export function drawIcon(
  prims: Prim[],
  shape: IconShape,
  cx: number,
  cy: number,
  r: number,
  op: number,
  opts: IconOpts = {},
): void {
  const ink = opts.ink ?? TOK.ink
  if (opts.hi) prims.push({ k: 'circle', cx, cy, r: r * 1.35, fill: TOK.warn, opacity: 0.3 * op, z: 2 })
  if (opts.src) {
    prims.push({
      k: 'image',
      x: cx - r,
      y: cy - r,
      w: r * 2,
      h: r * 2,
      ...(opts.assetMode ? { asset: opts.src } : { src: opts.src }),
      opacity: op,
      z: 3,
    })
    return
  }
  const c = opts.color
  switch (shape) {
    case 'star':
      prims.push({
        k: 'path',
        d: starPath(cx, cy, r),
        fill: c ?? TOK.warn,
        color: ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z: 3,
      })
      break
    case 'apple':
      prims.push({
        k: 'circle',
        cx,
        cy: cy + r * 0.1,
        r: r * 0.92,
        fill: c ?? TOK.accent,
        color: ink,
        weight: 'sm',
        opacity: op,
        z: 3,
      })
      prims.push({
        k: 'line',
        x1: cx,
        y1: cy - r * 0.7,
        x2: cx + r * 0.15,
        y2: cy - r * 1.05,
        color: ink,
        weight: 'sm',
        cap: 'round',
        opacity: op,
        z: 4,
      })
      prims.push({
        k: 'path',
        d: `M ${cx + r * 0.12} ${cy - r} Q ${cx + r * 0.75} ${cy - r * 1.15} ${cx + r * 0.7} ${cy - r * 0.6} Q ${cx + r * 0.35} ${cy - r * 0.7} ${cx + r * 0.12} ${cy - r} Z`,
        fill: TOK.good,
        color: ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z: 4,
      })
      break
    case 'heart':
      prims.push({
        k: 'path',
        d: heartPath(cx, cy, r * 0.85),
        fill: c ?? TOK.accent,
        color: ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z: 3,
      })
      break
    case 'flower':
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k / 5) * Math.PI * 2
        prims.push({
          k: 'circle',
          cx: cx + Math.cos(a) * r * 0.55,
          cy: cy + Math.sin(a) * r * 0.55,
          r: r * 0.45,
          fill: c ?? TOK.accent,
          color: ink,
          weight: 'sm',
          opacity: op,
          z: 3,
        })
      }
      prims.push({
        k: 'circle',
        cx,
        cy,
        r: r * 0.4,
        fill: TOK.warn,
        color: ink,
        weight: 'sm',
        opacity: op,
        z: 4,
      })
      break
    case 'circle':
    case 'dot':
    default:
      prims.push({
        k: 'circle',
        cx,
        cy,
        r: r * 0.92,
        fill: c ?? TOK.accent,
        color: ink,
        weight: 'sm',
        opacity: op,
        z: 3,
      })
      break
  }
}
