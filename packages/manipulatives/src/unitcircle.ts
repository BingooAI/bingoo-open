/**
 * unitcircle.ts — UnitCircle (đường tròn lượng giác, THPT 15–18). The trig
 * unit circle: a radius GLIDES to any angle (linear in angle value — never the
 * "short way", so 350°→10° sweeps back through 180°) while sin (vertical drop,
 * accent), cos (horizontal run, accent2) and tan (the segment cut on the
 * tangent line x = 1, warn) all track the CURRENT interpolated angle — every
 * displayed value is computed live, so a scrubbed frame reads true. Angle
 * labels in degrees or clean multiples of π (π/6, π/4, 2π/3 …). Quadrant
 * sin/cos signs shown faintly, current quadrant emphasised.
 * verbs: setAngle(deg) · showSin() · showCos() · showTan() · toRadians() · toDegrees()
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { fmt, lerp, TOK } from './util';

export type UnitCircleP = {
  angle: number; // degrees, counterclockwise from the positive x-axis
  showSin: boolean;
  showCos: boolean;
  showTan: boolean;
  radians: boolean; // label mode: multiples of π instead of degrees
  sweep: boolean; // show the angle arc swept from 0°
};

const DEFAULT: UnitCircleP = {
  angle: 45,
  showSin: true,
  showCos: true,
  showTan: false,
  radians: false,
  sweep: true,
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
const clampDeg = (d: number) => Math.max(-1080, Math.min(1080, d));

function normalize(raw: unknown): UnitCircleP {
  const r = (raw ?? {}) as Partial<UnitCircleP>;
  return {
    angle: clampDeg(r.angle == null ? 45 : num(r.angle)),
    showSin: r.showSin == null ? true : !!r.showSin,
    showCos: r.showCos == null ? true : !!r.showCos,
    showTan: !!r.showTan,
    radians: !!r.radians,
    sweep: r.sweep == null ? true : !!r.sweep,
  };
}

/** deg from args that may be {deg}, bare number/string, or garbage. */
function argDeg(args: unknown, fallback: number): number {
  const o = args && typeof args === 'object' ? (args as Record<string, unknown>) : null;
  if (o && o.deg != null) return num(o.deg);
  if (typeof args === 'number' || typeof args === 'string') return num(args);
  return fallback;
}
function argOn(args: unknown, current: boolean): boolean {
  const o = args && typeof args === 'object' ? (args as Record<string, unknown>) : null;
  if (o && o.on != null) return !!o.on;
  return !current; // default: toggle
}

const verbs: Manipulative<UnitCircleP>['verbs'] = {
  setAngle(p, args): VerbClip<UnitCircleP> {
    return tween(p, { ...p, angle: clampDeg(argDeg(args, p.angle)) }, 0.7, 'easeInOutCubic');
  },
  showSin(p, args): VerbClip<UnitCircleP> {
    return tween(p, { ...p, showSin: argOn(args, p.showSin) }, 0.35, 'easeOutCubic');
  },
  showCos(p, args): VerbClip<UnitCircleP> {
    return tween(p, { ...p, showCos: argOn(args, p.showCos) }, 0.35, 'easeOutCubic');
  },
  showTan(p, args): VerbClip<UnitCircleP> {
    return tween(p, { ...p, showTan: argOn(args, p.showTan) }, 0.35, 'easeOutCubic');
  },
  toRadians(p): VerbClip<UnitCircleP> {
    return tween(p, { ...p, radians: true }, 0.3, 'easeOutCubic');
  },
  toDegrees(p): VerbClip<UnitCircleP> {
    return tween(p, { ...p, radians: false }, 0.3, 'easeOutCubic');
  },
};

/* ------------------------------------------------------------------ helpers */

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

/** "45°" or clean π-fraction ("π/4", "2π/3", "-π/2"); decimal ×π fallback. */
export function angleLabel(deg: number, radians: boolean): string {
  if (!radians) return `${Math.round(deg)}°`;
  const n = Math.round(deg);
  if (Math.abs(deg - n) < 1e-6 && n !== 0) {
    const g = gcd(n, 180);
    const nu = n / g,
      de = 180 / g;
    if (de <= 12) {
      const core = de === 1 ? 'π' : `π/${de}`;
      if (nu === 1) return core;
      if (nu === -1) return `-${core}`;
      return de === 1 ? `${nu}π` : `${nu}π/${de}`;
    }
  }
  if (Math.abs(deg) < 1e-6) return '0';
  return `${fmt(deg / 180)}π`;
}

/** Circle geometry — keep in sync with the "unitcircle" onDrag in interactions. */
function geom(box: { w: number; h: number }) {
  const portrait = box.h > box.w;
  const cx = portrait ? box.w * 0.5 : box.w * 0.34;
  const cy = portrait ? box.h * 0.3 : box.h * 0.5;
  const r = portrait ? Math.min(box.w * 0.38, box.h * 0.26) : Math.min(box.w * 0.26, box.h * 0.4);
  return { portrait, cx, cy, r };
}

/* ------------------------------------------------------------------- render */

