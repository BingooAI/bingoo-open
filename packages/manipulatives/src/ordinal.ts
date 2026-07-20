/**
 * ordinal.ts — OrdinalQueue (số thứ tự 1st..10th). A queue of little stick
 * figures walks toward a flag; positions are counted FROM the flag, so
 * DIRECTION matters — an arrow under the queue shows the counting direction
 * and `flip` reverses it (the same child can be 1st or 5th!). Ordinal words
 * are authorable via `ordinalNames` (English defaults "1st".."10th").
 * Ages 4–7. verbs: highlightPos(pos) · setCount(n) · showLabels · flip.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { clamp01, lerp, TOK } from './util';

export type OrdinalP = {
  /** figures in the queue (1..10) */
  n: number;
  /** highlighted ordinal position, 1-based, counted from the flag */
  highlight: number | null;
  /** show ordinal words under each figure */
  labels: boolean;
  /** which side the flag/finish is on — the side counting starts from */
  facing: 'left' | 'right';
  /** learner-visible ordinal words, index 0 = 1st. English defaults. */
  ordinalNames?: string[];
};

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const DEFAULT: OrdinalP = { n: 5, highlight: 1, labels: true, facing: 'right' };

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

function normalize(raw: unknown): OrdinalP {
  const r = (raw ?? {}) as Partial<OrdinalP>;
  const n = clampInt(num(r.n ?? 5) || 5, 1, 10);
  return {
    n,
    highlight: r.highlight == null ? null : clampInt(num(r.highlight) || 1, 1, n),
    labels: r.labels === undefined ? true : !!r.labels,
    facing: r.facing === 'left' ? 'left' : 'right',
    ordinalNames: Array.isArray(r.ordinalNames) ? r.ordinalNames.map(String) : undefined,
  };
}

function ordName(p: OrdinalP, pos: number): string {
  return p.ordinalNames?.[pos - 1] ?? ORDINALS[pos - 1] ?? `${pos}.`;
}

const verbs: Manipulative<OrdinalP>['verbs'] = {
  /** move the highlight ring to an ordinal position (ring glides over) */
  highlightPos(p, args): VerbClip<OrdinalP> {
    const pos = clampInt(num(args?.pos ?? (typeof args === 'number' ? args : 1)) || 1, 1, p.n);
    return tween(p, { ...p, highlight: pos }, 0.45, 'easeOutCubic');
  },
  setCount(p, args): VerbClip<OrdinalP> {
    const n = clampInt(num(args?.n ?? (typeof args === 'number' ? args : p.n)) || p.n, 1, 10);
    const highlight = p.highlight != null ? Math.min(p.highlight, n) : null;
    return tween(p, { ...p, n, highlight }, 0.45, 'easeOutBack');
  },
  showLabels(p): VerbClip<OrdinalP> {
    return tween(p, { ...p, labels: true }, 0.4, 'easeOutCubic');
  },
  /** reverse the counting direction — every ordinal label re-derives */
  flip(p): VerbClip<OrdinalP> {
    return tween(
      p,
      { ...p, facing: p.facing === 'right' ? 'left' : 'right' },
      0.7,
      'easeInOutCubic',
    );
  },
};

/** queue layout for a facing — keep in sync with interactions onTap. */
function layout(p: OrdinalP, w: number) {
  const right = p.facing === 'right';
  return {
    qx0: right ? w * 0.06 : w * 0.2,
    qx1: right ? w * 0.8 : w * 0.94,
    flagX: right ? w * 0.9 : w * 0.1,
    dir: right ? 1 : -1,
  };
}

