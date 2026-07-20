/**
 * placevalue.ts — Place-value chart with counters/discs (Cambridge: place value,
 * exchange/regroup). Columns labelled (Th H T O …) hold a digit card + that many
 * discs. `exchange` animates ten discs in a column collapsing into one disc in
 * the column to the left — value-preserving (verifiable by code via `pvValue`).
 * verbs: setValue(n) · addCounter(col) · exchange(col) · partition.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, clamp01, TOK } from './util';

export type PlaceValueP = { places: string[]; digits: number[]; expanded: boolean };

const DEFAULT: PlaceValueP = { places: ['H', 'T', 'O'], digits: [0, 0, 0], expanded: false };

export function pvValue(p: PlaceValueP): number {
  const n = p.digits.length;
  return p.digits.reduce((s, d, i) => s + d * Math.pow(10, n - 1 - i), 0);
}
function digitsFromValue(v: number, n: number): number[] {
  const out = new Array(n).fill(0);
  let x = Math.max(0, Math.floor(v));
  for (let i = n - 1; i >= 0; i--) {
    out[i] = x % 10;
    x = Math.floor(x / 10);
  }
  return out;
}
function normalize(raw: unknown): PlaceValueP {
  const r = (raw ?? {}) as Partial<PlaceValueP> & { value?: number };
  const places = r.places ?? DEFAULT.places;
  const digits = r.digits ?? digitsFromValue(r.value ?? 0, places.length);
  return { places, digits: [...digits], expanded: !!r.expanded };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<PlaceValueP>['verbs'] = {
  setValue(p, args): VerbClip<PlaceValueP> {
    return tween(
      p,
      { ...p, digits: digitsFromValue(num(args?.n ?? args ?? 0), p.places.length) },
      0.5,
      'easeOutBack',
    );
  },
  addCounter(p, args): VerbClip<PlaceValueP> {
    const col = Math.max(
      0,
      Math.min(p.places.length - 1, Math.floor(num(args?.col ?? args ?? p.places.length - 1))),
    );
    const digits = [...p.digits];
    digits[col] = digits[col]! + 1;
    return tween(p, { ...p, digits }, 0.4, 'easeOutBack');
  },
  exchange(p, args): VerbClip<PlaceValueP> {
    let col =
      args?.col !== undefined
        ? Math.floor(num(args.col))
        : p.digits.findIndex((d, i) => d >= 10 && i > 0);
    if (col < 0) col = p.digits.findIndex((d) => d >= 10);
    const digits = [...p.digits];
    if (col > 0 && digits[col]! >= 10) {
      digits[col] = digits[col]! - 10;
      digits[col - 1] = digits[col - 1]! + 1;
    }
    return tween(p, { ...p, digits }, 0.8, 'easeInOutCubic');
  },
  partition(p): VerbClip<PlaceValueP> {
    return tween(p, { ...p, expanded: true }, 0.5, 'easeOutCubic');
  },
};

function render(
  _params: PlaceValueP,
  state: ManipState<PlaceValueP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const from = seg.from;
  const to = seg.to;
  const p = seg.p;
  const prims: Prim[] = [];
  const n = to.places.length;
  const colW = (box.w * 0.9) / n;
  const ox = box.w * 0.05;
  const headerY = box.h * 0.12;
  const cardY = box.h * 0.26;
  const discTop = box.h * 0.4;
  const discR = Math.min(colW * 0.18, box.h * 0.045);
  const discStep = discR * 2.3;

  const colX = (c: number) => ox + c * colW + colW / 2;
  const discCenter = (c: number, idx: number) => ({
    x: colX(c),
    y: discTop + idx * discStep + discR,
  });

  // columns: header + separators
  for (let c = 0; c < n; c++) {
    prims.push({
      k: 'line',
      x1: ox + c * colW,
      y1: headerY,
      x2: ox + c * colW,
      y2: box.h * 0.9,
      color: TOK.faint,
      weight: 'sm',
      z: 0,
    });
    prims.push({
      k: 'label',
      x: colX(c),
      y: headerY,
      text: to.places[c]!,
      color: TOK.soft,
      size: box.h * 0.08,
      align: 'middle',
      baseline: 'middle',
      z: 1,
    });
  }
  prims.push({
    k: 'line',
    x1: ox + n * colW,
    y1: headerY,
    x2: ox + n * colW,
    y2: box.h * 0.9,
    color: TOK.faint,
    weight: 'sm',
    z: 0,
  });

  const isExchange = seg.verb === 'exchange';
  // which column lost ten (source) and gained one (dest)
  const srcCol = isExchange ? to.digits.findIndex((d, i) => d === from.digits[i]! - 10) : -1;
  const destCol = srcCol - 1;

  // digit cards (snap to result late in an exchange)
  const cardDigits = isExchange && p < 0.85 ? from.digits : to.digits;
  for (let c = 0; c < n; c++) {
    prims.push({
      k: 'label',
      x: colX(c),
      y: cardY,
      text: String(cardDigits[c]),
      color: TOK.ink,
      size: box.h * 0.12,
      align: 'middle',
      baseline: 'middle',
      z: 4,
    });
  }

  if (isExchange && srcCol >= 0 && p < 1) {
    // remaining discs in source (to.digits[srcCol]) + existing discs in dest (from)
    for (let c = 0; c < n; c++) {
      if (c === srcCol) continue;
      const count = c === destCol ? from.digits[c]! : to.digits[c]!;
      for (let i = 0; i < count; i++) {
        const d = discCenter(c, i);
        prims.push({
          k: 'circle',
          cx: d.x,
          cy: d.y,
          r: discR,
          fill: TOK.accent,
          color: TOK.ink,
          weight: 'sm',
          z: 3,
        });
      }
    }
    for (let i = 0; i < to.digits[srcCol]!; i++) {
      const d = discCenter(srcCol, i);
      prims.push({
        k: 'circle',
        cx: d.x,
        cy: d.y,
        r: discR,
        fill: TOK.accent,
        color: TOK.ink,
        weight: 'sm',
        z: 3,
      });
    }
    // new disc in dest fades in
    const destIdx = from.digits[destCol]!;
    const nd = discCenter(destCol, destIdx);
    const inOp = clamp01((p - 0.5) / 0.5);
    if (inOp > 0)
      prims.push({
        k: 'circle',
        cx: nd.x,
        cy: nd.y,
        r: discR * (0.6 + 0.4 * inOp),
        fill: TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        opacity: inOp,
        z: 3,
      });
    // the 10 discs converge to the new disc, fading out near the end
    const move = clamp01(p / 0.85);
    const out = p < 0.82 ? 1 : 1 - clamp01((p - 0.82) / 0.18);
    for (let k = 0; k < 10; k++) {
      const src = discCenter(srcCol, to.digits[srcCol]! + k);
      prims.push({
        k: 'circle',
        cx: lerp(src.x, nd.x, move),
        cy: lerp(src.y, nd.y, move),
        r: discR,
        fill: TOK.accent,
        color: TOK.ink,
        weight: 'sm',
        opacity: out,
        z: 3,
      });
    }
  } else {
    // settled / addCounter
    const addBase = seg.verb === 'addCounter' ? from.digits : to.digits;
    for (let c = 0; c < n; c++) {
      for (let i = 0; i < to.digits[c]!; i++) {
        const d = discCenter(c, i);
        let op = 1,
          rr = discR;
        if (seg.verb === 'addCounter' && i >= addBase[c]!) {
          op = seg.p;
          rr = discR * (0.4 + 0.6 * seg.p);
        }
        prims.push({
          k: 'circle',
          cx: d.x,
          cy: d.y,
          r: rr,
          fill: TOK.accent,
          color: TOK.ink,
          weight: 'sm',
          opacity: op,
          z: 3,
        });
      }
    }
  }

  // value / expanded readout
  const val = pvValue(isExchange ? to : to);
  const text = to.expanded
    ? to.digits
        .map((d, i) => d * Math.pow(10, n - 1 - i))
        .filter((x) => x > 0)
        .join(' + ') + ` = ${val}`
    : String(val);
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.96,
    text: text || '0',
    color: TOK.ink,
    size: box.h * 0.09,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  });

  return { prims, view: box };
}

export const PlaceValueChart: Manipulative<PlaceValueP> = {
  kind: 'placevalue',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
