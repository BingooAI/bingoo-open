/**
 * spinner.ts — probability spinner (Cambridge: probability, likelihood). A wheel
 * of weighted sectors + a pointer. `spin(to)` rotates the pointer (baked, multi-
 * turn, settling on a sector) — deterministic, no live randomness.
 * verbs: spin(to) · addSector(label,weight) · highlightOutcome(index).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, TOK } from './util';

export type SpinSector = { label: string; weight: number };
export type SpinnerP = {
  sectors: SpinSector[];
  angle: number;
  highlight: number | null;
  labels: { result: string };
};

const DEFAULT: SpinnerP = {
  sectors: [
    { label: 'A', weight: 1 },
    { label: 'B', weight: 1 },
    { label: 'C', weight: 1 },
    { label: 'D', weight: 1 },
  ],
  angle: 0,
  highlight: null,
  labels: { result: 'Result: {label}' },
};
const PALETTE = [TOK.accent, TOK.accent2, TOK.good, TOK.warn, TOK.faint, TOK.soft];

function normalize(raw: unknown): SpinnerP {
  const r = (raw ?? {}) as Partial<SpinnerP>;
  return {
    sectors: (r.sectors ?? DEFAULT.sectors).map((s) => ({
      label: s.label ?? '',
      weight: Math.max(0.001, num(s.weight ?? 1)),
    })),
    angle: num(r.angle ?? 0),
    highlight: r.highlight ?? null,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  };
}
const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function sectorBounds(sectors: SpinSector[]): { start: number; end: number; mid: number }[] {
  const total = sectors.reduce((s, x) => s + x.weight, 0) || 1;
  let a = -Math.PI / 2;
  return sectors.map((s) => {
    const span = (s.weight / total) * Math.PI * 2;
    const b = a + span;
    const out = { start: a, end: b, mid: (a + b) / 2 };
    a = b;
    return out;
  });
}

const verbs: Manipulative<SpinnerP>['verbs'] = {
  spin(p, args): VerbClip<SpinnerP> {
    const to = Math.max(0, Math.min(p.sectors.length - 1, Math.floor(num(args?.to ?? args ?? 0))));
    const bounds = sectorBounds(p.sectors);
    // pointer sits at top (-90°); land its angle on the chosen sector's middle
    const target = -Math.PI / 2 - bounds[to]!.mid + Math.PI * 6; // +3 turns
    return tween(
      { ...p, highlight: null },
      { ...p, angle: p.angle + target, highlight: to },
      1.1,
      'easeOutCubic',
    );
  },
  addSector(p, args): VerbClip<SpinnerP> {
    return tween(
      p,
      {
        ...p,
        sectors: [
          ...p.sectors,
          { label: String(args?.label ?? ''), weight: Math.max(0.001, num(args?.weight ?? 1)) },
        ],
      },
      0.4,
      'easeOutBack',
    );
  },
  highlightOutcome(p, args): VerbClip<SpinnerP> {
    return tween(
      p,
      { ...p, highlight: Math.floor(num(args?.index ?? args ?? 0)) },
      0.4,
      'easeOutCubic',
    );
  },
};

function render(
  _params: SpinnerP,
  state: ManipState<SpinnerP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const cx = box.w / 2,
    cy = box.h * 0.52;
  const R = Math.min(box.w, box.h) * 0.4;
  const bounds = sectorBounds(P.sectors);
  const angle = seg.verb === 'spin' ? lerp(seg.from.angle, seg.to.angle, seg.p) : P.angle;

  P.sectors.forEach((s, i) => {
    const b = bounds[i]!;
    const x0 = cx + Math.cos(b.start) * R,
      y0 = cy + Math.sin(b.start) * R;
    const x1 = cx + Math.cos(b.end) * R,
      y1 = cy + Math.sin(b.end) * R;
    const large = b.end - b.start > Math.PI ? 1 : 0;
    const hi = P.highlight === i && seg.verb !== 'spin';
    prims.push({
      k: 'path',
      d: `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`,
      fill: PALETTE[i % PALETTE.length],
      color: TOK.ink,
      weight: 'sm',
      opacity: hi ? 1 : 0.85,
      closed: true,
      z: 2,
    });
    prims.push({
      k: 'label',
      x: cx + Math.cos(b.mid) * R * 0.62,
      y: cy + Math.sin(b.mid) * R * 0.62,
      text: s.label,
      color: TOK.ink,
      size: R * 0.16,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    });
  });
  prims.push({ k: 'circle', cx, cy, r: R, fill: 'none', color: TOK.ink, weight: 'md', z: 4 });
  // pointer (rotates around centre)
  const px = cx + Math.cos(angle) * (R * 0.9),
    py = cy + Math.sin(angle) * (R * 0.9);
  const perp = angle + Math.PI / 2;
  prims.push({
    k: 'path',
    d: `M ${cx + Math.cos(perp) * R * 0.06} ${cy + Math.sin(perp) * R * 0.06} L ${px} ${py} L ${cx - Math.cos(perp) * R * 0.06} ${cy - Math.sin(perp) * R * 0.06} Z`,
    fill: TOK.ink,
    color: TOK.ink,
    weight: 'sm',
    closed: true,
    z: 5,
  });
  prims.push({
    k: 'circle',
    cx,
    cy,
    r: R * 0.08,
    fill: TOK.paper,
    color: TOK.ink,
    weight: 'sm',
    z: 6,
  });

  if (P.highlight !== null && seg.verb !== 'spin') {
    prims.push({
      k: 'label',
      x: cx,
      y: cy + R * 1.2,
      text: fill(P.labels.result, { label: P.sectors[P.highlight]?.label ?? '' }),
      color: TOK.accent,
      size: box.h * 0.08,
      align: 'middle',
      baseline: 'middle',
      z: 6,
    });
  }
  return { prims, view: box };
}

export const ProbabilitySpinner: Manipulative<SpinnerP> = {
  kind: 'spinner',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