/** simple stick figure: head + body + striding legs + arms, walking toward `dir`. */
function figure(
  prims: Prim[],
  x: number,
  groundY: number,
  H: number,
  dir: number,
  op: number,
  hi: boolean,
) {
  if (op <= 0.01) return;
  const headR = H * 0.16;
  const headY = groundY - H + headR;
  const hipY = groundY - H * 0.32;
  const shY = headY + headR + H * 0.1;
  prims.push({
    k: 'circle',
    cx: x,
    cy: headY,
    r: headR,
    fill: hi ? TOK.warn : TOK.accent,
    color: TOK.ink,
    weight: 'sm',
    opacity: op,
    z: 4,
  });
  prims.push({
    k: 'line',
    x1: x,
    y1: headY + headR,
    x2: x,
    y2: hipY,
    color: TOK.ink,
    weight: 'md',
    cap: 'round',
    opacity: op,
    z: 3,
  });
  // striding legs (front leg reaches toward the flag)
  prims.push({
    k: 'line',
    x1: x,
    y1: hipY,
    x2: x + H * 0.2 * dir,
    y2: groundY,
    color: TOK.ink,
    weight: 'md',
    cap: 'round',
    opacity: op,
    z: 3,
  });
  prims.push({
    k: 'line',
    x1: x,
    y1: hipY,
    x2: x - H * 0.14 * dir,
    y2: groundY,
    color: TOK.ink,
    weight: 'md',
    cap: 'round',
    opacity: op,
    z: 3,
  });
  // arms
  prims.push({
    k: 'line',
    x1: x,
    y1: shY,
    x2: x + H * 0.2 * dir,
    y2: shY + H * 0.1,
    color: TOK.ink,
    weight: 'sm',
    cap: 'round',
    opacity: op,
    z: 3,
  });
  prims.push({
    k: 'line',
    x1: x,
    y1: shY,
    x2: x - H * 0.14 * dir,
    y2: shY + H * 0.14,
    color: TOK.ink,
    weight: 'sm',
    cap: 'round',
    opacity: op,
    z: 3,
  });
}

