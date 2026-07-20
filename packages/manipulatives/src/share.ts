/**
 * share.ts — equal sharing / grouping (chia đều) — division. `total` objects are
 * dealt one-by-one, round-robin, into `groups` bins; the leftover is the
 * remainder. Teaches total ÷ groups = perGroup (dư remainder).
 * verbs: setTotal(n) · setGroups(g) · deal · highlight(bin).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, TOK } from './util';

export type ShareP = {
  total: number;
  groups: number;
  dealt: number;
  highlight: number | null;
  labels: { result: string; remainder: string; dealing: string };
};

const DEFAULT: ShareP = {
  total: 12,
  groups: 3,
  dealt: 12,
  highlight: null,
  labels: {
    result: '{total} ÷ {g} = {per}',
    remainder: ' r {rem}',
    dealing: 'Sharing {total} into {g} groups…',
  },
};

function normalize(raw: unknown): ShareP {
  const r = (raw ?? {}) as Partial<ShareP>;
  const total = Math.max(0, Math.floor(r.total ?? 12));
  return {
    total,
    groups: Math.max(1, Math.floor(r.groups ?? 3)),
    dealt: r.dealt ?? total,
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

const verbs: Manipulative<ShareP>['verbs'] = {
  setTotal(p, args): VerbClip<ShareP> {
    const n = Math.max(0, Math.floor(num(args?.n ?? args ?? p.total)));
    return tween(p, { ...p, total: n, dealt: n }, 0.45, 'easeOutBack');
  },
  setGroups(p, args): VerbClip<ShareP> {
    return tween(
      p,
      { ...p, groups: Math.max(1, Math.floor(num(args?.g ?? args ?? p.groups))) },
      0.5,
      'spring',
    );
  },
  deal(p): VerbClip<ShareP> {
    return tween(
      { ...p, dealt: 0 },
      { ...p, dealt: p.total },
      Math.max(0.7, p.total * 0.12),
      'linear',
    );
  },
  highlight(p, args): VerbClip<ShareP> {
    return tween(
      p,
      { ...p, highlight: Math.floor(num(args?.bin ?? args ?? 0)) },
      0.3,
      'easeOutCubic',
    );
  },
};

function render(_params: ShareP, state: ManipState<ShareP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const dealt =
    seg.verb === 'deal' ? Math.floor(lerp(seg.from.dealt, seg.to.dealt, seg.p)) : P.dealt;
  const g = P.groups;
  const pad = box.w * 0.05;
  const gap = box.w * 0.02;
  const binW = (box.w - 2 * pad - (g - 1) * gap) / g;
  const binTop = box.h * 0.16,
    binH = box.h * 0.58;
  const r = Math.min(binW * 0.16, box.h * 0.05);

  for (let b = 0; b < g; b++) {
    const x = pad + b * (binW + gap);
    const hi = P.highlight === b;
    prims.push({
      k: 'rect',
      x,
      y: binTop,
      w: binW,
      h: binH,
      fill: hi ? TOK.warn : 'none',
      color: TOK.ink,
      weight: 'md',
      rx: 10,
      opacity: hi ? 0.18 : 1,
      z: 1,
    });
    // objects dealt round-robin to this bin
    const cols = Math.max(1, Math.floor((binW - r) / (r * 2.4)));
    let k = 0;
    for (let i = b; i < dealt; i += g) {
      const cx = x + binW / 2 + ((k % cols) - (cols - 1) / 2) * (r * 2.4);
      const cy = binTop + binH - r * 1.4 - Math.floor(k / cols) * (r * 2.4);
      prims.push({ k: 'circle', cx, cy, r, fill: TOK.accent, color: TOK.ink, weight: 'sm', z: 3 });
      k++;
    }
  }
  const per = Math.floor(P.total / g);
  const rem = P.total % g;
  const done = dealt >= P.total;
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.92,
    text: done
      ? fill(P.labels.result, { total: P.total, g, per }) +
        (rem ? fill(P.labels.remainder, { rem }) : '')
      : fill(P.labels.dealing, { total: P.total, g }),
    color: TOK.ink,
    size: box.h * 0.1,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  });
  return { prims, view: box };
}

export const ShareGroup: Manipulative<ShareP> = {
  kind: 'share',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
