/**
 * money.ts — coins & notes (Cambridge: money, making amounts, change). Values in
 * the smallest unit (e.g. cents). `total` is the sum → verifiable by code.
 * verbs: addCoin(value) · makeAmount(amount) · giveChange(paid,cost) · setTarget(amount).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { TOK } from './util';

/** Currency presentation (values stay in the smallest unit). `major`/`minor` are
 *  the symbols; `ratio` minor-units make one major (e.g. 100¢ = $1). For a
 *  single-unit currency (đ, ¥), set `ratio: 1` and `minor: ""`. */
export type MoneyCurrency = { major: string; minor: string; ratio: number; majorAfter?: boolean };
export type MoneyP = {
  coins: number[];
  target: number | null;
  currency: MoneyCurrency;
  totalLabel: string;
};

const DENOMS = [200, 100, 50, 20, 10, 5, 2, 1];
const DEFAULT_CURRENCY: MoneyCurrency = { major: '$', minor: '¢', ratio: 100 };
const DEFAULT: MoneyP = {
  coins: [],
  target: null,
  currency: DEFAULT_CURRENCY,
  totalLabel: 'Total',
};

export function moneyTotal(p: MoneyP): number {
  return p.coins.reduce((s, c) => s + c, 0);
}
function decompose(amount: number): number[] {
  let x = Math.max(0, Math.floor(amount));
  const out: number[] = [];
  for (const d of DENOMS)
    while (x >= d) {
      out.push(d);
      x -= d;
    }
  return out;
}
function normalize(raw: unknown): MoneyP {
  const r = (raw ?? {}) as Partial<MoneyP>;
  const c = (r.currency ?? {}) as Partial<MoneyCurrency>;
  const ratio = num(c.ratio ?? DEFAULT_CURRENCY.ratio) || 1;
  return {
    coins: [...(r.coins ?? [])],
    target: r.target ?? null,
    currency: {
      major: c.major ?? DEFAULT_CURRENCY.major,
      minor: c.minor ?? DEFAULT_CURRENCY.minor,
      ratio,
      majorAfter: !!c.majorAfter,
    },
    totalLabel: r.totalLabel ?? DEFAULT.totalLabel,
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<MoneyP>['verbs'] = {
  addCoin(p, args): VerbClip<MoneyP> {
    return tween(
      p,
      { ...p, coins: [...p.coins, Math.floor(num(args?.value ?? args ?? 1))] },
      0.4,
      'easeOutBack',
    );
  },
  makeAmount(p, args): VerbClip<MoneyP> {
    const amount = Math.floor(num(args?.amount ?? args ?? 0));
    return tween(p, { ...p, coins: decompose(amount), target: amount }, 0.7, 'easeOutCubic');
  },
  giveChange(p, args): VerbClip<MoneyP> {
    const change = Math.max(0, Math.floor(num(args?.paid ?? 0)) - Math.floor(num(args?.cost ?? 0)));
    return tween(p, { ...p, coins: decompose(change), target: change }, 0.7, 'easeOutCubic');
  },
  setTarget(p, args): VerbClip<MoneyP> {
    return tween(
      p,
      { ...p, target: Math.floor(num(args?.amount ?? args ?? 0)) },
      0.3,
      'easeOutCubic',
    );
  },
};

function fmtMoney(units: number, cur: MoneyCurrency): string {
  // whole major units → "$3" / "3đ"; otherwise minor units → "45¢" (or major if no minor symbol)
  if (cur.ratio > 1 && units % cur.ratio === 0 && units >= cur.ratio) {
    const v = units / cur.ratio;
    return cur.majorAfter ? `${v}${cur.major}` : `${cur.major}${v}`;
  }
  if (!cur.minor) return cur.majorAfter ? `${units}${cur.major}` : `${cur.major}${units}`;
  return `${units}${cur.minor}`;
}

function render(_params: MoneyP, state: ManipState<MoneyP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const staggered = seg.verb === 'makeAmount' || seg.verb === 'giveChange';
  const shown = staggered
    ? Math.max(seg.from.coins.length, Math.ceil(seg.p * P.coins.length))
    : P.coins.length;
  const addNew = seg.verb === 'addCoin';

  const perRow = 5;
  const cellW = (box.w * 0.9) / perRow;
  const cellH = Math.min(cellW, box.h * 0.2);
  const ox = box.w * 0.05,
    oy = box.h * 0.14;

  P.coins.forEach((val, i) => {
    if (i >= shown) return;
    const row = Math.floor(i / perRow),
      c = i % perRow;
    const cx = ox + c * cellW + cellW / 2;
    const cy = oy + row * cellH + cellH / 2;
    const grow = addNew && i === P.coins.length - 1 ? seg.p : 1;
    if (val >= 100) {
      const w = cellW * 0.86 * grow,
        h = cellH * 0.5 * grow;
      prims.push({
        k: 'rect',
        x: cx - w / 2,
        y: cy - h / 2,
        w,
        h,
        fill: TOK.good,
        color: TOK.ink,
        weight: 'sm',
        rx: 6,
        opacity: grow,
        z: 2,
      });
    } else {
      prims.push({
        k: 'circle',
        cx,
        cy,
        r: cellH * 0.34 * grow,
        fill: val >= 10 ? TOK.warn : TOK.faint,
        color: TOK.ink,
        weight: 'sm',
        opacity: grow,
        z: 2,
      });
    }
    prims.push({
      k: 'label',
      x: cx,
      y: cy,
      text: fmtMoney(val, P.currency),
      color: TOK.ink,
      size: cellH * 0.24,
      align: 'middle',
      baseline: 'middle',
      opacity: grow,
      z: 3,
    });
  });

  const total = P.coins.slice(0, shown).reduce((s, c) => s + c, 0);
  const hit = P.target !== null && total === P.target;
  const label =
    P.target !== null
      ? `${fmtMoney(total, P.currency)} / ${fmtMoney(P.target, P.currency)}${hit ? '  ✓' : ''}`
      : `${P.totalLabel}: ${fmtMoney(total, P.currency)}`;
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.94,
    text: label,
    color: hit ? TOK.good : TOK.ink,
    size: box.h * 0.1,
    align: 'middle',
    baseline: 'middle',
    z: 5,
  });

  return { prims, view: box };
}

export const Money: Manipulative<MoneyP> = {
  kind: 'money',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
