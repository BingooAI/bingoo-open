/**
 * count.ts — CountObjects (đếm vật thật). Shows `count` icons (apple / star /
 * flower / heart / dot) arranged like a ten-frame (rows of 5) with a big number,
 * for teaching one-to-one counting 1→10. Icons are path/circle prims (line-art,
 * deterministic, seek-exact). verbs: add(n) · remove(n) · setCount(n) ·
 * setShape(shape) · highlight(i).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { TOK } from './util';

/** built-in line-art icons; any other string is valid too (falls back to a dot
 *  unless you provide a media image for it via `assets`). */
export type CountShape = 'apple' | 'star' | 'flower' | 'heart' | 'dot' | (string & {});
export type CountP = {
  count: number;
  shape: CountShape;
  highlight: number | null;
  /** media library: object image per shape (URL/data-URI/asset id). If present
   *  for the active shape, the countable object is drawn from YOUR image instead
   *  of the built-in line-art icon. */
  assets?: Partial<Record<string, string>>;
  /** treat `assets` values as built-in SVG-asset ids rather than URLs. */
  assetMode?: boolean;
};

const SHAPES: CountShape[] = ['apple', 'star', 'flower', 'heart', 'dot'];
const DEFAULT: CountP = { count: 0, shape: 'apple', highlight: null };

function normalize(raw: unknown): CountP {
  const r = (raw ?? {}) as Partial<CountP>;
  return {
    count: Math.max(0, Math.floor(r.count ?? 0)),
    shape: (typeof r.shape === 'string' && r.shape) || 'apple',
    highlight: r.highlight ?? null,
    assets: r.assets,
    assetMode: !!r.assetMode,
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<CountP>['verbs'] = {
  add(p, args): VerbClip<CountP> {
    const n = Math.max(0, Math.floor(num(args?.n ?? args ?? 1)));
    return tween(p, { ...p, count: p.count + n }, 0.4, 'easeOutBack');
  },
  remove(p, args): VerbClip<CountP> {
    const n = Math.max(0, Math.floor(num(args?.n ?? args ?? 1)));
    return tween(p, { ...p, count: Math.max(0, p.count - n) }, 0.35, 'easeInCubic');
  },
  setCount(p, args): VerbClip<CountP> {
    return tween(
      p,
      { ...p, count: Math.max(0, Math.floor(num(args?.n ?? args ?? 0))) },
      0.45,
      'easeOutBack',
    );
  },
  setShape(p, args): VerbClip<CountP> {
    const s = (args?.shape ?? args) as CountShape;
    return tween(p, { ...p, shape: SHAPES.includes(s) ? s : p.shape }, 0.3, 'easeOutCubic');
  },
  highlight(p, args): VerbClip<CountP> {
    return tween(
      p,
      { ...p, highlight: Math.floor(num(args?.i ?? args ?? 1)) },
      0.35,
      'easeOutBack',
    );
  },
};

/* ---------------------------------------------------------------- icons */

function starPath(cx: number, cy: number, r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.44;
    d += `${i === 0 ? 'M' : 'L'} ${cx + Math.cos(ang) * rad} ${cy + Math.sin(ang) * rad} `;
  }
  return d + 'Z';
}
function heartPath(cx: number, cy: number, r: number): string {
  const t = cy - r * 0.35;
  return `M ${cx} ${cy + r} C ${cx - r * 1.4} ${cy - r * 0.2} ${cx - r * 0.6} ${t - r} ${cx} ${cy - r * 0.35} C ${cx + r * 0.6} ${t - r} ${cx + r * 1.4} ${cy - r * 0.2} ${cx} ${cy + r} Z`;
}

/** Draw one icon centred at (cx,cy) with radius r. */
function icon(
  prims: Prim[],
  shape: CountShape,
  cx: number,
  cy: number,
  r: number,
  op: number,
  hi: boolean,
) {
  if (hi) prims.push({ k: 'circle', cx, cy, r: r * 1.35, fill: TOK.warn, opacity: 0.3 * op, z: 2 });
  switch (shape) {
    case 'apple':
      prims.push({
        k: 'circle',
        cx,
        cy: cy + r * 0.1,
        r: r * 0.92,
        fill: TOK.accent,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z: 3,
      });
      prims.push({
        k: 'line',
        x1: cx,
        y1: cy - r * 0.7,
        x2: cx + r * 0.15,
        y2: cy - r * 1.05,
        color: TOK.ink,
        weight: 'sm',
        cap: 'round',
        opacity: op,
        z: 4,
      });
      prims.push({
        k: 'path',
        d: `M ${cx + r * 0.12} ${cy - r} Q ${cx + r * 0.75} ${cy - r * 1.15} ${cx + r * 0.7} ${cy - r * 0.6} Q ${cx + r * 0.35} ${cy - r * 0.7} ${cx + r * 0.12} ${cy - r} Z`,
        fill: TOK.good,
        color: TOK.ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z: 4,
      });
      break;
    case 'star':
      prims.push({
        k: 'path',
        d: starPath(cx, cy, r),
        fill: TOK.warn,
        color: TOK.ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z: 3,
      });
      break;
    case 'flower':
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
        prims.push({
          k: 'circle',
          cx: cx + Math.cos(a) * r * 0.55,
          cy: cy + Math.sin(a) * r * 0.55,
          r: r * 0.45,
          fill: TOK.accent,
          color: TOK.ink,
          weight: 'sm',
          opacity: op,
          z: 3,
        });
      }
      prims.push({
        k: 'circle',
        cx,
        cy,
        r: r * 0.4,
        fill: TOK.warn,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z: 4,
      });
      break;
    case 'heart':
      prims.push({
        k: 'path',
        d: heartPath(cx, cy, r * 0.85),
        fill: TOK.accent,
        color: TOK.ink,
        weight: 'sm',
        closed: true,
        opacity: op,
        z: 3,
      });
      break;
    case 'dot':
    default:
      prims.push({
        k: 'circle',
        cx,
        cy,
        r: r * 0.85,
        fill: TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        opacity: op,
        z: 3,
      });
      break;
  }
}

