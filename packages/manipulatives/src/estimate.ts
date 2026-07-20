/**
 * estimate.ts — estimation (ước lượng). A jar of `actual` objects (scattered, so
 * hard to count exactly); the learner sets a `guess` on a 0..max scale, then
 * `reveal` neatly arranges & counts them to compare. verbs: setActual(n) ·
 * guess(n) · reveal · setMax(m).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, mapRange, TOK } from './util';

export type EstimateP = {
  actual: number;
  guess: number;
  max: number;
  revealed: boolean;
  labels: { revealed: string; close: string; guessing: string };
};

const DEFAULT: EstimateP = {
  actual: 18,
  guess: 10,
  max: 30,
  revealed: false,
  labels: {
    revealed: 'Guess: {guess} · Actual: {actual}',
    close: ' — very close!',
    guessing: 'Your guess: {guess}',
  },
};

function normalize(raw: unknown): EstimateP {
  const r = (raw ?? {}) as Partial<EstimateP>;
  const max = Math.max(5, Math.floor(r.max ?? 30));
  return {
    actual: Math.max(0, Math.floor(r.actual ?? 18)),
    guess: Math.max(0, Math.min(max, Math.floor(r.guess ?? 10))),
    max,
    revealed: !!r.revealed,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  };
}
const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function rand(i: number, s: number): number {
  const h = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

const verbs: Manipulative<EstimateP>['verbs'] = {
  setActual(p, args): VerbClip<EstimateP> {
    return tween(
      p,
      { ...p, actual: Math.max(0, Math.floor(num(args?.n ?? args ?? p.actual))) },
      0.4,
      'easeOutBack',
    );
  },
  guess(p, args): VerbClip<EstimateP> {
    return tween(
      p,
      { ...p, guess: Math.max(0, Math.min(p.max, Math.round(num(args?.n ?? args ?? p.guess)))) },
      0.4,
      'easeOutCubic',
    );
  },
  setMax(p, args): VerbClip<EstimateP> {
    return tween(
      p,
      { ...p, max: Math.max(5, Math.floor(num(args?.m ?? args ?? p.max))) },
      0.3,
      'easeOutCubic',
    );
  },
  reveal(p): VerbClip<EstimateP> {
    return tween(p, { ...p, revealed: true }, 0.8, 'easeInOutCubic');
  },
};

function render(
  _params: EstimateP,
  state: ManipState<EstimateP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const jx = box.w * 0.12,
    jy = box.h * 0.12,
    jw = box.w * 0.76,
    jh = box.h * 0.52;
  const r = Math.min(box.w, box.h) * 0.022;
  const revealP = seg.verb === 'reveal' ? seg.p : P.revealed ? 1 : 0;

  // jar
  prims.push({
    k: 'rect',
    x: jx,
    y: jy,
    w: jw,
    h: jh,
    fill: 'none',
    color: TOK.ink,
    weight: 'md',
    rx: 16,
    z: 1,
  });

  // objects: scattered (estimate) → neat grid (revealed), interpolated
  const cols = Math.ceil(Math.sqrt(P.actual)) + 1;
  for (let i = 0; i < P.actual; i++) {
    const sx = jx + jw * (0.08 + rand(i, 1) * 0.84);
    const sy = jy + jh * (0.1 + rand(i, 2) * 0.8);
    const gcx = jx + jw * 0.5 + ((i % cols) - (cols - 1) / 2) * (r * 2.6);
    const gcy = jy + jh * 0.2 + Math.floor(i / cols) * (r * 2.6);
    prims.push({
      k: 'circle',
      cx: lerp(sx, gcx, revealP),
      cy: lerp(sy, gcy, revealP),
      r,
      fill: TOK.accent2,
      color: TOK.ink,
      weight: 'sm',
      z: 3,
    });
  }
  if (revealP < 0.5)
    prims.push({
      k: 'label',
      x: jx + jw / 2,
      y: jy + jh / 2,
      text: '≈ ?',
      color: TOK.soft,
      size: box.h * 0.16,
      align: 'middle',
      baseline: 'middle',
      opacity: 1 - revealP * 2,
      z: 4,
    });

  // guess scale
  const sy = box.h * 0.76;
  prims.push({
    k: 'line',
    x1: jx,
    y1: sy,
    x2: jx + jw,
    y2: sy,
    color: TOK.ink,
    weight: 'md',
    z: 2,
  });
  for (let v = 0; v <= P.max; v += Math.max(1, Math.round(P.max / 6))) {
    const x = mapRange(v, 0, P.max, jx, jx + jw);
    prims.push({
      k: 'line',
      x1: x,
      y1: sy - box.h * 0.02,
      x2: x,
      y2: sy + box.h * 0.02,
      color: TOK.soft,
      weight: 'sm',
      z: 2,
    });
    prims.push({
      k: 'label',
      x,
      y: sy + box.h * 0.06,
      text: String(v),
      color: TOK.soft,
      size: box.h * 0.045,
      align: 'middle',
      baseline: 'middle',
      z: 2,
    });
  }
  const gx = mapRange(P.guess, 0, P.max, jx, jx + jw);
  prims.push({
    k: 'path',
    d: `M ${gx} ${sy - box.h * 0.06} L ${gx - box.h * 0.03} ${sy - box.h * 0.11} L ${gx + box.h * 0.03} ${sy - box.h * 0.11} Z`,
    fill: TOK.accent,
    color: TOK.ink,
    weight: 'sm',
    z: 4,
  });

  const close = Math.abs(P.guess - P.actual) <= 2;
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.94,
    text:
      P.revealed || revealP >= 0.99
        ? fill(P.labels.revealed, { guess: P.guess, actual: P.actual }) +
          (close ? P.labels.close : '')
        : fill(P.labels.guessing, { guess: P.guess }),
    color: P.revealed ? (close ? TOK.good : TOK.ink) : TOK.accent,
    size: box.h * 0.075,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  });
  return { prims, view: box };
}

export const Estimate: Manipulative<EstimateP> = {
  kind: 'estimate',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
