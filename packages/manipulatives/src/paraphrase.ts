/**
 * paraphrase.ts — ParaphrasePair (nhận diện đồng nghĩa giữa câu hỏi và bài đọc —
 * kỹ năng IELTS reading/listening, exam prep). Two sentences as rows of word
 * chips; revealing an alignment underlines the matching chunks in the same
 * colour and draws a soft connecting band between them. The learner can also
 * pick a word in A and a word in B — whether they truly align is verified in
 * code against `links` (never hardcoded). verbs: showNext() · showAll() ·
 * focus(k) · pick(ai, bi) · clear() · setPair(a, b, links).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { clamp01, TOK } from './util';

export type ParaLink = [number[], number[]]; // token-index groups: a-chunk ↔ b-chunk
export type ParaP = {
  a: string;
  b: string;
  links: ParaLink[];
  shown: number; // links revealed so far
  focus: number | null;
  pick: { ai: number; bi: number } | null;
  selA: number | null; // tapped word in A awaiting its partner in B (sandbox flow)
};

const DEFAULT: ParaP = {
  a: 'The government increased funding for public schools.',
  b: 'State financing of education rose.',
  links: [
    [[1], [0]],
    [[2, 3], [1]],
    [
      [4, 5, 6],
      [2, 3],
    ],
  ],
  shown: 0,
  focus: null,
  pick: null,
  selA: null,
};

const CYCLE = [TOK.accent, TOK.accent2, TOK.good, TOK.warn];

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clampI(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}
function argNum(args: unknown, key: string): number | null {
  const v: unknown =
    args != null && typeof args === 'object' ? (args as Record<string, unknown>)[key] : args;
  if (v == null || typeof v === 'object' || typeof v === 'boolean') return null;
  const n = Math.floor(num(v));
  return Number.isFinite(n) ? n : null;
}

function tokens(s: string): string[] {
  return String(s)
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function normalize(raw: unknown): ParaP {
  const r = (raw ?? {}) as Partial<ParaP>;
  const a = typeof r.a === 'string' && r.a.trim().length ? r.a : DEFAULT.a;
  const b = typeof r.b === 'string' && r.b.trim().length ? r.b : DEFAULT.b;
  const na = tokens(a).length,
    nb = tokens(b).length;
  const group = (g: unknown, n: number) => {
    const arr = Array.isArray(g) ? g : [];
    const out: number[] = [];
    for (const v of arr) {
      const i = Math.floor(num(v));
      if (i >= 0 && i < n && !out.includes(i)) out.push(i);
    }
    return out;
  };
  const linksRaw = Array.isArray(r.links) ? r.links : DEFAULT.links;
  const links: ParaLink[] = [];
  for (const l of linksRaw) {
    if (!Array.isArray(l)) continue;
    const ga = group(l[0], na),
      gb = group(l[1], nb);
    if (ga.length && gb.length) links.push([ga, gb]);
  }
  const shown = clampI(num(r.shown), 0, links.length);
  const focus = r.focus == null || !links.length ? null : clampI(num(r.focus), 0, links.length - 1);
  let pick: ParaP['pick'] = null;
  if (r.pick && typeof r.pick === 'object' && na > 0 && nb > 0) {
    const raw = r.pick as Record<string, unknown>;
    pick = { ai: clampI(num(raw.ai), 0, na - 1), bi: clampI(num(raw.bi), 0, nb - 1) };
  }
  const selA = r.selA == null || na === 0 ? null : clampI(num(r.selA), 0, na - 1);
  return { a, b, links, shown, focus, pick, selA };
}

/** true iff (ai, bi) sit in the SAME link group — the code-verified alignment. */
function isLinked(links: ParaLink[], ai: number, bi: number): boolean {
  return links.some((l) => l[0].includes(ai) && l[1].includes(bi));
}

