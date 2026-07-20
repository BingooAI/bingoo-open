/**
 * clock.ts — analog clock (kit #8). params: { hour, minute }.
 * verbs: setTime(h,m) · advance(min) · showAngle · sweep(from,to).
 * Hand angles are computed from time, so hands are baked-seekable rotations.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, TOK } from './util';

export type ClockP = {
  hour: number;
  minute: number;
  showAngle: boolean;
  sweep: [number, number] | null; // minute-hand sweep [fromMin,toMin]
};

const DEFAULT: ClockP = { hour: 3, minute: 0, showAngle: false, sweep: null };

function normalize(raw: unknown): ClockP {
  const r = (raw ?? {}) as Partial<ClockP>;
  return {
    hour: ((Math.floor(r.hour ?? 3) % 12) + 12) % 12,
    minute: ((Math.floor(r.minute ?? 0) % 60) + 60) % 60,
    showAngle: !!r.showAngle,
    sweep: r.sweep ?? null,
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function totalMin(p: ClockP): number {
  return p.hour * 60 + p.minute;
}
function fromTotal(tm: number): { hour: number; minute: number } {
  const m = ((Math.round(tm) % 720) + 720) % 720;
  return { hour: Math.floor(m / 60), minute: m % 60 };
}

const verbs: Manipulative<ClockP>['verbs'] = {
  setTime(p, args): VerbClip<ClockP> {
    const h = ((Math.floor(num(args?.h ?? p.hour)) % 12) + 12) % 12;
    const m = ((Math.floor(num(args?.m ?? p.minute)) % 60) + 60) % 60;
    return tween(p, { ...p, hour: h, minute: m }, 0.6, 'spring');
  },
  advance(p, args): VerbClip<ClockP> {
    const mins = Math.floor(num(args?.min ?? args ?? 15));
    const nt = fromTotal(totalMin(p) + mins);
    return tween(p, { ...p, ...nt }, 0.7, 'easeInOutCubic');
  },
  showAngle(p): VerbClip<ClockP> {
    return tween(p, { ...p, showAngle: true }, 0.4, 'easeOutCubic');
  },
  sweep(p, args): VerbClip<ClockP> {
    const from = Math.floor(num(args?.from ?? 0));
    const to = Math.floor(num(args?.to ?? 30));
    return tween(
      p,
      { ...p, minute: ((to % 60) + 60) % 60, sweep: [from, to] },
      0.8,
      'easeInOutCubic',
    );
  },
};

function render(_params: ClockP, state: ManipState<ClockP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const prims: Prim[] = [];
  const cx = box.w / 2;
  // sit the face a touch high so the digital readout below always fits the box
  const cy = box.h * 0.45;
  const R = Math.min(box.w, box.h * 0.86) * 0.42;

  // continuous time interpolation (setTime/advance rotate the hands)
  const animVerbs = seg.verb === 'setTime' || seg.verb === 'advance' || seg.verb === 'sweep';
  const tmFrom = totalMin(seg.from);
  const tmTo = totalMin(seg.to);
  // choose shortest direction for advance/setTime feels natural; advance is additive
  const tm = animVerbs ? lerp(tmFrom, tmTo, seg.p) : totalMin(seg.to);
  const hour = (tm / 60) % 12;
  const minute = tm % 60;

  prims.push({ k: 'circle', cx, cy, r: R, fill: TOK.paper, color: TOK.ink, weight: 'md', z: 1 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r0 = R * 0.86;
    prims.push({
      k: 'line',
      x1: cx + Math.cos(a) * r0,
      y1: cy + Math.sin(a) * r0,
      x2: cx + Math.cos(a) * R * 0.96,
      y2: cy + Math.sin(a) * R * 0.96,
      color: TOK.soft,
      weight: 'sm',
      z: 2,
    });
    prims.push({
      k: 'label',
      x: cx + Math.cos(a) * R * 0.74,
      y: cy + Math.sin(a) * R * 0.74,
      text: String(i === 0 ? 12 : i),
      color: TOK.ink,
      size: R * 0.16,
      align: 'middle',
      baseline: 'middle',
      z: 2,
    });
  }

  const minA = (minute / 60) * Math.PI * 2 - Math.PI / 2;
  // `hour` is already fractional (derived from tm, which includes the minutes),
  // so DON'T add minute/60 again — that double-counted the minutes and pushed
  // the hour hand ~1 hour ahead (e.g. 03:55 showed near 5 instead of near 4).
  const hourA = (hour / 12) * Math.PI * 2 - Math.PI / 2;

  // optional angle wedge from 12 to minute hand
  if (seg.to.showAngle || seg.verb === 'showAngle') {
    const op = seg.verb === 'showAngle' ? seg.p : 1;
    const a0 = -Math.PI / 2;
    const large = minA - a0 > Math.PI ? 1 : 0;
    const rr = R * 0.5;
    prims.push({
      k: 'path',
      d: `M ${cx} ${cy} L ${cx + Math.cos(a0) * rr} ${cy + Math.sin(a0) * rr} A ${rr} ${rr} 0 ${large} 1 ${cx + Math.cos(minA) * rr} ${cy + Math.sin(minA) * rr} Z`,
      fill: TOK.warn,
      opacity: 0.3 * op,
      closed: true,
      z: 3,
    });
  }

  // hands
  prims.push({
    k: 'line',
    x1: cx,
    y1: cy,
    x2: cx + Math.cos(hourA) * R * 0.5,
    y2: cy + Math.sin(hourA) * R * 0.5,
    color: TOK.ink,
    weight: 'lg',
    cap: 'round',
    z: 5,
  });
  prims.push({
    k: 'line',
    x1: cx,
    y1: cy,
    x2: cx + Math.cos(minA) * R * 0.78,
    y2: cy + Math.sin(minA) * R * 0.78,
    color: TOK.accent,
    weight: 'md',
    cap: 'round',
    z: 5,
  });
  prims.push({
    k: 'circle',
    cx,
    cy,
    r: R * 0.05,
    fill: TOK.ink,
    color: TOK.ink,
    weight: 'sm',
    z: 6,
  });

  const disp = fromTotal(tm);
  const labelY = Math.min(cy + R * 1.2, box.h * 0.97);
  prims.push({
    k: 'label',
    x: cx,
    y: labelY,
    text: `${String(disp.hour === 0 ? 12 : disp.hour).padStart(2, '0')}:${String(disp.minute).padStart(2, '0')}`,
    color: TOK.ink,
    size: R * 0.22,
    align: 'middle',
    baseline: 'middle',
    z: 6,
  });

  return { prims, view: box };
}

export const Clock: Manipulative<ClockP> = {
  kind: 'clock',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