function render(
  _params: UnitCircleP,
  state: ManipState<UnitCircleP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const A = seg.from,
    B = seg.to,
    p = seg.p;
  const { portrait, cx, cy, r } = geom(box);
  const S = Math.min(box.w, box.h);
  const prims: Prim[] = [];

  // live interpolated angle → every value below derives from it
  const deg = lerp(A.angle, B.angle, p);
  const rad = (deg * Math.PI) / 180;
  const sinv = Math.sin(rad);
  const cosv = Math.cos(rad);
  const tanRaw = cosv === 0 ? (sinv >= 0 ? Infinity : -Infinity) : sinv / cosv;
  const tanFin = Number.isFinite(tanRaw) ? tanRaw : sinv >= 0 ? 1e6 : -1e6;
  const px = cx + r * cosv;
  const py = cy - r * sinv; // SVG y-axis is DOWN: counterclockwise ⇒ y = cy − r·sin

  const flag = (a: boolean, b: boolean) => (a === b ? (b ? 1 : 0) : b ? p : 1 - p);
  const sinOp = flag(A.showSin, B.showSin);
  const cosOp = flag(A.showCos, B.showCos);
  const tanOp = flag(A.showTan, B.showTan);
  const sweepOp = flag(A.sweep, B.sweep);

  // axes + unit ticks
  prims.push({
    k: 'line',
    x1: cx - r * 1.22,
    y1: cy,
    x2: cx + r * 1.3,
    y2: cy,
    color: TOK.soft,
    weight: 'sm',
    z: 1,
  });
  prims.push({
    k: 'line',
    x1: cx,
    y1: cy - r * 1.18,
    x2: cx,
    y2: cy + r * 1.18,
    color: TOK.soft,
    weight: 'sm',
    z: 1,
  });
  const tick = S * 0.012;
  for (const [tx, ty, lbl, lx, ly] of [
    [cx + r, cy, '1', cx + r, cy + S * 0.045],
    [cx - r, cy, '-1', cx - r, cy + S * 0.045],
    [cx, cy - r, '1', cx - S * 0.03, cy - r],
    [cx, cy + r, '-1', cx - S * 0.035, cy + r],
  ] as const) {
    prims.push({
      k: 'line',
      x1: tx - (ty === cy ? 0 : tick),
      y1: ty - (ty === cy ? tick : 0),
      x2: tx + (ty === cy ? 0 : tick),
      y2: ty + (ty === cy ? tick : 0),
      color: TOK.soft,
      weight: 'sm',
      z: 1,
    });
    prims.push({
      k: 'label',
      x: lx,
      y: ly,
      text: lbl,
      color: TOK.soft,
      size: S * 0.035,
      align: 'middle',
      baseline: 'middle',
      z: 2,
    });
  }

  // the circle
  prims.push({ k: 'circle', cx, cy, r, fill: 'none', color: TOK.ink, weight: 'sm', z: 2 });

  // quadrant sin/cos signs (faint; current quadrant emphasised)
  const qNow = Math.floor((((deg % 360) + 360) % 360) / 90) % 4;
  const QS: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  QS.forEach(([qx, qy], i) => {
    const active = i === qNow;
    const bx = cx + qx * r * 0.55;
    const by = cy - qy * r * 0.55;
    const op = active ? 0.85 : 0.25;
    prims.push({
      k: 'label',
      x: bx - S * 0.02,
      y: by,
      text: qy > 0 ? '+' : '-',
      color: TOK.accent,
      size: S * 0.05,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 2,
    });
    prims.push({
      k: 'label',
      x: bx + S * 0.02,
      y: by,
      text: qx > 0 ? '+' : '-',
      color: TOK.accent2,
      size: S * 0.05,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 2,
    });
  });

  // swept angle arc from 0° to the live angle (handles negatives + >360)
  if (sweepOp > 0.01 && Math.abs(deg) > 0.5) {
    const rA = r * 0.24;
    const N = Math.max(16, Math.min(256, Math.ceil(Math.abs(deg) / 4)));
    let d = '';
    for (let i = 0; i <= N; i++) {
      const a = (rad * i) / N;
      d += `${i === 0 ? 'M' : 'L'} ${(cx + Math.cos(a) * rA).toFixed(2)} ${(cy - Math.sin(a) * rA).toFixed(2)} `;
    }
    prims.push({
      k: 'path',
      d,
      fill: 'none',
      color: TOK.warn,
      weight: 'md',
      opacity: sweepOp,
      z: 4,
    });
  }
  // angle value label near the mid-sweep
  const midA = rad / 2;
  prims.push({
    k: 'label',
    x: cx + Math.cos(midA) * r * 0.45,
    y: cy - Math.sin(midA) * r * 0.45,
    text: angleLabel(deg, B.radians),
    color: TOK.ink,
    size: S * 0.05,
    align: 'middle',
    baseline: 'middle',
    z: 6,
  });

  // cos: horizontal run along the axis (drawn under the sin drop)
  if (cosOp > 0.01) {
    prims.push({
      k: 'line',
      x1: cx,
      y1: cy,
      x2: px,
      y2: cy,
      color: TOK.accent2,
      weight: 'lg',
      cap: 'round',
      opacity: cosOp,
      z: 3,
    });
    if (Math.abs(cosv) > 0.05) {
      prims.push({
        k: 'label',
        x: (cx + px) / 2,
        y: cy + (sinv >= 0 ? S * 0.045 : -S * 0.045),
        text: fmt(cosv),
        color: TOK.accent2,
        size: S * 0.042,
        align: 'middle',
        baseline: 'middle',
        opacity: cosOp,
        z: 6,
      });
    }
  }
  // sin: vertical drop from the point to the x-axis
  if (sinOp > 0.01) {
    prims.push({
      k: 'line',
      x1: px,
      y1: cy,
      x2: px,
      y2: py,
      color: TOK.accent,
      weight: 'lg',
      cap: 'round',
      opacity: sinOp,
      z: 4,
    });
    if (Math.abs(sinv) > 0.05) {
      prims.push({
        k: 'label',
        x: px + (cosv >= 0 ? S * 0.02 : -S * 0.02),
        y: (cy + py) / 2,
        text: fmt(sinv),
        color: TOK.accent,
        size: S * 0.042,
        align: cosv >= 0 ? 'start' : 'end',
        baseline: 'middle',
        opacity: sinOp,
        z: 6,
      });
    }
  }

  // tan: the vertical tangent line at x = 1 and the segment it cuts
  if (tanOp > 0.01) {
    const tanC = Math.max(-3, Math.min(3, tanFin)); // clamp the DRAWN segment
    let tanY = cy - r * tanC;
    tanY = Math.max(box.h * 0.03, Math.min(box.h * 0.97, tanY));
    const far = Math.abs(tanFin) > 3;
    prims.push({
      k: 'line',
      x1: cx + r,
      y1: Math.max(box.h * 0.03, cy - r * 1.18),
      x2: cx + r,
      y2: Math.min(box.h * 0.97, cy + r * 1.18),
      color: TOK.faint,
      weight: 'sm',
      dash: 5,
      opacity: tanOp,
      z: 2,
    });
    // extended diameter through the point meets the tangent line at y = −tan
    prims.push({
      k: 'line',
      x1: cx,
      y1: cy,
      x2: cx + r,
      y2: tanY,
      color: TOK.warn,
      weight: 'sm',
      dash: 6,
      opacity: tanOp * 0.55,
      z: 3,
    });
    prims.push({
      k: 'line',
      x1: cx + r,
      y1: cy,
      x2: cx + r,
      y2: tanY,
      color: TOK.warn,
      weight: 'lg',
      cap: 'round',
      dash: far ? 8 : undefined,
      opacity: tanOp,
      z: 4,
    });
    const tanTxt = Math.abs(tanFin) > 99.5 ? (tanFin > 0 ? '∞' : '-∞') : fmt(tanFin);
    prims.push({
      k: 'label',
      x: cx + r,
      y: tanY + (tanFin >= 0 ? -S * 0.035 : S * 0.035),
      text: tanTxt,
      color: TOK.warn,
      size: S * 0.042,
      align: 'middle',
      baseline: 'middle',
      opacity: tanOp,
      z: 6,
    });
  }

  // radius + point on the circle
  prims.push({
    k: 'line',
    x1: cx,
    y1: cy,
    x2: px,
    y2: py,
    color: TOK.ink,
    weight: 'md',
    cap: 'round',
    z: 5,
  });
  prims.push({
    k: 'circle',
    cx: px,
    cy: py,
    r: S * 0.016,
    fill: TOK.accent,
    color: TOK.ink,
    weight: 'sm',
    z: 6,
  });

  // legend: live computed values (fixed rows; hidden ones fade via opacity)
  const tanTxtL = Math.abs(tanFin) > 99.5 ? (tanFin > 0 ? '∞' : '-∞') : fmt(tanFin);
  const rows: { text: string; color: string; op: number }[] = [
    { text: `θ = ${angleLabel(deg, B.radians)}`, color: TOK.ink, op: 1 },
    { text: `sin θ = ${fmt(sinv)}`, color: TOK.accent, op: sinOp },
    { text: `cos θ = ${fmt(cosv)}`, color: TOK.accent2, op: cosOp },
    { text: `tan θ = ${tanTxtL}`, color: TOK.warn, op: tanOp },
  ];
  const lx = portrait ? box.w * 0.14 : box.w * 0.7;
  const ly0 = portrait ? cy + r + box.h * 0.05 : box.h * 0.22;
  const lgap = portrait ? box.h * 0.052 : box.h * 0.13;
  rows.forEach((row, i) => {
    if (row.op < 0.01) return;
    prims.push({
      k: 'label',
      x: lx,
      y: ly0 + i * lgap,
      text: row.text,
      color: row.color,
      size: S * 0.055,
      align: 'start',
      baseline: 'middle',
      opacity: row.op,
      z: 6,
    });
  });

  return { prims, view: box };
}

export const UnitCircle: Manipulative<UnitCircleP> = {
  kind: 'unitcircle',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