function render(_params: CountP, state: ManipState<CountP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const cols = 5;
  const shown = Math.max(P.count, seg.from.count);
  const rows = Math.max(1, Math.ceil(Math.max(1, shown) / cols));
  const cell = Math.min((box.w * 0.82) / cols, (box.h * 0.6) / rows);
  const gw = cols * cell;
  const ox = (box.w - gw) / 2,
    oy = box.h * 0.12;
  const r = cell * 0.34;
  const addBase = Math.min(seg.from.count, P.count);

  const centerOf = (i: number) => ({
    x: ox + (i % cols) * cell + cell / 2,
    y: oy + Math.floor(i / cols) * cell + cell / 2,
  });

  // faint frame slots (like a ten-frame) up to 10
  for (let i = 0; i < Math.min(10, Math.max(cols * rows, 10)); i++) {
    const c = centerOf(i);
    prims.push({
      k: 'rect',
      x: c.x - cell / 2,
      y: c.y - cell / 2,
      w: cell,
      h: cell,
      fill: 'none',
      color: TOK.faint,
      weight: 'sm',
      z: 1,
    });
  }

  // each countable object: YOUR library image if provided for this shape,
  // otherwise the built-in line-art icon.
  const src = P.assets?.[P.shape];
  const drawObj = (cx: number, cy: number, rr: number, op: number, hi: boolean) => {
    if (hi)
      prims.push({ k: 'circle', cx, cy, r: rr * 1.35, fill: TOK.warn, opacity: 0.3 * op, z: 2 });
    if (src)
      prims.push({
        k: 'image',
        x: cx - rr,
        y: cy - rr,
        w: rr * 2,
        h: rr * 2,
        ...(P.assetMode ? { asset: src } : { src }),
        opacity: op,
        z: 3,
      });
    else icon(prims, P.shape, cx, cy, rr, op, false);
  };

  for (let i = 0; i < P.count; i++) {
    const c = centerOf(i);
    let op = 1,
      rr = r;
    if (seg.verb === 'add' && i >= addBase) {
      op = seg.p;
      rr = r * (0.3 + 0.7 * seg.p);
    }
    drawObj(c.x, c.y, rr, op, P.highlight === i + 1);
  }
  // removed objects fade out
  if (seg.verb === 'remove') {
    for (let i = P.count; i < seg.from.count; i++) {
      const c = centerOf(i);
      drawObj(c.x, c.y, r, 1 - seg.p, false);
    }
  }

  // big count number
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.9,
    text: String(P.count),
    color: TOK.accent,
    size: box.h * 0.16,
    align: 'middle',
    baseline: 'middle',
    z: 6,
  });

  return { prims, view: box };
}

export const CountObjects: Manipulative<CountP> = {
  kind: 'count',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
