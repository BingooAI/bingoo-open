/**
 * trianglelab.ts — TriangleLab (tam giác THPT 15–18): three reasoning modes.
 * "angles": a triangle built from two given angles; showWork tears the three
 * angle wedges off the vertices and re-lines them up on a straight line at the
 * bottom — the classic 180° proof — and the third angle (180 − a − b) appears.
 * "pythagoras": a right triangle with true-scale squares on each side, areas
 * a², b², c²; showWork flows the two small squares into the big one and
 * reveals c² = a² + b². "ratio": a right triangle with θ = atan2(opp, adj),
 * sides named per params (opp/adj/hyp, authorable), and the live ratio value
 * sin/cos/tan θ = side/side computed from the legs. All values are REAL math
 * derived from params — nothing hardcoded.
 * verbs: setMode(mode) · setAngles(a,b) · setLegs(a,b) · showWork() ·
 *        highlightSide(side) · setRatio(fn) · answer(v)
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { fmt, lerp, TOK } from './util';

export type TriMode = 'angles' | 'pythagoras' | 'ratio';
export type TriSide = 'hyp' | 'opp' | 'adj';
export type TriangleLabP = {
  mode: TriMode;
  angles: [number, number]; // two given angles (deg); third is computed
  legs: [number, number]; // right-triangle legs: [adjacent/horizontal, opposite/vertical]
  showWork: boolean;
  highlight: TriSide | null;
  ratioFn: 'sin' | 'cos' | 'tan';
  /** learner's numeric answer (set by the `answer` verb; graded externally). */
  answer: number | null;
  /** learner-visible side names (authorable; English defaults). */
  sideNames: { hyp: string; opp: string; adj: string };
};

const DEFAULT: TriangleLabP = {
  mode: 'angles',
  angles: [60, 50],
  legs: [3, 4],
  showWork: false,
  highlight: null,
  ratioFn: 'sin',
  answer: null,
  sideNames: { hyp: 'hyp', opp: 'opp', adj: 'adj' },
};

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
const clampAng = (a: number) => Math.max(5, Math.min(170, a));
const clampLeg = (a: number) => Math.max(0.5, Math.min(12, a));

/** clamp a pair of angles so both ≥5° and a+b ≤ 174° (third ≥ 6°). */
function fixAngles(a0: number, b0: number): [number, number] {
  let a = clampAng(a0),
    b = clampAng(b0);
  if (a + b > 174) {
    const s = 174 / (a + b);
    a = Math.max(2, a * s);
    b = Math.max(2, b * s);
  }
  return [a, b];
}

function normalize(raw: unknown): TriangleLabP {
  const r = (raw ?? {}) as Partial<TriangleLabP> & {
    sideNames?: Partial<TriangleLabP['sideNames']>;
  };
  const ra = Array.isArray(r.angles) ? r.angles : DEFAULT.angles;
  const rl = Array.isArray(r.legs) ? r.legs : DEFAULT.legs;
  const mode: TriMode = r.mode === 'pythagoras' || r.mode === 'ratio' ? r.mode : 'angles';
  const hl =
    r.highlight === 'hyp' || r.highlight === 'opp' || r.highlight === 'adj' ? r.highlight : null;
  const fn = r.ratioFn === 'cos' || r.ratioFn === 'tan' ? r.ratioFn : 'sin';
  const sn: Partial<TriangleLabP['sideNames']> = r.sideNames ?? {};
  return {
    mode,
    angles: fixAngles(num(ra[0] ?? 60) || 60, num(ra[1] ?? 50) || 50),
    legs: [clampLeg(num(rl[0] ?? 3) || 3), clampLeg(num(rl[1] ?? 4) || 4)],
    showWork: !!r.showWork,
    highlight: hl,
    ratioFn: fn,
    answer: r.answer == null ? null : num(r.answer),
    sideNames: {
      hyp: typeof sn.hyp === 'string' ? sn.hyp : 'hyp',
      opp: typeof sn.opp === 'string' ? sn.opp : 'opp',
      adj: typeof sn.adj === 'string' ? sn.adj : 'adj',
    },
  };
}

