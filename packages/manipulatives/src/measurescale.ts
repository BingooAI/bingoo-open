/**
 * measurescale.ts — pan balance (Cambridge: mass, comparing, equality). The beam
 * tilts by the difference of the two pans; equal → level. verbs: setLeft(n) ·
 * setRight(n) · addLeft(n) · addRight(n) · compare.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, clamp01, TOK } from './util';

export type MeasureScaleP = { left: number; right: number; showCompare: boolean };

const DEFAULT: MeasureScaleP = { left: 0, right: 0, showCompare: false };

function normalize(raw: unknown): MeasureScaleP {
  const r = (raw ?? {}) as Partial<MeasureScaleP>;
  return { left: num(r.left ?? 0), right: num(r.right ?? 0), showCompare: !!r.showCompare };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const D = 0.6;
const verbs: Manipulative<MeasureScaleP>['verbs'] = {
  setLeft(p, args): VerbClip<MeasureScaleP> {
    return tween(p, { ...p, left: num(args?.n ?? args ?? 0) }, D, 'spring');
  },
  setRight(p, args): VerbClip<MeasureScaleP> {
    return tween(p, { ...p, right: num(args?.n ?? args ?? 0) }, D, 'spring');
  },
  addLeft(p, args): VerbClip<MeasureScaleP> {
    return tween(p, { ...p, left: p.left + num(args?.n ?? args ?? 1) }, D, 'spring');
  },
  addRight(p, args): VerbClip<MeasureScaleP> {
    return tween(p, { ...p, right: p.right + num(args?.n ?? args ?? 1) }, D, 'spring');
  },
  compare(p): VerbClip<MeasureScaleP> {
    return tween(p, { ...p, showCompare: true }, 0.4, 'easeOutBack');
  },
};

function render(
  _params: MeasureScaleP,
  state: ManipState<MeasureScaleP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const animating =
    seg.verb === 'setLeft' ||
    seg.verb === 'setRight' ||
    seg.verb === 'addLeft' ||
    seg.verb === 'addRight';
  const left = animating ? lerp(seg.from.left, seg.to.left, seg.p) : seg.to.left;
  const right = animating ? lerp(seg.from.right, seg.to.right, seg.p) : seg.to.right;
  const prims: Prim[] = [];

  const cx = box.w / 2;
  const pivotY = box.h * 0.4;
  const beamLen = box.w * 0.66;
  const maxA = 14 * (Math.PI / 180);
  const angle =
    clamp01(Math.abs(right - left) / Math.max(left, right, 1)) * maxA * Math.sign(right - left);

  // stand
  prims.push({
    k: 'path',
    d: `M ${cx - box.w * 0.08} ${box.h * 0.9} L ${cx} ${pivotY} L ${cx + box.w * 0.08} ${box.h * 0.9} Z`,
    fill: TOK.faint,
    color: TOK.ink,
    weight: 'sm',
    closed: true,
    z: 1,
  });
  // beam
  const dx = (Math.cos(angle) * beamLen) / 2;
  const dy = (Math.sin(angle) * beamLen) / 2;
  const lx = cx - dx,
    ly = pivotY - dy;
  const rx = cx + dx,
    ry = pivotY + dy;
  prims.push({
    k: 'line',
    x1: lx,
    y1: ly,
    x2: rx,
    y2: ry,
    color: TOK.ink,
    weight: 'lg',
    cap: 'round',
    z: 3,
  });
  prims.push({
    k: 'circle',
    cx,
    cy: pivotY,
    r: box.h * 0.02,
    fill: TOK.ink,
    color: TOK.ink,
    weight: 'sm',
    z: 4,
  });

  // pans (hang straight down) + weight blocks
  const panDrop = box.h * 0.18;
  const drawPan = (px: number, py: number, val: number, color: string) => {
    const panY = py + panDrop;
    prims.push({
      k: 'line',
      x1: px,
      y1: py,
      x2: px,
      y2: panY,
      color: TOK.soft,
      weight: 'sm',
      z: 2,
    });
    prims.push({
      k: 'path',
      d: `M ${px - box.w * 0.09} ${panY} A ${box.w * 0.09} ${box.w * 0.05} 0 0 0 ${px + box.w * 0.09} ${panY}`,
      fill: 'none',
      color: TOK.ink,
      weight: 'sm',
      z: 2,
    });
    // stack of unit blocks
    const u = box.h * 0.03;
    const nBlocks = Math.min(8, Math.round(val));
    for (let i = 0; i < nBlocks; i++) {
      prims.push({
        k: 'rect',
        x: px - u,
        y: panY - (i + 1) * u * 1.1,
        w: u * 2,
        h: u,
        fill: color,
        color: TOK.ink,
        weight: 'sm',
        z: 3,
      });
    }
    prims.push({
      k: 'label',
      x: px,
      y: panY + box.h * 0.06,
      text: String(Math.round(val)),
      color: TOK.ink,
      size: box.h * 0.08,
      align: 'middle',
      baseline: 'middle',
      z: 4,
    });
  };
  drawPan(lx, ly, left, TOK.accent);
  drawPan(rx, ry, right, TOK.accent2);

  if (seg.to.showCompare) {
    const sym = left > right ? '>' : left < right ? '<' : '=';
    prims.push({
      k: 'label',
      x: cx,
      y: box.h * 0.12,
      text: `${Math.round(left)} ${sym} ${Math.round(right)}`,
      color: TOK.accent,
      size: box.h * 0.12,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    });
  }

  return { prims, view: box };
}

export const MeasureScale: Manipulative<MeasureScaleP> = {
  kind: 'measurescale',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
