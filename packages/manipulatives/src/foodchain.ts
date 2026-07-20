/**
 * foodchain.ts — food chain / energy flow (Cambridge Primary Science: Biology —
 * feeding relationships). Organisms linked left→right by energy arrows.
 * verbs: addLink · addOrganism(label) · highlight(i).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { clamp01, TOK } from './util';

export type FoodChainP = {
  organisms: string[];
  links: number;
  highlight: number | null;
  labels: { energyFlow: string };
};

const DEFAULT: FoodChainP = {
  organisms: ['Grass', 'Grasshopper', 'Frog', 'Snake'],
  links: 0,
  highlight: null,
  labels: { energyFlow: '→ direction of energy flow' },
};

function normalize(raw: unknown): FoodChainP {
  const r = (raw ?? {}) as Partial<FoodChainP>;
  return {
    organisms: [...(r.organisms ?? DEFAULT.organisms)],
    links: Math.floor(r.links ?? 0),
    highlight: r.highlight ?? null,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<FoodChainP>['verbs'] = {
  addLink(p): VerbClip<FoodChainP> {
    return tween(
      p,
      { ...p, links: Math.min(p.organisms.length - 1, p.links + 1) },
      0.55,
      'easeOutCubic',
    );
  },
  addOrganism(p, args): VerbClip<FoodChainP> {
    return tween(
      p,
      { ...p, organisms: [...p.organisms, String(args?.label ?? args ?? '')] },
      0.4,
      'easeOutBack',
    );
  },
  highlight(p, args): VerbClip<FoodChainP> {
    return tween(
      p,
      { ...p, highlight: Math.floor(num(args?.i ?? args ?? 0)) },
      0.35,
      'easeOutCubic',
    );
  },
};

function render(
  _params: FoodChainP,
  state: ManipState<FoodChainP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const n = P.organisms.length;
  const pad = box.w * 0.04;
  const slot = (box.w - 2 * pad) / n;
  const cy = box.h * 0.5;
  const boxW = slot * 0.72,
    boxH = box.h * 0.2;
  const newLink = seg.verb === 'addLink' ? P.links - 1 : -1;

  P.organisms.forEach((org, i) => {
    const cx = pad + slot * (i + 0.5);
    const hi = P.highlight === i;
    prims.push({
      k: 'rect',
      x: cx - boxW / 2,
      y: cy - boxH / 2,
      w: boxW,
      h: boxH,
      fill: hi ? TOK.warn : TOK.good,
      color: TOK.ink,
      weight: 'md',
      rx: 10,
      opacity: hi ? 0.6 : 1,
      z: 2,
    });
    prims.push({
      k: 'label',
      x: cx,
      y: cy,
      text: org,
      color: TOK.ink,
      size: box.h * 0.06,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    });
    // energy arrow to next
    if (i < n - 1 && i < P.links) {
      const grow = i === newLink ? clamp01(seg.p) : 1;
      const ax0 = cx + boxW / 2,
        ax1 = pad + slot * (i + 1.5) - boxW / 2;
      const ex = ax0 + (ax1 - ax0) * grow;
      prims.push({
        k: 'line',
        x1: ax0,
        y1: cy,
        x2: ex,
        y2: cy,
        color: TOK.accent,
        weight: 'md',
        z: 1,
      });
      if (grow > 0.9)
        prims.push({
          k: 'path',
          d: `M ${ax1 - 12} ${cy - 8} L ${ax1} ${cy} L ${ax1 - 12} ${cy + 8}`,
          color: TOK.accent,
          weight: 'md',
          z: 1,
        });
    }
  });
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.86,
    text: P.labels.energyFlow,
    color: TOK.soft,
    size: box.h * 0.05,
    align: 'middle',
    baseline: 'middle',
    z: 4,
  });
  return { prims, view: box };
}

export const FoodChain: Manipulative<FoodChainP> = {
  kind: 'foodchain',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