const verbs: Manipulative<TriangleLabP>['verbs'] = {
  setMode(p, args): VerbClip<TriangleLabP> {
    const m = args?.mode ?? args;
    const mode: TriMode = m === 'pythagoras' || m === 'ratio' || m === 'angles' ? m : p.mode;
    const changed = mode !== p.mode;
    return tween(
      p,
      {
        ...p,
        mode,
        showWork: changed ? false : p.showWork,
        highlight: changed ? null : p.highlight,
      },
      0.55,
      'easeInOutCubic',
    );
  },
  setAngles(p, args): VerbClip<TriangleLabP> {
    const a = args?.a == null ? p.angles[0] : num(args.a);
    const b = args?.b == null ? p.angles[1] : num(args.b);
    return tween(p, { ...p, angles: fixAngles(a, b) }, 0.6, 'easeInOutCubic');
  },
  setLegs(p, args): VerbClip<TriangleLabP> {
    const a = args?.a == null ? p.legs[0] : num(args.a);
    const b = args?.b == null ? p.legs[1] : num(args.b);
    return tween(p, { ...p, legs: [clampLeg(a), clampLeg(b)] }, 0.6, 'easeInOutCubic');
  },
  showWork(p): VerbClip<TriangleLabP> {
    return tween(p, { ...p, showWork: true }, 0.9, 'easeInOutCubic');
  },
  highlightSide(p, args): VerbClip<TriangleLabP> {
    const s = args?.side ?? args;
    const side: TriSide | null = s === 'hyp' || s === 'opp' || s === 'adj' ? s : null;
    return tween(p, { ...p, highlight: side }, 0.35, 'easeOutCubic');
  },
  setRatio(p, args): VerbClip<TriangleLabP> {
    const f = args?.fn ?? args;
    const fn = f === 'cos' || f === 'tan' || f === 'sin' ? f : p.ratioFn;
    return tween(p, { ...p, ratioFn: fn }, 0.4, 'easeOutCubic');
  },
  answer(p, args): VerbClip<TriangleLabP> {
    const v = args && typeof args === 'object' ? args.v : args;
    const ans = v == null || typeof v === 'object' ? null : num(v);
    return tween(p, { ...p, answer: ans }, 0.3, 'easeOutCubic');
  },
};

/* ------------------------------------------------------------------ helpers */

type V2 = [number, number];

/** filled circular sector, math angles (y up), screen y flipped. */
function sectorPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const N = Math.max(10, Math.ceil(Math.abs(a1 - a0) / 0.1));
  let d = `M ${cx.toFixed(2)} ${cy.toFixed(2)}`;
  for (let i = 0; i <= N; i++) {
    const a = a0 + ((a1 - a0) * i) / N;
    d += ` L ${(cx + Math.cos(a) * r).toFixed(2)} ${(cy - Math.sin(a) * r).toFixed(2)}`;
  }
  return d + ' Z';
}

function polyPath(pts: V2[]): string {
  return (
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') +
    ' Z'
  );
}

function centroid(pts: V2[]): V2 {
  let x = 0,
    y = 0;
  for (const q of pts) {
    x += q[0];
    y += q[1];
  }
  return [x / pts.length, y / pts.length];
}

/** math angle (y up) of screen vector v→q. */
function mathAng(v: V2, q: V2): number {
  return Math.atan2(v[1] - q[1], q[0] - v[0]);
}

/** start angle of the interior wedge of width w at vertex v (adjacent p1, p2). */
function wedgeStart(v: V2, p1: V2, p2: V2, w: number): number {
  const a1 = mathAng(v, p1);
  const a2 = mathAng(v, p2);
  const d = (((a2 - a1) % TAU) + TAU) % TAU;
  return Math.abs(d - w) < 0.05 ? a1 : a2;
}

/** lerp angles taking the nearest wrap (for the wedge fly-to-line motion). */
function lerpAngNear(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * t;
}

