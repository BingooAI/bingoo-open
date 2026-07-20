/**
 * fractionwall.ts — Fraction wall (Cambridge: compare & equivalent fractions).
 * Stacked unit bars each split into 1, 2, 3 … equal parts. verbs: addRow(n) ·
 * highlightRow(n) · shadeRow(n,k) · compare(a,b).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { TOK } from './util';

export type FractionWallP = {
  rows: number[]; // denominators, top→bottom
  shade: Record<number, number>; // denominator → parts shaded
  highlight: number[]; // denominators highlighted
};

const DEFAULT: FractionWallP = { rows: [1, 2, 3, 4], shade: {}, highlight: [] };

function normalize(raw: unknown): FractionWallP {
  const r = (raw ?? {}) as Partial<FractionWallP>;
  return {
    rows: [...(r.rows ?? [1, 2, 3, 4])],
    shade: { ...(r.shade ?? {}) },
    highlight: [...(r.highlight ?? [])],
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<FractionWallP>['verbs'] = {
  addRow(p, args): VerbClip<FractionWallP> {
    const n = Math.max(1, Math.floor(num(args?.n ?? args ?? 2)));
    return tween(
      p,
      { ...p, rows: p.rows.includes(n) ? p.rows : [...p.rows, n].sort((a, b) => a - b) },
      0.5,
      'spring',
    );
  },
  highlightRow(p, args): VerbClip<FractionWallP> {
    const n = Math.floor(num(args?.n ?? args ?? 2));
    return tween(p, { ...p, highlight: [n] }, 0.4, 'easeOutCubic');
  },
  shadeRow(p, args): VerbClip<FractionWallP> {
    const n = Math.floor(num(args?.n ?? 2));
    const k = Math.floor(num(args?.k ?? 1));
    return tween(p, { ...p, shade: { ...p.shade, [n]: k } }, 0.45, 'easeOutCubic');
  },
  compare(p, args): VerbClip<FractionWallP> {
    const a = Math.floor(num(args?.a ?? 2));
    const b = Math.floor(num(args?.b ?? 4));
    return tween(p, { ...p, highlight: [a, b] }, 0.5, 'easeOutBack');
  },
};

function render(
  _params: FractionWallP,
  state: ManipState<FractionWallP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const pad = box.w * 0.06;
  const wallW = box.w - 2 * pad;
  const rowH = Math.min((box.h * 0.86) / Math.max(1, P.rows.length), box.h * 0.16);
  const oy = (box.h - rowH * P.rows.length) / 2;
  const newRow = seg.verb === 'addRow' ? P.rows.find((d) => !seg.from.rows.includes(d)) : undefined;

  P.rows.forEach((den, ri) => {
    const y = oy + ri * rowH;
    const grow = den === newRow ? seg.p : 1;
    const segW = wallW / den;
    const hi = P.highlight.includes(den);
    const shaded = P.shade[den] ?? 0;
    for (let i = 0; i < den; i++) {
      const filled = i < shaded;
      prims.push({
        k: 'rect',
        x: pad + i * segW * grow,
        y,
        w: segW * grow,
        h: rowH * 0.9,
        fill: filled ? TOK.accent : hi ? TOK.accent2 : TOK.paper,
        color: TOK.ink,
        weight: 'sm',
        opacity: grow * (hi || filled ? 1 : 0.9),
        z: hi ? 3 : 2,
      });
    }
    prims.push({
      k: 'label',
      x: pad - box.w * 0.005,
      y: y + rowH * 0.45,
      text: den === 1 ? '1' : `1/${den}`,
      color: TOK.soft,
      size: rowH * 0.4,
      align: 'end',
      baseline: 'middle',
      opacity: grow,
      z: 4,
    });
  });

  return { prims, view: box };
}

export const FractionWall: Manipulative<FractionWallP> = {
  kind: 'fractionwall',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
