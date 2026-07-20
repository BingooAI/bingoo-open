/**
 * barmodel.ts — Singapore bar model (kit #5). params: { bars:[{label,value,
 * unknown?}] }  verbs: partition · compare · showUnknown · combine.
 * Bars share one value→length scale so lengths are comparable and code-checkable.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, TOK } from './util';

export type Bar = { label: string; value: number; unknown?: boolean };
export type BarModelP = {
  bars: Bar[];
  parts: number | null; // partition count on the first bar
  revealUnknown: boolean;
  combined: boolean;
};

const DEFAULT: BarModelP = {
  bars: [
    { label: 'a', value: 4 },
    { label: 'b', value: 6 },
  ],
  parts: null,
  revealUnknown: false,
  combined: false,
};

function normalize(raw: unknown): BarModelP {
  const r = (raw ?? {}) as Partial<BarModelP>;
  return {
    bars: (r.bars ?? DEFAULT.bars).map((b) => ({
      label: b.label ?? '',
      value: num(b.value),
      unknown: !!b.unknown,
    })),
    parts: r.parts ?? null,
    revealUnknown: !!r.revealUnknown,
    combined: !!r.combined,
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<BarModelP>['verbs'] = {
  partition(p, args): VerbClip<BarModelP> {
    const n = Math.max(1, Math.floor(num(args?.n ?? args ?? 2)));
    return tween(p, { ...p, parts: n }, 0.5, 'spring');
  },
  compare(p): VerbClip<BarModelP> {
    return tween(p, { ...p }, 0.4, 'easeOutCubic');
  },
  showUnknown(p): VerbClip<BarModelP> {
    return tween(p, { ...p, revealUnknown: true }, 0.5, 'easeOutBack');
  },
  combine(p): VerbClip<BarModelP> {
    return tween(p, { ...p, combined: true }, 0.6, 'easeInOutCubic');
  },
};

function render(
  _params: BarModelP,
  state: ManipState<BarModelP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const pad = box.w * 0.06;
  const maxVal = Math.max(
    1,
    ...P.bars.map((b) => b.value),
    P.combined ? P.bars.reduce((s, b) => s + b.value, 0) : 0,
  );
  const scale = (box.w - 2 * pad) / maxVal;
  const barH = Math.min(box.h * 0.16, (box.h * 0.7) / Math.max(1, P.bars.length));
  const gap = barH * 0.5;
  const combineProg = seg.verb === 'combine' ? seg.p : P.combined ? 1 : 0;

  let y = box.h * 0.16;
  let combineX = pad;
  P.bars.forEach((b, i) => {
    const len = b.value * scale;
    const drawX = P.combined ? lerp(pad, combineX, combineProg) : pad;
    const yy = P.combined ? lerp(y, box.h * 0.4, combineProg) : y;
    const known = !b.unknown || P.revealUnknown;
    prims.push({
      k: 'rect',
      x: drawX,
      y: yy,
      w: len,
      h: barH,
      fill: known ? (i === 0 ? TOK.accent : TOK.accent2) : TOK.paper,
      color: TOK.ink,
      weight: 'sm',
      z: 2,
    });
    // partition ticks on first bar
    if (i === 0 && P.parts) {
      const n = P.parts;
      const grow = seg.verb === 'partition' ? seg.p : 1;
      for (let k = 1; k < n; k++) {
        const px = drawX + (len * k) / n;
        prims.push({
          k: 'line',
          x1: px,
          y1: yy,
          x2: px,
          y2: yy + barH * grow,
          color: TOK.ink,
          weight: 'sm',
          z: 3,
        });
      }
    }
    prims.push({
      k: 'label',
      x: drawX + len / 2,
      y: yy + barH / 2,
      text: b.unknown && !P.revealUnknown ? '?' : `${b.label}=${b.value}`,
      color: TOK.ink,
      size: barH * 0.5,
      align: 'middle',
      baseline: 'middle',
      z: 4,
    });
    if (P.combined) combineX += len;
    y += barH + gap;
  });
  return { prims, view: box };
}

export const BarModel: Manipulative<BarModelP> = {
  kind: 'barmodel',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