/* ------------------------------------------------------------------- render */

/** Draw one full scene at opacity `alpha`; F→P at progress `p` for the given verb. */
function drawScene(
  prims: Prim[],
  P: TriangleLabP,
  F: TriangleLabP,
  verb: string | null,
  p: number,
  alpha: number,
  box: { w: number; h: number },
): void {
  const S = Math.min(box.w, box.h);
  // showWork progress (0 hidden → 1 fully torn off / flowed)
  const wp = F.showWork === P.showWork ? (P.showWork ? 1 : 0) : P.showWork ? p : 1 - p;

  if (P.mode === 'angles') {
    const aD = lerp(F.angles[0], P.angles[0], p);
    const bD = lerp(F.angles[1], P.angles[1], p);
    const cD = 180 - aD - bD; // the REAL computed third angle
    const aR = aD * DEG,
      bR = bD * DEG,
      cR = cD * DEG;
    // unit triangle: base A(0,0)→B(1,0), apex from the two angle rays
    const ta = Math.tan(aR),
      tb = Math.tan(bR);
    const h = (ta * tb) / (ta + tb); // = sin a sin b / sin(a+b) > 0
    const xC = h / ta;
    const minX = Math.min(0, xC),
      maxX = Math.max(1, xC);
    const spanX = maxX - minX,
      spanY = Math.max(h, 1e-3);
    const availW = box.w * 0.84,
      availH = box.h * 0.46;
    const s = Math.min(availW / spanX, availH / spanY);
    const ox = (box.w - spanX * s) / 2 - minX * s;
    const baseY = box.h * 0.08 + (availH - spanY * s) / 2 + spanY * s;
    const A: V2 = [ox, baseY];
    const B: V2 = [ox + s, baseY];
    const C: V2 = [ox + xC * s, baseY - h * s];

    prims.push({
      k: 'path',
      d: polyPath([A, B, C]),
      fill: TOK.soft,
      opacity: 0.1 * alpha,
      closed: true,
      z: 2,
    });
    prims.push({
      k: 'path',
      d: polyPath([A, B, C]),
      fill: 'none',
      color: TOK.ink,
      weight: 'md',
      opacity: alpha,
      closed: true,
      z: 3,
    });

    // the tear-off line (the straight angle the wedges re-line up on)
    const lineY = box.h * 0.7;
    const half = box.w * 0.3;
    const bx = box.w * 0.5;
    if (wp > 0.01) {
      prims.push({
        k: 'line',
        x1: bx - half,
        y1: lineY,
        x2: bx + half,
        y2: lineY,
        color: TOK.ink,
        weight: 'md',
        opacity: wp * alpha,
        z: 3,
      });
      prims.push({
        k: 'label',
        x: bx + half + S * 0.02,
        y: lineY,
        text: '180°',
        color: TOK.soft,
        size: S * 0.045,
        align: 'start',
        baseline: 'middle',
        opacity: wp * alpha,
        z: 3,
      });
      prims.push({
        k: 'label',
        x: bx,
        y: box.h * 0.82,
        text: `${fmt(aD)}° + ${fmt(bD)}° + ${fmt(cD)}° = 180°`,
        color: TOK.ink,
        size: S * 0.05,
        align: 'middle',
        baseline: 'middle',
        opacity: wp * alpha,
        z: 6,
      });
    }

    // three wedges: at their vertices when wp=0, all sharing one point on the
    // line (spans [0,a], [a,a+b], [a+b,180]) when wp=1 — position AND
    // orientation interpolate, so the arcs visibly tear off and re-line up.
    const rw = S * 0.075;
    const wedges = [
      {
        v: A,
        p1: B,
        p2: C,
        w: aR,
        color: TOK.accent,
        target0: 0,
        txt: `${fmt(aD)}°`,
        third: false,
      },
      {
        v: B,
        p1: A,
        p2: C,
        w: bR,
        color: TOK.accent2,
        target0: aR,
        txt: `${fmt(bD)}°`,
        third: false,
      },
      {
        v: C,
        p1: A,
        p2: B,
        w: cR,
        color: TOK.warn,
        target0: aR + bR,
        txt: `${fmt(cD)}°`,
        third: true,
      },
    ];
    for (const wd of wedges) {
      const s0 = wedgeStart(wd.v, wd.p1, wd.p2, wd.w);
      const cx = lerp(wd.v[0], bx, wp);
      const cy = lerp(wd.v[1], lineY, wp);
      const start = lerpAngNear(s0, wd.target0, wp);
      prims.push({
        k: 'path',
        d: sectorPath(cx, cy, rw, start, start + wd.w),
        fill: wd.color,
        opacity: 0.45 * alpha,
        color: wd.color,
        weight: 'sm',
        closed: true,
        z: 5,
      });
      // ghost stays at the vertex while the copy flies (shows WHERE it came from)
      if (wp > 0.02) {
        prims.push({
          k: 'path',
          d: sectorPath(wd.v[0], wd.v[1], rw * 0.8, s0, s0 + wd.w),
          fill: 'none',
          color: wd.color,
          weight: 'sm',
          opacity: 0.35 * wp * alpha,
          closed: true,
          z: 4,
        });
      }
      const mid = start + wd.w / 2;
      const lx = cx + Math.cos(mid) * rw * 1.55;
      const ly = cy - Math.sin(mid) * rw * 1.55;
      if (wd.third) {
        // "?" until the proof runs; the computed value fades in with it
        prims.push({
          k: 'label',
          x: lx,
          y: ly,
          text: '?',
          color: wd.color,
          size: S * 0.055,
          align: 'middle',
          baseline: 'middle',
          opacity: (1 - wp) * alpha,
          z: 6,
        });
        prims.push({
          k: 'label',
          x: lx,
          y: ly,
          text: wd.txt,
          color: wd.color,
          size: S * 0.05,
          align: 'middle',
          baseline: 'middle',
          opacity: wp * alpha,
          z: 6,
        });
      } else {
        prims.push({
          k: 'label',
          x: lx,
          y: ly,
          text: wd.txt,
          color: wd.color,
          size: S * 0.05,
          align: 'middle',
          baseline: 'middle',
          opacity: alpha,
          z: 6,
        });
      }
    }
  } else if (P.mode === 'pythagoras') {
    const a = lerp(F.legs[0], P.legs[0], p);
    const b = lerp(F.legs[1], P.legs[1], p);
    const c2 = a * a + b * b;
    const c = Math.sqrt(c2);
    // math coords (y up): right angle at O, legs along the axes; squares outward
    const sqA: V2[] = [
      [0, 0],
      [a, 0],
      [a, -a],
      [0, -a],
    ];
    const sqB: V2[] = [
      [0, 0],
      [0, b],
      [-b, b],
      [-b, 0],
    ];
    const sqC: V2[] = [
      [a, 0],
      [0, b],
      [b, a + b],
      [a + b, a],
    ];
    const minX = -b,
      maxX = a + b,
      minY = -a,
      maxY = a + b;
    const spanX = maxX - minX,
      spanY = maxY - minY;
    const availW = box.w * 0.84,
      availH = box.h * 0.79;
    const s = Math.min(availW / spanX, availH / spanY);
    const tx = (box.w - spanX * s) / 2 - minX * s;
    const topY = box.h * 0.16 + (availH - spanY * s) / 2;
    const M = (q: V2): V2 => [tx + q[0] * s, topY + (maxY - q[1]) * s];
    const mA = sqA.map(M),
      mB = sqB.map(M),
      mC = sqC.map(M);
    const tri: V2[] = [M([0, 0]), M([a, 0]), M([0, b])];

    prims.push({
      k: 'path',
      d: polyPath(mA),
      fill: TOK.accent,
      opacity: 0.3 * alpha,
      color: TOK.accent,
      weight: 'sm',
      closed: true,
      z: 2,
    });
    prims.push({
      k: 'path',
      d: polyPath(mB),
      fill: TOK.accent2,
      opacity: 0.3 * alpha,
      color: TOK.accent2,
      weight: 'sm',
      closed: true,
      z: 2,
    });
    prims.push({
      k: 'path',
      d: polyPath(mC),
      fill: TOK.warn,
      opacity: (0.1 + 0.22 * wp) * alpha,
      color: TOK.warn,
      weight: 'sm',
      closed: true,
      z: 2,
    });
    prims.push({
      k: 'path',
      d: polyPath(tri),
      fill: TOK.soft,
      opacity: 0.15 * alpha,
      color: TOK.ink,
      weight: 'md',
      closed: true,
      z: 4,
    });

    // right-angle marker at O
    const mm = Math.min(Math.min(a, b) * s * 0.18, S * 0.035);
    const O = M([0, 0]);
    prims.push({
      k: 'line',
      x1: O[0] + mm,
      y1: O[1],
      x2: O[0] + mm,
      y2: O[1] - mm,
      color: TOK.ink,
      weight: 'sm',
      opacity: alpha,
      z: 5,
    });
    prims.push({
      k: 'line',
      x1: O[0] + mm,
      y1: O[1] - mm,
      x2: O[0],
      y2: O[1] - mm,
      color: TOK.ink,
      weight: 'sm',
      opacity: alpha,
      z: 5,
    });

    // areas (REAL: a², b², and c² = a²+b²) + side lengths
    const cA = centroid(mA),
      cB = centroid(mB),
      cC = centroid(mC);
    prims.push({
      k: 'label',
      x: cA[0],
      y: cA[1],
      text: fmt(a * a),
      color: TOK.ink,
      size: Math.min(S * 0.055, a * s * 0.45),
      align: 'middle',
      baseline: 'middle',
      opacity: alpha,
      z: 6,
    });
    prims.push({
      k: 'label',
      x: cB[0],
      y: cB[1],
      text: fmt(b * b),
      color: TOK.ink,
      size: Math.min(S * 0.055, b * s * 0.45),
      align: 'middle',
      baseline: 'middle',
      opacity: alpha,
      z: 6,
    });
    prims.push({
      k: 'label',
      x: cC[0],
      y: cC[1],
      text: '?',
      color: TOK.warn,
      size: Math.min(S * 0.065, c * s * 0.4),
      align: 'middle',
      baseline: 'middle',
      opacity: (1 - wp) * alpha,
      z: 6,
    });
    prims.push({
      k: 'label',
      x: cC[0],
      y: cC[1],
      text: fmt(c2),
      color: TOK.ink,
      size: Math.min(S * 0.06, c * s * 0.4),
      align: 'middle',
      baseline: 'middle',
      opacity: wp * alpha,
      z: 6,
    });
    prims.push({
      k: 'label',
      x: tx + (a / 2) * s,
      y: topY + maxY * s - S * 0.022,
      text: fmt(a),
      color: TOK.soft,
      size: S * 0.04,
      align: 'middle',
      baseline: 'bottom',
      opacity: alpha,
      z: 5,
    });
    prims.push({
      k: 'label',
      x: O[0] + S * 0.015,
      y: topY + (maxY - b / 2) * s,
      text: fmt(b),
      color: TOK.soft,
      size: S * 0.04,
      align: 'start',
      baseline: 'middle',
      opacity: alpha,
      z: 5,
    });

    // showWork: the two small squares' areas flow into the big one
    if (verb === 'showWork' && p < 1 && P.showWork && !F.showWork) {
      for (const [sq, col] of [
        [mA, TOK.accent],
        [mB, TOK.accent2],
      ] as [V2[], string][]) {
        const c0 = centroid(sq);
        const k = 1 - 0.45 * p;
        const mv = sq.map((q): V2 => [
          c0[0] + (cC[0] - c0[0]) * p + (q[0] - c0[0]) * k,
          c0[1] + (cC[1] - c0[1]) * p + (q[1] - c0[1]) * k,
        ]);
        prims.push({
          k: 'path',
          d: polyPath(mv),
          fill: col,
          opacity: (1 - p) * 0.5 * alpha,
          closed: true,
          z: 6,
        });
      }
    }

    // equation strip on top (crossfades ? → computed value)
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.05,
      text: `${fmt(a * a)} + ${fmt(b * b)} = ?`,
      color: TOK.ink,
      size: Math.min(S * 0.055, box.h * 0.05),
      align: 'middle',
      baseline: 'middle',
      opacity: (1 - wp) * alpha,
      z: 6,
    });
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.05,
      text: `${fmt(a * a)} + ${fmt(b * b)} = ${fmt(c2)}`,
      color: TOK.ink,
      size: Math.min(S * 0.055, box.h * 0.05),
      align: 'middle',
      baseline: 'middle',
      opacity: wp * alpha,
      z: 6,
    });
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.115,
      text: `c = ${fmt(c)}`,
      color: TOK.warn,
      size: Math.min(S * 0.05, box.h * 0.045),
      align: 'middle',
      baseline: 'middle',
      opacity: wp * alpha,
      z: 6,
    });
  } else {
    /* ---- ratio mode ---- */
    const adj = lerp(F.legs[0], P.legs[0], p);
    const opp = lerp(F.legs[1], P.legs[1], p);
    const hyp = Math.hypot(adj, opp);
    const th = Math.atan2(opp, adj); // θ derived from the legs — REAL
    const thD = th / DEG;
    const availW = box.w * 0.84,
      availH = box.h * 0.7;
    const s = Math.min(availW / adj, availH / opp);
    const ox = (box.w - adj * s) / 2;
    const baseY = box.h * 0.08 + (availH - opp * s) / 2 + opp * s;
    const A: V2 = [ox, baseY];
    const B: V2 = [ox + adj * s, baseY];
    const C: V2 = [ox + adj * s, baseY - opp * s];
    const names = P.sideNames;

    const hi = P.highlight;
    const dim = (side: TriSide) => (hi == null || hi === side ? 1 : 0.55);
    const wgt = (side: TriSide) => (hi === side ? 'lg' : 'md');
    prims.push({
      k: 'path',
      d: polyPath([A, B, C]),
      fill: TOK.soft,
      opacity: 0.08 * alpha,
      closed: true,
      z: 2,
    });
    prims.push({
      k: 'line',
      x1: A[0],
      y1: A[1],
      x2: B[0],
      y2: B[1],
      color: TOK.accent2,
      weight: wgt('adj'),
      cap: 'round',
      opacity: dim('adj') * alpha,
      z: 3,
    });
    prims.push({
      k: 'line',
      x1: B[0],
      y1: B[1],
      x2: C[0],
      y2: C[1],
      color: TOK.accent,
      weight: wgt('opp'),
      cap: 'round',
      opacity: dim('opp') * alpha,
      z: 3,
    });
    prims.push({
      k: 'line',
      x1: A[0],
      y1: A[1],
      x2: C[0],
      y2: C[1],
      color: TOK.warn,
      weight: wgt('hyp'),
      cap: 'round',
      opacity: dim('hyp') * alpha,
      z: 3,
    });

    // right-angle marker at B (interior is up-left)
    const mm = Math.min(Math.min(adj, opp) * s * 0.15, S * 0.035);
    prims.push({
      k: 'line',
      x1: B[0] - mm,
      y1: B[1],
      x2: B[0] - mm,
      y2: B[1] - mm,
      color: TOK.ink,
      weight: 'sm',
      opacity: alpha,
      z: 4,
    });
    prims.push({
      k: 'line',
      x1: B[0] - mm,
      y1: B[1] - mm,
      x2: B[0],
      y2: B[1] - mm,
      color: TOK.ink,
      weight: 'sm',
      opacity: alpha,
      z: 4,
    });

    // θ wedge + value at A
    const rt = Math.min(S * 0.11, adj * s * 0.4);
    prims.push({
      k: 'path',
      d: sectorPath(A[0], A[1], rt, 0, th),
      fill: TOK.warn,
      opacity: 0.25 * alpha,
      color: TOK.warn,
      weight: 'sm',
      closed: true,
      z: 4,
    });
    prims.push({
      k: 'label',
      x: A[0] + Math.cos(th / 2) * (rt + S * 0.02),
      y: A[1] - Math.sin(th / 2) * (rt + S * 0.02),
      text: `θ = ${fmt(thD)}°`,
      color: TOK.warn,
      size: S * 0.045,
      align: 'start',
      baseline: 'middle',
      opacity: alpha,
      z: 6,
    });

    // side names (from params) placed inside the figure
    prims.push({
      k: 'label',
      x: (A[0] + B[0]) / 2,
      y: baseY - S * 0.028,
      text: names.adj,
      color: TOK.accent2,
      size: S * 0.048,
      align: 'middle',
      baseline: 'middle',
      opacity: dim('adj') * alpha,
      z: 5,
    });
    prims.push({
      k: 'label',
      x: B[0] - S * 0.018,
      y: (B[1] + C[1]) / 2,
      text: names.opp,
      color: TOK.accent,
      size: S * 0.048,
      align: 'end',
      baseline: 'middle',
      opacity: dim('opp') * alpha,
      z: 5,
    });
    const hm: V2 = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
    const inw: V2 = [B[0] - hm[0], B[1] - hm[1]];
    const inL = Math.hypot(inw[0], inw[1]) || 1;
    prims.push({
      k: 'label',
      x: hm[0] + (inw[0] / inL) * S * 0.055,
      y: hm[1] + (inw[1] / inL) * S * 0.055,
      text: names.hyp,
      color: TOK.warn,
      size: S * 0.048,
      align: 'middle',
      baseline: 'middle',
      opacity: dim('hyp') * alpha,
      z: 5,
    });

    // the ratio, computed live: sin=opp/hyp · cos=adj/hyp · tan=opp/adj
    const [nN, dN, nV, dV] =
      P.ratioFn === 'cos'
        ? [names.adj, names.hyp, adj, hyp]
        : P.ratioFn === 'tan'
          ? [names.opp, names.adj, opp, adj]
          : [names.opp, names.hyp, opp, hyp];
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.87,
      text: `${P.ratioFn} θ = ${nN}/${dN}`,
      color: TOK.ink,
      size: S * 0.055,
      align: 'middle',
      baseline: 'middle',
      opacity: alpha,
      z: 6,
    });
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.94,
      text: `= ${fmt(nV)}/${fmt(dV)} = ${fmt(nV / dV)}`,
      color: TOK.accent,
      size: S * 0.05,
      align: 'middle',
      baseline: 'middle',
      opacity: wp * alpha,
      z: 6,
    });
  }
}

function render(
  _params: TriangleLabP,
  state: ManipState<TriangleLabP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const prims: Prim[] = [];
  if (seg.verb === 'setMode' && seg.from.mode !== seg.to.mode) {
    // crossfade the two mode scenes
    drawScene(prims, seg.from, seg.from, null, 1, 1 - seg.p, box);
    drawScene(prims, seg.to, seg.to, null, 1, seg.p, box);
  } else {
    drawScene(prims, seg.to, seg.from, seg.verb, seg.p, 1, box);
  }
  // the learner's current answer (graded externally via check)
  if (seg.to.answer != null) {
    const S = Math.min(box.w, box.h);
    const grow = seg.verb === 'answer' ? seg.p : 1;
    prims.push({
      k: 'label',
      x: box.w * 0.95,
      y: box.h * 0.965,
      text: fmt(seg.to.answer),
      color: TOK.accent,
      size: S * 0.05 * (0.6 + 0.4 * grow),
      align: 'end',
      baseline: 'middle',
      opacity: grow,
      z: 7,
    });
  }
  return { prims, view: box };
}

export const TriangleLab: Manipulative<TriangleLabP> = {
  kind: 'trianglelab',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
