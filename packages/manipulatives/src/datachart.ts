/**
 * datachart.ts — categorical data (Cambridge: Statistics — pictogram, bar chart,
 * tally). One dataset, three views. verbs: setMode(mode) · addData(label,n) ·
 * highlightBar(label) · showTotal.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { TOK } from './util';

export type DataCat = { label: string; value: number };
export type DataChartP = {
  categories: DataCat[];
  mode: 'bar' | 'picto' | 'tally';
  unit: number; // pictogram: value per icon
  highlight: string | null;
  showTotal: boolean;
  labels: { total: string }; // {n} = sum
};

const DEFAULT: DataChartP = {
  categories: [
    { label: 'Red', value: 4 },
    { label: 'Blue', value: 6 },
    { label: 'Yellow', value: 3 },
  ],
  mode: 'bar',
  unit: 1,
  highlight: null,
  showTotal: false,
  labels: { total: 'Total = {n}' },
};
const PALETTE = [TOK.accent, TOK.accent2, TOK.good, TOK.warn, TOK.soft];

function normalize(raw: unknown): DataChartP {
  const r = (raw ?? {}) as Partial<DataChartP>;
  return {
    categories: (r.categories ?? DEFAULT.categories).map((c) => ({
      label: c.label ?? '',
      value: num(c.value),
    })),
    mode: r.mode ?? 'bar',
    unit: Math.max(1, num(r.unit ?? 1)),
    highlight: r.highlight ?? null,
    showTotal: !!r.showTotal,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  };
}
function fill(t: string, v: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<DataChartP>['verbs'] = {
  setMode(p, args): VerbClip<DataChartP> {
    const mode = (args?.mode ?? args) as DataChartP['mode'];
    return tween(
      p,
      { ...p, mode: ['bar', 'picto', 'tally'].includes(mode) ? mode : 'bar' },
      0.5,
      'easeOutCubic',
    );
  },
  addData(p, args): VerbClip<DataChartP> {
    const label = String(args?.label ?? '');
    const n = num(args?.n ?? 1);
    const categories = p.categories.map((c) =>
      c.label === label ? { ...c, value: c.value + n } : c,
    );
    if (!categories.some((c) => c.label === label)) categories.push({ label, value: n });
    return tween(p, { ...p, categories }, 0.5, 'easeOutBack');
  },
  highlightBar(p, args): VerbClip<DataChartP> {
    return tween(p, { ...p, highlight: String(args?.label ?? args ?? '') }, 0.4, 'easeOutCubic');
  },
  showTotal(p): VerbClip<DataChartP> {
    return tween(p, { ...p, showTotal: true }, 0.4, 'easeOutBack');
  },
};

function tallyPath(x: number, y: number, h: number, count: number): Prim[] {
  const out: Prim[] = [];
  const gap = h * 0.5;
  let cx = x;
  for (let g = 0; g < Math.ceil(count / 5); g++) {
    const inGroup = Math.min(5, count - g * 5);
    for (let i = 0; i < Math.min(4, inGroup); i++) {
      out.push({
        k: 'line',
        x1: cx + i * (h * 0.28),
        y1: y,
        x2: cx + i * (h * 0.28),
        y2: y + h,
        color: TOK.ink,
        weight: 'sm',
        z: 2,
      });
    }
    if (inGroup === 5)
      out.push({
        k: 'line',
        x1: cx - h * 0.1,
        y1: y + h * 0.9,
        x2: cx + 3.4 * (h * 0.28),
        y2: y + h * 0.1,
        color: TOK.ink,
        weight: 'sm',
        z: 2,
      });
    cx += 4 * (h * 0.28) + gap;
  }
  return out;
}

function render(
  _params: DataChartP,
  state: ManipState<DataChartP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const cats = P.categories;
  const n = cats.length;
  const pad = box.w * 0.08;
  const baseY = box.h * 0.82;
  const chartH = box.h * 0.6;
  const maxV = Math.max(1, ...cats.map((c) => c.value));
  const slot = (box.w - 2 * pad) / n;
  const fromVal = (label: string) => seg.from.categories.find((c) => c.label === label)?.value ?? 0;
  const growVal = (c: DataCat) =>
    seg.verb === 'addData' ? fromVal(c.label) + (c.value - fromVal(c.label)) * seg.p : c.value;

  cats.forEach((c, i) => {
    const cx = pad + slot * (i + 0.5);
    const v = growVal(c);
    const color = PALETTE[i % PALETTE.length];
    const hi = P.highlight === c.label;
    if (P.mode === 'bar') {
      const bw = slot * 0.6;
      const bh = (v / maxV) * chartH;
      prims.push({
        k: 'rect',
        x: cx - bw / 2,
        y: baseY - bh,
        w: bw,
        h: bh,
        fill: color,
        color: TOK.ink,
        weight: 'sm',
        opacity: hi ? 1 : 0.92,
        z: hi ? 3 : 2,
      });
      prims.push({
        k: 'label',
        x: cx,
        y: baseY - bh - box.h * 0.03,
        text: String(Math.round(v)),
        color: TOK.ink,
        size: box.h * 0.06,
        align: 'middle',
        baseline: 'middle',
        z: 3,
      });
    } else if (P.mode === 'picto') {
      const icons = Math.round(v / P.unit);
      const r = Math.min(slot * 0.16, box.h * 0.04);
      for (let k = 0; k < icons; k++) {
        prims.push({
          k: 'circle',
          cx,
          cy: baseY - k * (r * 2.4) - r,
          r,
          fill: color,
          color: TOK.ink,
          weight: 'sm',
          z: 2,
        });
      }
    } else {
      prims.push(...tallyPath(cx - slot * 0.3, baseY - chartH * 0.5, box.h * 0.09, Math.round(v)));
    }
    prims.push({
      k: 'label',
      x: cx,
      y: baseY + box.h * 0.06,
      text: c.label,
      color: TOK.soft,
      size: box.h * 0.055,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    });
  });

  // axis
  prims.push({
    k: 'line',
    x1: pad * 0.7,
    y1: baseY,
    x2: box.w - pad * 0.5,
    y2: baseY,
    color: TOK.ink,
    weight: 'sm',
    z: 1,
  });
  if (P.mode === 'picto')
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.1,
      text: `● = ${P.unit}`,
      color: TOK.soft,
      size: box.h * 0.055,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    });
  if (P.showTotal)
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.96,
      text: fill(P.labels.total, { n: cats.reduce((s, c) => s + c.value, 0) }),
      color: TOK.ink,
      size: box.h * 0.07,
      align: 'middle',
      baseline: 'middle',
      z: 4,
    });

  return { prims, view: box };
}

export const DataChart: Manipulative<DataChartP> = {
  kind: 'datachart',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
