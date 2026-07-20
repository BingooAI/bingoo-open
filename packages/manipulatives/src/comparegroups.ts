/**
 * comparegroups.ts — CompareGroups (so sánh nhiều hơn / ít hơn / bằng nhau).
 * Two groups of counters (left = accent, right = accent2) with ONE-TO-ONE
 * pairing lines: pair them up, the leftovers get a warn ring — that group has
 * MORE. The comparison symbol (> < =) is always DERIVED from the counts by
 * `showSymbol`, never authored. Learner answers with `chooseSymbol` (gradable).
 * Ages 4–6. verbs: addLeft(n) · addRight(n) · pairUp · showSymbol ·
 * chooseSymbol(s) · clear.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { clamp01, lerp, TOK } from './util';
import { drawIcon } from './icons';

export type CompareSymbol = '>' | '<' | '=';
export type CompareP = {
  left: number; // 0..10
  right: number; // 0..10
  leftLabel: string; // authorable (English default)
  rightLabel: string;
  paired: number; // how many 1-1 pairing lines are drawn
  symbol: CompareSymbol | null; // the TRUE symbol, set by showSymbol
  choice: CompareSymbol | null; // learner's answer (gradable)
  /** the counter object in each group — draws real stars/apples/… to match
   *  the narration instead of a plain circle (default keeps the classic look;
   *  the two groups stay colour-distinct via drawIcon's `color`). */
  icon: string;
  /** media library: an image URL for the icon (overrides the built-in art). */
  assets?: Partial<Record<string, string>>;
  assetMode?: boolean;
};