function render(
  _params: OrdinalP,
  state: ManipState<OrdinalP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const q = clamp01(seg.p);

  // layout interpolated between from/to (flip glides the flag across; setCount reflows)
  const A = layout(seg.from, box.w);
  const B = layout(P, box.w);
  const L = {
    qx0: lerp(A.qx0, B.qx0, q),
    qx1: lerp(A.qx1, B.qx1, q),
    flagX: lerp(A.flagX, B.flagX, q),
    dir: lerp(A.dir, B.dir, q),
    n: Math.max(1, lerp(seg.from.n, P.n, q)),
  };
  const groundY = box.h * 0.6;
  const sw = (L.qx1 - L.qx0) / L.n;
  const slotX = (i: number) => L.qx0 + (i + 0.5) * sw;
  const baseH = Math.min(box.h * 0.28, sw * 1.7);

  // ground line
  prims.push({
    k: 'line',
    x1: box.w * 0.03,
    y1: groundY,
    x2: box.w * 0.97,
    y2: groundY,
    color: TOK.faint,
    weight: 'md',
    z: 1,
  });

  // flag at the counting side (banner waves toward the queue)
  const fh = baseH * 1.15;
  prims.push({
    k: 'line',
    x1: L.flagX,
    y1: groundY,
    x2: L.flagX,
    y2: groundY - fh,
    color: TOK.ink,
    weight: 'md',
    cap: 'round',
    z: 3,
  });
  prims.push({
    k: 'path',
    d: `M ${L.flagX} ${groundY - fh} L ${L.flagX - L.dir * fh * 0.42} ${groundY - fh + fh * 0.13} L ${L.flagX} ${groundY - fh + fh * 0.26} Z`,
    fill: TOK.accent2,
    color: TOK.ink,
    weight: 'sm',
    closed: true,
    z: 4,
  });

  // figures — sizes vary slightly & deterministically by index
  const shown = Math.max(seg.from.n, P.n);
  for (let i = 0; i < shown; i++) {
    let op = 1;
    if (i >= seg.from.n)
      op = q; // fading in (setCount up)
    else if (i >= P.n) op = 1 - q; // fading out (setCount down)
    const H = baseH * (1 + 0.1 * Math.sin(i * 2.4 + 0.8));
    const pos = P.facing === 'right' ? P.n - i : i + 1;
    const isHi = i < P.n && P.highlight != null && pos === P.highlight;
    // highlighted figure bounces (baked sine of the eased progress)
    const dy = isHi && seg.verb === 'highlightPos' ? Math.sin(Math.PI * q) * baseH * 0.18 : 0;
    figure(prims, slotX(i), groundY - dy, H, L.dir, op, isHi);
  }

  // highlight ring — glides from the old position to the new one
  if (P.highlight != null) {
    const iTo = P.facing === 'right' ? P.n - P.highlight : P.highlight - 1;
    let rx = slotX(iTo);
    let rop = 1;
    if (seg.verb === 'highlightPos') {
      const hFrom = seg.from.highlight;
      if (hFrom != null) {
        const iFrom = seg.from.facing === 'right' ? seg.from.n - hFrom : hFrom - 1;
        rx = lerp(slotX(iFrom), slotX(iTo), q);
      } else rop = q;
    }
    prims.push({
      k: 'circle',
      cx: rx,
      cy: groundY - baseH * 0.48,
      r: baseH * 0.58,
      fill: 'none',
      color: TOK.warn,
      weight: 'lg',
      opacity: rop,
      z: 6,
    });
    // big caption of the highlighted ordinal word
    const cop =
      seg.verb === 'highlightPos' && seg.from.highlight !== P.highlight
        ? q
        : seg.verb === 'flip'
          ? q
          : 1;
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.09,
      text: ordName(P, P.highlight),
      color: TOK.warn,
      size: box.h * 0.085,
      align: 'middle',
      baseline: 'middle',
      opacity: cop,
      z: 6,
    });
  }

  // ordinal labels under each figure (crossfade on flip: labels re-derive!)
  const labSize = Math.min(box.h * 0.05, sw * 0.4);
  const labY = groundY + box.h * 0.065;
  const putLabels = (S: OrdinalP, op: number) => {
    if (!S.labels || op <= 0.01) return;
    for (let i = 0; i < S.n && i < shown; i++) {
      const pos = S.facing === 'right' ? S.n - i : i + 1;
      const hi = S.highlight != null && pos === S.highlight;
      prims.push({
        k: 'label',
        x: slotX(i),
        y: labY,
        text: ordName(S, pos),
        color: hi ? TOK.warn : TOK.soft,
        size: labSize,
        align: 'middle',
        baseline: 'middle',
        opacity: op,
        z: 5,
      });
    }
  };
  if (seg.verb === 'flip') {
    putLabels(seg.from, 1 - q);
    putLabels(P, q);
  } else if (seg.verb === 'showLabels' && !seg.from.labels) putLabels(P, q);
  else putLabels(P, 1);

  // counting-direction arrow — starts at the flag, points along the queue
  const ay = box.h * 0.79;
  const tailX = L.flagX - L.dir * box.w * 0.07;
  const headX = tailX - L.dir * box.w * 0.58;
  const ah = Math.min(box.w, box.h) * 0.025;
  prims.push({
    k: 'line',
    x1: tailX,
    y1: ay,
    x2: headX + L.dir * ah * 1.4,
    y2: ay,
    color: TOK.accent2,
    weight: 'md',
    cap: 'round',
    z: 4,
  });
  prims.push({
    k: 'path',
    d: `M ${headX} ${ay} L ${headX + L.dir * ah * 1.7} ${ay - ah} L ${headX + L.dir * ah * 1.7} ${ay + ah} Z`,
    fill: TOK.accent2,
    closed: true,
    z: 4,
  });

  return { prims, view: box };
}

export const OrdinalQueue: Manipulative<OrdinalP> = {
  kind: 'ordinal',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