const verbs: Manipulative<ParaP>['verbs'] = {
  showNext(p): VerbClip<ParaP> {
    return tween(p, { ...p, shown: Math.min(p.links.length, p.shown + 1) }, 0.6, 'easeOutCubic');
  },
  showAll(p): VerbClip<ParaP> {
    return tween(p, { ...p, shown: p.links.length }, 0.9, 'easeOutCubic');
  },
  focus(p, args): VerbClip<ParaP> {
    if (!p.links.length) return tween(p, { ...p }, 0.3, 'easeOutCubic');
    const k = clampI(argNum(args, 'k') ?? 0, 0, p.links.length - 1);
    return tween(p, { ...p, focus: k, shown: Math.max(p.shown, k + 1) }, 0.4, 'easeOutCubic');
  },
  pick(p, args): VerbClip<ParaP> {
    const na = tokens(p.a).length,
      nb = tokens(p.b).length;
    if (!na || !nb) return tween(p, { ...p }, 0.3, 'easeOutCubic');
    const ai = clampI(argNum(args, 'ai') ?? p.selA ?? 0, 0, na - 1);
    const bi = clampI(argNum(args, 'bi') ?? 0, 0, nb - 1);
    return tween(p, { ...p, pick: { ai, bi }, selA: null }, 0.5, 'easeOutBack');
  },
  clear(p): VerbClip<ParaP> {
    return tween(p, { ...p, shown: 0, focus: null, pick: null, selA: null }, 0.4, 'easeInCubic');
  },
  setPair(p, args): VerbClip<ParaP> {
    const a = (args != null && typeof args === 'object' ? args : {}) as Partial<ParaP>;
    const next = normalize({ a: a.a ?? p.a, b: a.b ?? p.b, links: a.links ?? p.links, shown: 0 });
    return tween(p, next, 0.5, 'easeOutCubic');
  },
};

/* ---------------------------------------------------------------- layout */

