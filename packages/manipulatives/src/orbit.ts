/**
 * orbit.ts — Sun–planet orbit & day/night (Cambridge Primary Science: Earth &
 * Space). A planet circles the Sun; its lit half faces the Sun (day), the far
 * half is night. verbs: orbit(to) · showDayNight · spin.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, TOK } from './util';

export type OrbitP = {
  angle: number;
  dayNight: boolean;
  labels: { sun: string; dayNight: string; caption: string };
};

const DEFAULT: OrbitP = {
  angle: 0,
  dayNight: false,
  labels: { sun: 'Sun', dayNight: 'day | night', caption: 'Earth orbits the Sun' },
};

function normalize(raw: unknown): OrbitP {
  const r = (raw ?? {}) as Partial<OrbitP>;
  return {
    angle: num(r.angle ?? 0),
    dayNight: !!r.dayNight,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<OrbitP>['verbs'] = {
  orbit(p, args): VerbClip<OrbitP> {
    const to = args?.to !== undefined ? num(args.to) : p.angle + 360;
    return tween(p, { ...p, angle: to }, 1.2, 'easeInOutCubic');
  },
  showDayNight(p): VerbClip<OrbitP> {
    return tween(p, { ...p, dayNight: true }, 0.5, 'easeOutCubic');
  },
  spin(p): VerbClip<OrbitP> {
    return tween(p, { ...p, angle: p.angle + 90, dayNight: true }, 0.9, 'easeInOutCubic');
  },
};

function render(_params: OrbitP, state: ManipState<OrbitP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const cx = box.w / 2,
    cy = box.h * 0.52;
  const R = Math.min(box.w, box.h) * 0.34;
  const animating = seg.verb === 'orbit' || seg.verb === 'spin';
  const angDeg = animating ? lerp(seg.from.angle, P.angle, seg.p) : P.angle;
  const ang = angDeg * (Math.PI / 180) - Math.PI / 2;

  // orbit path
  prims.push({ k: 'circle', cx, cy, r: R, fill: 'none', color: TOK.faint, weight: 'sm', z: 0 });
  // Sun
  prims.push({
    k: 'circle',
    cx,
    cy,
    r: box.h * 0.09,
    fill: TOK.warn,
    color: TOK.ink,
    weight: 'sm',
    z: 2,
  });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    prims.push({
      k: 'line',
      x1: cx + Math.cos(a) * box.h * 0.11,
      y1: cy + Math.sin(a) * box.h * 0.11,
      x2: cx + Math.cos(a) * box.h * 0.14,
      y2: cy + Math.sin(a) * box.h * 0.14,
      color: TOK.warn,
      weight: 'sm',
      z: 1,
    });
  }
  prims.push({
    k: 'label',
    x: cx,
    y: cy,
    text: P.labels.sun,
    color: TOK.ink,
    size: box.h * 0.045,
    align: 'middle',
    baseline: 'middle',
    z: 3,
  });

  // planet
  const px = cx + Math.cos(ang) * R,
    py = cy + Math.sin(ang) * R;
  const pr = box.h * 0.07;
  prims.push({
    k: 'circle',
    cx: px,
    cy: py,
    r: pr,
    fill: TOK.accent2,
    color: TOK.ink,
    weight: 'md',
    z: 3,
  });
  if (P.dayNight || seg.verb === 'showDayNight') {
    // night half = the semicircle facing AWAY from the Sun
    const toSun = Math.atan2(cy - py, cx - px);
    const nightMid = toSun + Math.PI;
    const a0 = nightMid - Math.PI / 2,
      a1 = nightMid + Math.PI / 2;
    const x0 = px + Math.cos(a0) * pr,
      y0 = py + Math.sin(a0) * pr;
    const x1 = px + Math.cos(a1) * pr,
      y1 = py + Math.sin(a1) * pr;
    prims.push({
      k: 'path',
      d: `M ${x0} ${y0} A ${pr} ${pr} 0 0 1 ${x1} ${y1} Z`,
      fill: TOK.ink,
      opacity: 0.55,
      color: 'none',
      closed: true,
      z: 4,
    });
    prims.push({
      k: 'label',
      x: px,
      y: py - pr - box.h * 0.03,
      text: P.labels.dayNight,
      color: TOK.soft,
      size: box.h * 0.04,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    });
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
    z: 5,
  });
  return { prims, view: box };
}

export const OrbitModel: Manipulative<OrbitP> = {
  kind: 'orbit',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
