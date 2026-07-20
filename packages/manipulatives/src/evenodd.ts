/**
 * evenodd.ts — even / odd (số chẵn, số lẻ). `number` objects arranged in pairs
 * (2 columns); if one is left over the number is odd, else even. Teaches
 * n = 2·k (+1). verbs: setNumber(n) · add(n) · remove(n) · showResult.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { TOK } from './util';
import { drawIcon } from './icons';

export type EvenOddP = {
  number: number;
  showResult: boolean;
  labels: { odd: string; even: string };
  /** the object being counted — draws real stars/apples/hearts to match the
   *  narration instead of a plain dot. */
  icon: string;
  /** media library: an image URL for the icon (overrides the built-in art). */
  assets?: Partial<Record<string, string>>;
  assetMode?: boolean;
};

const DEFAULT: EvenOddP = {
  number: 7,
  showResult: false,
  labels: { odd: '{n} is ODD', even: '{n} is EVEN' },
  icon: 'star',
};

function normalize(raw: unknown): EvenOddP {
  const r = (raw ?? {}) as Partial<EvenOddP>;
  return {
    number: Math.max(0, Math.floor(r.number ?? 7)),
    showResult: !!r.showResult,
    labels: { ...DEFAULT.labels, ...(r.labels ?? {}) },
    icon: (typeof r.icon === 'string' && r.icon) || 'star',
    assets: r.assets,
    assetMode: !!r.assetMode,
  };
}
const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<EvenOddP>['verbs'] = {
  setNumber(p, args): VerbClip<EvenOddP> {
    return tween(
      p,
      { ...p, number: Math.max(0, Math.floor(num(args?.n ?? args ?? p.number))) },
      0.45,
      'easeOutBack',
    );
  },
  add(p, args): VerbClip<EvenOddP> {
    return tween(
      p,
      { ...p, number: p.number + Math.max(0, Math.floor(num(args?.n ?? args ?? 1))) },
      0.35,
      'easeOutBack',
    );
  },
  remove(p, args): VerbClip<EvenOddP> {
    return tween(
      p,
      { ...p, number: Math.max(0, p.number - Math.max(0, Math.floor(num(args?.n ?? args ?? 1)))) },
      0.3,
      'easeInCubic',
    );
  },
  showResult(p): VerbClip<EvenOddP> {
    return tween(p, { ...p, showResult: true }, 0.4, 'easeOutBack');
  },
};

function render(
  _params: EvenOddP,
  state: ManipState<EvenOddP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const n = P.number;
  const rows = Math.ceil(Math.max(1, n) / 2);
  const cell = Math.min(box.w * 0.16, (box.h * 0.62) / Math.max(1, rows));
  const r = cell * 0.34;
  const gridW = 2 * cell;
  const ox = box.w / 2 - gridW / 2 + cell / 2;
  const oy = box.h * 0.14 + cell / 2;
  const odd = n % 2 === 1;
  const addBase = Math.min(seg.from.number, P.number);

  for (let i = 0; i < n; i++) {
    const col = i % 2,
      row = Math.floor(i / 2);
    const leftover = odd && i === n - 1;
    const cx = leftover ? box.w / 2 : ox + col * cell;
    const cy = oy + row * cell;
    const grow = seg.verb === 'add' && i >= addBase ? seg.p : 1;
    // pair backing
    if (col === 0 && i + 1 < n)
      prims.push({
        k: 'rect',
        x: ox - cell * 0.5 + cell / 2 - r * 1.3,
        y: cy - r * 1.3,
        w: cell + r * 2.6 - cell * 0.02,
        h: r * 2.6,
        fill: TOK.faint,
        opacity: 0.5,
        rx: r,
        z: 1,
      });
    // draw the actual object the lesson names (star/apple/…) — leftover in warn
    drawIcon(prims, P.icon, cx, cy, r * grow, grow, {
      color: leftover ? TOK.warn : undefined,
      src: P.assets?.[P.icon],
      assetMode: P.assetMode,
    });
  }

  const label = P.showResult ? fill(odd ? P.labels.odd : P.labels.even, { n }) : String(n);
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.92,
    text: label,
    color: P.showResult ? (odd ? TOK.warn : TOK.good) : TOK.ink,
    size: box.h * 0.11,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  });
  return { prims, view: box };
}

export const EvenOdd: Manipulative<EvenOddP> = {
  kind: 'evenodd',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