const MAX = 10;
const DEFAULT: CompareP = {
  left: 3,
  right: 5,
  leftLabel: 'A',
  rightLabel: 'B',
  paired: 0,
  symbol: null,
  choice: null,
  icon: 'circle',
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clampCount(v: number): number {
  return Math.max(0, Math.min(MAX, Math.floor(v)));
}
function symOf(v: unknown): CompareSymbol | null {
  return v === '>' || v === '<' || v === '=' ? v : null;
}

/** THE comparison — always derived from the counts. */
export function trueSymbol(p: { left: number; right: number }): CompareSymbol {
  return p.left > p.right ? '>' : p.left < p.right ? '<' : '=';
}

function normalize(raw: unknown): CompareP {
  const r = (raw ?? {}) as Partial<CompareP>;
  const left = clampCount(r.left == null ? DEFAULT.left : num(r.left));
  const right = clampCount(r.right == null ? DEFAULT.right : num(r.right));
  return {
    left,
    right,
    leftLabel: (typeof r.leftLabel === 'string' && r.leftLabel.trim()
      ? r.leftLabel.trim()
      : 'A'
    ).slice(0, 12),
    rightLabel: (typeof r.rightLabel === 'string' && r.rightLabel.trim()
      ? r.rightLabel.trim()
      : 'B'
    ).slice(0, 12),
    paired: Math.max(0, Math.min(Math.min(left, right), Math.floor(num(r.paired)))),
    symbol: symOf(r.symbol),
    choice: symOf(r.choice),
    icon: (typeof r.icon === 'string' && r.icon) || 'circle',
    assets: r.assets,
    assetMode: !!r.assetMode,
  };
}

const verbs: Manipulative<CompareP>['verbs'] = {
  addLeft(p, args): VerbClip<CompareP> {
    const n = Math.floor(num(args?.n ?? args)) || 1;
    const left = clampCount(p.left + n);
    return tween(
      p,
      { ...p, left, paired: Math.min(p.paired, Math.min(left, p.right)) },
      0.4,
      'easeOutBack',
    );
  },
  addRight(p, args): VerbClip<CompareP> {
    const n = Math.floor(num(args?.n ?? args)) || 1;
    const right = clampCount(p.right + n);
    return tween(
      p,
      { ...p, right, paired: Math.min(p.paired, Math.min(p.left, right)) },
      0.4,
      'easeOutBack',
    );
  },
  /** one-to-one correspondence: lines draw on sequentially up to min(l, r). */
  pairUp(p): VerbClip<CompareP> {
    const paired = Math.min(p.left, p.right);
    return tween(
      p,
      { ...p, paired },
      Math.min(0.9, 0.35 + 0.08 * Math.max(1, paired - p.paired)),
      'easeOutCubic',
    );
  },
  /** show the TRUE symbol — derived from left vs right, never authored. */
  showSymbol(p): VerbClip<CompareP> {
    return tween(p, { ...p, symbol: trueSymbol(p) }, 0.5, 'easeOutBack');
  },
  /** learner picks > < or = (gradable via check). */
  chooseSymbol(p, args): VerbClip<CompareP> {
    const s = symOf(args?.s ?? args);
    return tween(p, { ...p, choice: s ?? p.choice }, 0.3, 'easeOutBack');
  },
  clear(p): VerbClip<CompareP> {
    return tween(
      p,
      { ...p, left: 0, right: 0, paired: 0, symbol: null, choice: null },
      0.4,
      'easeInCubic',
    );
  },
};

/* ----------------------------------------------------------------- render */

function render(_p: CompareP, state: ManipState<CompareP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const F = seg.from;
  const prims: Prim[] = [];
  const portrait = box.h > box.w;
  const clearing = seg.verb === 'clear';

  // slot count is stable across the active verb → no mid-verb layout jumps
  const slots = Math.max(P.left, P.right, F.left, F.right, 1);

  // geometry: landscape = two vertical columns, portrait = two horizontal rows
  const slot = portrait
    ? Math.min((box.w * 0.72) / slots, box.w * 0.13)
    : Math.min((box.h * 0.64) / slots, box.h * 0.13);
  const span = slots * slot;
  const r = portrait ? Math.min(slot * 0.36, box.h * 0.045) : Math.min(slot * 0.36, box.w * 0.045);

  const pt = (side: 0 | 1, i: number) => {
    if (portrait) {
      const x0 = box.w / 2 - span / 2;
      return { x: x0 + (i + 0.5) * slot, y: side ? box.h * 0.7 : box.h * 0.3 };
    }
    const y0 = box.h / 2 - span / 2 + box.h * 0.02;
    return { x: side ? box.w * 0.73 : box.w * 0.27, y: y0 + (i + 0.5) * slot };
  };

  // pairing lines (draw on sequentially during pairUp)
  const lineFade = clearing ? 1 - seg.p : 1;
  for (let i = 0; i < Math.max(P.paired, clearing ? F.paired : 0); i++) {
    let q = 1;
    if (seg.verb === 'pairUp' && i >= F.paired)
      q = clamp01(seg.p * Math.max(1, P.paired - F.paired) - (i - F.paired));
    if (q <= 0.01 || lineFade <= 0.01) continue;
    const a = pt(0, i),
      b = pt(1, i);
    // shrink endpoints so lines meet the counters' edges, then draw partially
    const ax = portrait ? a.x : a.x + r * 1.3,
      ay = portrait ? a.y + r * 1.3 : a.y;
    const bx = portrait ? b.x : b.x - r * 1.3,
      by = portrait ? b.y - r * 1.3 : b.y;
    prims.push({
      k: 'line',
      x1: ax,
      y1: ay,
      x2: lerp(ax, bx, q),
      y2: lerp(ay, by, q),
      color: TOK.ink,
      weight: 'sm',
      cap: 'round',
      opacity: 0.75 * lineFade,
      z: 2,
    });
  }

  // counters (left accent / right accent2) + warn ring on unpaired leftovers
  const ringOp = (P.paired > 0 ? (seg.verb === 'pairUp' ? clamp01(seg.p) : 1) : 0) * lineFade;
  const drawSide = (side: 0 | 1) => {
    const cur = side ? P.right : P.left;
    const was = side ? F.right : F.left;
    const shown = Math.max(cur, clearing ? was : 0);
    const addVerb = side ? 'addRight' : 'addLeft';
    for (let i = 0; i < shown; i++) {
      const c = pt(side, i);
      let op = 1,
        rr = r;
      if (i >= cur)
        op = 1 - seg.p; // clearing fade-out
      else if (seg.verb === addVerb && i >= was) {
        op = clamp01(seg.p);
        rr = r * (0.3 + 0.7 * clamp01(seg.p));
      }
      if (op <= 0.01) continue;
      if (i >= P.paired && ringOp > 0.01 && i < cur) {
        prims.push({
          k: 'circle',
          cx: c.x,
          cy: c.y,
          r: r * 1.35,
          fill: 'none',
          color: TOK.warn,
          weight: 'md',
          opacity: ringOp * op,
          z: 4,
        });
      }
      drawIcon(prims, P.icon, c.x, c.y, rr, op, {
        color: side ? TOK.accent2 : TOK.accent,
        src: P.assets?.[P.icon],
        assetMode: P.assetMode,
      });
    }
  };
  drawSide(0);
  drawSide(1);

  // group labels + counts (labels are authorable params; counts are numerals)
  const lblSize = Math.min(box.w, box.h) * 0.065;
  const cntSize = Math.min(box.w, box.h) * 0.085;
  if (portrait) {
    const x0 = box.w / 2 - span / 2;
    prims.push({
      k: 'label',
      x: Math.max(box.w * 0.03, x0 - box.w * 0.04),
      y: box.h * 0.3,
      text: P.leftLabel,
      color: TOK.ink,
      size: lblSize,
      align: 'end',
      baseline: 'middle',
      z: 5,
    });
    prims.push({
      k: 'label',
      x: Math.max(box.w * 0.03, x0 - box.w * 0.04),
      y: box.h * 0.7,
      text: P.rightLabel,
      color: TOK.ink,
      size: lblSize,
      align: 'end',
      baseline: 'middle',
      z: 5,
    });
    prims.push({
      k: 'label',
      x: Math.min(box.w * 0.97, x0 + span + box.w * 0.04),
      y: box.h * 0.3,
      text: String(P.left),
      color: TOK.accent,
      size: cntSize,
      align: 'start',
      baseline: 'middle',
      z: 5,
    });
    prims.push({
      k: 'label',
      x: Math.min(box.w * 0.97, x0 + span + box.w * 0.04),
      y: box.h * 0.7,
      text: String(P.right),
      color: TOK.accent2,
      size: cntSize,
      align: 'start',
      baseline: 'middle',
      z: 5,
    });
  } else {
    const y0 = box.h / 2 - span / 2 + box.h * 0.02;
    prims.push({
      k: 'label',
      x: box.w * 0.27,
      y: Math.max(box.h * 0.06, y0 - box.h * 0.06),
      text: P.leftLabel,
      color: TOK.ink,
      size: lblSize,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    });
    prims.push({
      k: 'label',
      x: box.w * 0.73,
      y: Math.max(box.h * 0.06, y0 - box.h * 0.06),
      text: P.rightLabel,
      color: TOK.ink,
      size: lblSize,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    });
    prims.push({
      k: 'label',
      x: box.w * 0.27,
      y: Math.min(box.h * 0.95, y0 + span + box.h * 0.06),
      text: String(P.left),
      color: TOK.accent,
      size: cntSize,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    });
    prims.push({
      k: 'label',
      x: box.w * 0.73,
      y: Math.min(box.h * 0.95, y0 + span + box.h * 0.06),
      text: String(P.right),
      color: TOK.accent2,
      size: cntSize,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    });
  }

  // comparison symbol between the groups: true symbol (good) or learner's
  // choice (accent2); a faint placeholder circle otherwise
  const scx = box.w / 2,
    scy = box.h / 2;
  const symSize = Math.min(box.w, box.h) * 0.17;
  const sym = P.symbol ?? P.choice;
  if (sym) {
    const pop = seg.verb === 'showSymbol' || seg.verb === 'chooseSymbol' ? clamp01(seg.p) : 1;
    const op = pop * lineFade;
    if (op > 0.01) {
      prims.push({
        k: 'circle',
        cx: scx,
        cy: scy,
        r: symSize * 0.72,
        fill: TOK.paper,
        color: P.symbol ? TOK.good : TOK.accent2,
        weight: 'sm',
        opacity: 0.92 * op,
        z: 6,
      });
      prims.push({
        k: 'label',
        x: scx,
        y: scy,
        text: sym,
        color: P.symbol ? TOK.good : TOK.accent2,
        size: symSize * (0.4 + 0.6 * pop),
        align: 'middle',
        baseline: 'middle',
        opacity: op,
        z: 7,
      });
    }
  } else if (!clearing || seg.p < 0.5) {
    prims.push({
      k: 'circle',
      cx: scx,
      cy: scy,
      r: symSize * 0.55,
      fill: TOK.faint,
      opacity: 0.5,
      z: 1,
    });
  }

  return { prims, view: box };
}

export const CompareGroups: Manipulative<CompareP> = {
  kind: 'comparegroups',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
