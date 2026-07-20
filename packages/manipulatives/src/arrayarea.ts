/**
 * arrayarea.ts — Array / area model (kit #4) for multiplication & area.
 * params: { rows, cols }  verbs: fill · splitArea(a,b) · highlightCell(r,c)
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { clamp01, lerp, TOK } from './util';

export type ArrayAreaP = {
  rows: number;
  cols: number;
  filled: boolean;
  split: number | null; // column index a where cols split into a | (cols-a)
  highlight: [number, number] | null;
};

const DEFAULT: ArrayAreaP = { rows: 3, cols: 4, filled: false, split: null, highlight: null };

function normalize(raw: unknown): ArrayAreaP {
  const r = (raw ?? {}) as Partial<ArrayAreaP>;
  return {
    rows: Math.max(1, Math.floor(r.rows ?? 3)),
    cols: Math.max(1, Math.floor(r.cols ?? 4)),
    filled: !!r.filled,
    split: r.split ?? null,
    highlight: r.highlight ?? null,
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<ArrayAreaP>['verbs'] = {
  fill(p): VerbClip<ArrayAreaP> {
    return tween(p, { ...p, filled: true }, 0.55, 'easeOutCubic');
  },
  splitArea(p, args): VerbClip<ArrayAreaP> {
    const a = Math.max(1, Math.min(p.cols - 1, Math.floor(num(args?.a ?? args ?? 1))));
    return tween(p, { ...p, split: a }, 0.5, 'spring');
  },
  highlightCell(p, args): VerbClip<ArrayAreaP> {
    const r = Math.max(0, Math.floor(num(args?.r ?? 0)));
    const c = Math.max(0, Math.floor(num(args?.c ?? 0)));
    return tween(p, { ...p, highlight: [r, c] }, 0.35, 'easeOutBack');
  },
};

function render(
  _params: ArrayAreaP,
  state: ManipState<ArrayAreaP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const pad = Math.min(box.w, box.h) * 0.1;
  const gw = box.w - 2 * pad;
  const gh = box.h - 2 * pad;
  const cw = gw / P.cols;
  const ch = gh / P.rows;
  const fillProg = seg.verb === 'fill' ? seg.p : P.filled ? 1 : 0;

  for (let r = 0; r < P.rows; r++) {
    for (let c = 0; c < P.cols; c++) {
      const idx = r * P.cols + c;
      const localFill = P.filled ? clamp01(fillProg * P.rows * P.cols - idx) : 0;
      const isHi = P.highlight && P.highlight[0] === r && P.highlight[1] === c;
      prims.push({
        k: 'rect',
        x: pad + c * cw,
        y: pad + r * ch,
        w: cw,
        h: ch,
        fill: isHi ? TOK.warn : localFill > 0 ? TOK.accent2 : TOK.paper,
        color: TOK.ink,
        weight: 'sm',
        opacity: isHi ? (seg.verb === 'highlightCell' ? seg.p : 1) : localFill > 0 ? localFill : 1,
        z: 2,
      });
    }
  }
  // split divider sweeps down
  if (P.split !== null) {
    const sx = pad + P.split * cw;
    const grow = seg.verb === 'splitArea' ? seg.p : 1;
    prims.push({
      k: 'line',
      x1: sx,
      y1: pad,
      x2: sx,
      y2: pad + lerp(0, gh, grow),
      color: TOK.accent,
      weight: 'lg',
      cap: 'round',
      z: 4,
    });
  }
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.95,
    text: `${P.rows} × ${P.cols} = ${P.rows * P.cols}`,
    color: TOK.ink,
    size: box.h * 0.1,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  });
  return { prims, view: box };
}

export const ArrayArea: Manipulative<ArrayAreaP> = {
  kind: 'arrayarea',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