function rrPath(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

type ParaChip = { x: number; y: number; w: number; h: number; word: string };

function wrapRow(
  words: string[],
  fs: number,
  box: { w: number; h: number },
  y0: number,
): { chips: ParaChip[]; bottom: number } {
  const ch = fs * 0.6,
    x0 = box.w * 0.05,
    maxW = box.w * 0.9,
    rowH = fs * 2.1,
    chipH = fs * 1.5;
  const chips: ParaChip[] = [];
  let x = x0,
    y = y0 + chipH / 2;
  for (const w of words) {
    const cw = w.length * ch + fs * 0.7;
    if (x + cw > x0 + maxW && x > x0) {
      x = x0;
      y += rowH;
    }
    chips.push({ x, y, w: cw, h: chipH, word: w });
    x += cw + fs * 0.3;
  }
  return { chips, bottom: y + chipH / 2 };
}

// keep in sync with the "paraphrase" entry in interactions.ts (onTap geometry)
function layoutPara(
  P: ParaP,
  box: { w: number; h: number },
): { fs: number; a: ParaChip[]; b: ParaChip[] } {
  const ta = tokens(P.a),
    tb = tokens(P.b);
  let fs = Math.min(box.h * 0.055, box.w * 0.05);
  for (let it = 0; ; it++) {
    const A = wrapRow(ta, fs, box, box.h * 0.1);
    const B = wrapRow(tb, fs, box, box.h * 0.56);
    if ((A.bottom <= box.h * 0.44 && B.bottom <= box.h * 0.9) || fs < 7 || it >= 9)
      return { fs, a: A.chips, b: B.chips };
    fs *= 0.88;
  }
}

/* ---------------------------------------------------------------- render */

function render(_params: ParaP, state: ManipState<ParaP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const L = layoutPara(P, box);
  const fs = L.fs;
  const fl = P.focus != null ? P.links[P.focus] : null;

  const pkOf = (k: number): number => {
    if (k >= P.shown) return 0;
    if (seg.verb === 'showNext' && k >= seg.from.shown) return clamp01(seg.p);
    if (seg.verb === 'showAll' && k >= seg.from.shown) {
      const m = Math.max(1, P.shown - seg.from.shown);
      return clamp01(seg.p * m - (k - seg.from.shown));
    }
    return 1;
  };
  const dimLink = (k: number) => (P.focus == null || P.focus === k ? 1 : 0.15);
  const dimTok = (side: 0 | 1, i: number) => (fl == null ? 1 : fl[side].includes(i) ? 1 : 0.35);

  // word chips — sentence A on top, sentence B below (both word-wrapped)
  const drawRow = (chips: ParaChip[], side: 0 | 1) => {
    chips.forEach((c, i) => {
      const dim = dimTok(side, i);
      prims.push({
        k: 'rect',
        x: c.x,
        y: c.y - c.h / 2,
        w: c.w,
        h: c.h,
        fill: TOK.paper,
        color: TOK.faint,
        weight: 'sm',
        rx: fs * 0.3,
        opacity: dim,
        z: 3,
      });
      prims.push({
        k: 'label',
        x: c.x + c.w / 2,
        y: c.y,
        text: c.word,
        color: TOK.ink,
        size: fs * 0.9,
        align: 'middle',
        baseline: 'middle',
        opacity: dim,
        z: 4,
      });
    });
  };
  drawRow(L.a, 0);
  drawRow(L.b, 1);

  // revealed alignments — matching-colour underlines + a soft connecting band
  P.links.forEach((l, k) => {
    const pk = pkOf(k);
    if (pk <= 0) return;
    const dim = dimLink(k);
    const col = CYCLE[k % CYCLE.length];
    const under = (chips: ParaChip[], idxs: number[]) => {
      for (const i of idxs) {
        const c = chips[i];
        if (!c) continue;
        const uy = c.y + c.h / 2 + fs * 0.18;
        prims.push({
          k: 'line',
          x1: c.x,
          y1: uy,
          x2: c.x + c.w * Math.min(1, pk),
          y2: uy,
          color: col,
          weight: 'lg',
          cap: 'round',
          opacity: 0.95 * pk * dim,
          z: 5,
        });
      }
    };
    under(L.a, l[0]);
    under(L.b, l[1]);
    const bb = (chips: ParaChip[], idxs: number[], edge: 'bottom' | 'top') => {
      let x1 = Infinity,
        x2 = -Infinity,
        y = edge === 'bottom' ? -Infinity : Infinity;
      for (const i of idxs) {
        const c = chips[i];
        if (!c) continue;
        x1 = Math.min(x1, c.x);
        x2 = Math.max(x2, c.x + c.w);
        y =
          edge === 'bottom'
            ? Math.max(y, c.y + c.h / 2 + fs * 0.3)
            : Math.min(y, c.y - c.h / 2 - fs * 0.08);
      }
      return Number.isFinite(x1) && Number.isFinite(y) ? { x1, x2, y } : null;
    };
    const A = bb(L.a, l[0], 'bottom'),
      B = bb(L.b, l[1], 'top');
    if (A && B && B.y > A.y) {
      const dy = (B.y - A.y) * 0.45;
      const d = `M ${A.x1} ${A.y} L ${A.x2} ${A.y} C ${A.x2} ${A.y + dy} ${B.x2} ${B.y - dy} ${B.x2} ${B.y} L ${B.x1} ${B.y} C ${B.x1} ${B.y - dy} ${A.x1} ${A.y + dy} ${A.x1} ${A.y} Z`;
      prims.push({ k: 'path', d, fill: col, opacity: 0.13 * pk * dim, closed: true, z: 2 });
    }
  });

  // learner pick — ring both words; colour is the code-verified verdict
  const ring = (c: ParaChip | undefined, col: string, op: number) => {
    if (!c) return;
    prims.push({
      k: 'path',
      d: rrPath(
        c.x - fs * 0.12,
        c.y - c.h / 2 - fs * 0.12,
        c.w + fs * 0.24,
        c.h + fs * 0.24,
        fs * 0.4,
      ),
      color: col,
      weight: 'md',
      opacity: op,
      z: 6,
    });
  };
  if (P.selA != null) ring(L.a[P.selA], TOK.accent, 0.9);
  if (P.pick) {
    const ok = isLinked(P.links, P.pick.ai, P.pick.bi);
    const col = ok ? TOK.good : TOK.warn;
    const gp = seg.verb === 'pick' ? clamp01(seg.p) : 1;
    ring(L.a[P.pick.ai], col, gp);
    ring(L.b[P.pick.bi], col, gp);
    const ca = L.a[P.pick.ai],
      cb = L.b[P.pick.bi];
    if (ca && cb) {
      prims.push({
        k: 'line',
        x1: ca.x + ca.w / 2,
        y1: ca.y + ca.h / 2 + fs * 0.2,
        x2: cb.x + cb.w / 2,
        y2: cb.y - cb.h / 2 - fs * 0.2,
        color: col,
        weight: 'sm',
        dash: fs * 0.35,
        opacity: 0.7 * gp,
        z: 6,
      });
      if (seg.verb === 'pick') {
        const flash = Math.sin(Math.PI * clamp01(seg.p));
        prims.push({
          k: 'rect',
          x: ca.x,
          y: ca.y - ca.h / 2,
          w: ca.w,
          h: ca.h,
          fill: col,
          opacity: 0.25 * flash,
          rx: fs * 0.3,
          z: 6,
        });
        prims.push({
          k: 'rect',
          x: cb.x,
          y: cb.y - cb.h / 2,
          w: cb.w,
          h: cb.h,
          fill: col,
          opacity: 0.25 * flash,
          rx: fs * 0.3,
          z: 6,
        });
      }
    }
  }

  // legend counter — revealed matches / total
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.96,
    text: `${Math.min(P.shown, P.links.length)} / ${P.links.length}`,
    color: TOK.soft,
    size: Math.min(box.h * 0.04, box.w * 0.045),
    align: 'middle',
    baseline: 'middle',
    z: 4,
  });

  return { prims, view: box };
}

export const ParaphrasePair: Manipulative<ParaP> = {
  kind: 'paraphrase',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
