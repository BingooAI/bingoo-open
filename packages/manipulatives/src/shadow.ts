/**
 * shadow.ts — light & shadow (Cambridge Primary Science: Physics — light, how
 * shadows form and change). A light source casts an object's shadow on the
 * ground; moving the light changes the shadow's direction & length.
 * verbs: moveLight(x) · showRays · setHeight(h).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, clamp01, TOK } from './util'

export type ShadowLabels = { caption: string }
export type ShadowP = { lightX: number; height: number; rays: boolean; labels: ShadowLabels }

const DEFAULT_LABELS: ShadowLabels = {
  caption: 'Low light → long shadow; high light → short shadow',
}
const DEFAULT: ShadowP = { lightX: 0.2, height: 0.4, rays: false, labels: DEFAULT_LABELS }

function normalize(raw: unknown): ShadowP {
  const r = (raw ?? {}) as Partial<ShadowP>
  return {
    lightX: clamp01(num(r.lightX ?? 0.2)),
    height: num(r.height ?? 0.4),
    rays: !!r.rays,
    labels: { ...DEFAULT_LABELS, ...(r.labels ?? {}) },
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const verbs: Manipulative<ShadowP>['verbs'] = {
  moveLight(p, args): VerbClip<ShadowP> {
    return tween(p, { ...p, lightX: clamp01(num(args?.x ?? args ?? 0.5)) }, 0.8, 'easeInOutCubic')
  },
  showRays(p): VerbClip<ShadowP> {
    return tween(p, { ...p, rays: true }, 0.5, 'easeOutCubic')
  },
  setHeight(p, args): VerbClip<ShadowP> {
    return tween(p, { ...p, height: num(args?.h ?? args ?? p.height) }, 0.5, 'spring')
  },
}

function render(_params: ShadowP, state: ManipState<ShadowP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const gy = box.h * 0.82
  const objX = box.w * 0.52
  const objTop = gy - P.height * box.h
  const animating = seg.verb === 'moveLight'
  const lightX = (animating ? lerp(seg.from.lightX, P.lightX, seg.p) : P.lightX) * box.w
  const lightY = box.h * 0.14

  // ground
  prims.push({
    k: 'line',
    x1: box.w * 0.05,
    y1: gy,
    x2: box.w * 0.95,
    y2: gy,
    color: TOK.faint,
    weight: 'md',
    z: 0,
  })

  // shadow: project object tip away from the light onto the ground
  // similar triangles: ground shadow tip x where ray from light through object-top hits ground
  const rayToTop = { x: objX - lightX, y: objTop - lightY }
  const scaleToGround = (gy - lightY) / (objTop - lightY || 1)
  const shadowTipX = lightX + rayToTop.x * scaleToGround
  prims.push({
    k: 'path',
    d: `M ${objX} ${gy} L ${shadowTipX} ${gy} L ${objX} ${gy}`,
    color: 'none',
    fill: 'none',
    z: 1,
  })
  prims.push({
    k: 'line',
    x1: objX,
    y1: gy,
    x2: shadowTipX,
    y2: gy,
    color: TOK.ink,
    weight: 'lg',
    opacity: 0.45,
    cap: 'round',
    z: 1,
  })

  // light source (sun)
  prims.push({
    k: 'circle',
    cx: lightX,
    cy: lightY,
    r: box.h * 0.06,
    fill: TOK.warn,
    color: TOK.ink,
    weight: 'sm',
    z: 3,
  })
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    prims.push({
      k: 'line',
      x1: lightX + Math.cos(a) * box.h * 0.08,
      y1: lightY + Math.sin(a) * box.h * 0.08,
      x2: lightX + Math.cos(a) * box.h * 0.1,
      y2: lightY + Math.sin(a) * box.h * 0.1,
      color: TOK.warn,
      weight: 'sm',
      z: 2,
    })
  }

  // object (post)
  prims.push({
    k: 'rect',
    x: objX - box.w * 0.02,
    y: objTop,
    w: box.w * 0.04,
    h: gy - objTop,
    fill: TOK.accent,
    color: TOK.ink,
    weight: 'md',
    z: 2,
  })

  // rays from light grazing the top → shadow tip
  if (P.rays || seg.verb === 'showRays') {
    const op = seg.verb === 'showRays' ? seg.p : 1
    prims.push({
      k: 'line',
      x1: lightX,
      y1: lightY,
      x2: shadowTipX,
      y2: gy,
      color: TOK.warn,
      weight: 'sm',
      dash: 6,
      opacity: 0.7 * op,
      z: 1,
    })
    prims.push({
      k: 'line',
      x1: lightX,
      y1: lightY,
      x2: objX,
      y2: objTop,
      color: TOK.warn,
      weight: 'sm',
      dash: 6,
      opacity: 0.5 * op,
      z: 1,
    })
  }

  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.94,
    text: P.labels.caption,
    color: TOK.soft,
    size: box.h * 0.05,
    align: 'middle',
    baseline: 'middle',
    z: 4,
  })
  return { prims, view: box }
}

export const ShadowLight: Manipulative<ShadowP> = {
  kind: 'shadow',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
