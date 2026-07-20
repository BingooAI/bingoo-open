/**
 * probtree.ts — ProbabilityTree (cây xác suất hai tầng). A two-stage probability
 * tree: root → stage-1 branches → stage-2 sub-branches, with the branch
 * probability written on every segment and the product probability at each leaf
 * (P(leaf) = p1 × p2, computed — never hardcoded). Teaches the multiplication
 * rule for independent events + "all leaves sum to 1" (high school, 14–18).
 * Landscape grows left→right; portrait grows top→down.
 * verbs: reveal(stage) · highlight(path:[i,j]) · showProducts() ·
 *        setStages(stage1,stage2) · answer(p)   [gradable]
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, TOK } from './util';

export type ProbBranch = { label: string; p: number };
export type ProbTreeP = {
  stage1: ProbBranch[];
  stage2: ProbBranch[]; // same outcome set hangs off every stage-1 branch
  revealed: 0 | 1 | 2; // how many stages are visible
  highlightPath: [number, number] | null;
  showProducts: boolean;
  /** learner's answer for the gate (probability value); null = not answered. */
  answer: number | null;
};

const DEFAULT: ProbTreeP = {
  stage1: [
    { label: 'H', p: 0.5 },
    { label: 'T', p: 0.5 },
  ],
  stage2: [
    { label: 'H', p: 0.5 },
    { label: 'T', p: 0.5 },
  ],
  revealed: 2,
  highlightPath: null,
  showProducts: false,
  answer: null,
};

function num(v: unknown, dflt = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}
/** probability formatter: up to 3 decimals, trailing zeros trimmed. */
function fmtP(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** Coerce a raw branch list and RENORMALIZE probabilities to sum exactly 1
 *  (degenerate weights → uniform). Max 4 branches per stage (layout sanity). */
function normBranches(raw: unknown, dflt: ProbBranch[]): ProbBranch[] {
  const arr = Array.isArray(raw) && raw.length ? raw : dflt;
  let out = arr.slice(0, 4).map((b: { label?: unknown; p?: unknown } | null, i: number) => ({
    label: typeof b?.label === 'string' && b.label !== '' ? b.label : String(i + 1),
    p: Math.max(0, num(b?.p, 1)),
  }));
  if (!out.length) out = dflt.map((b) => ({ ...b }));
  const total = out.reduce((s, b) => s + b.p, 0);
  if (total <= 0) return out.map((b) => ({ ...b, p: 1 / out.length }));
  return out.map((b) => ({ ...b, p: b.p / total }));
}

function normalize(raw: unknown): ProbTreeP {
  const r = (raw ?? {}) as Partial<ProbTreeP>;
  const stage1 = normBranches(r.stage1, DEFAULT.stage1);
  const stage2 = normBranches(r.stage2, DEFAULT.stage2);
  const revealed = Math.max(0, Math.min(2, Math.floor(num(r.revealed, 2)))) as 0 | 1 | 2;
  let hp: [number, number] | null = null;
  if (Array.isArray(r.highlightPath) && r.highlightPath.length >= 2) {
    hp = [
      Math.max(0, Math.min(stage1.length - 1, Math.floor(num(r.highlightPath[0])))),
      Math.max(0, Math.min(stage2.length - 1, Math.floor(num(r.highlightPath[1])))),
    ];
  }
  return {
    stage1,
    stage2,
    revealed,
    highlightPath: hp,
    showProducts: !!r.showProducts,
    answer: r.answer == null ? null : num(r.answer),
  };
}

const verbs: Manipulative<ProbTreeP>['verbs'] = {
  reveal(p, args): VerbClip<ProbTreeP> {
    const raw = args?.stage ?? (typeof args === 'number' ? args : undefined);
    const stage = (
      raw === undefined
        ? Math.min(2, p.revealed + 1)
        : Math.max(0, Math.min(2, Math.floor(num(raw, p.revealed))))
    ) as 0 | 1 | 2;
    return tween(p, { ...p, revealed: stage }, 0.7, 'easeOutCubic');
  },
  highlight(p, args): VerbClip<ProbTreeP> {
    const raw = Array.isArray(args?.path) ? args.path : Array.isArray(args) ? args : null;
    const path: [number, number] | null =
      raw && raw.length >= 2
        ? [
            Math.max(0, Math.min(p.stage1.length - 1, Math.floor(num(raw[0])))),
            Math.max(0, Math.min(p.stage2.length - 1, Math.floor(num(raw[1])))),
          ]
        : null;
    return tween(p, { ...p, highlightPath: path }, 0.5, 'easeOutCubic');
  },
  showProducts(p): VerbClip<ProbTreeP> {
    return tween(p, { ...p, showProducts: true }, 0.45, 'easeOutBack');
  },
  setStages(p, args): VerbClip<ProbTreeP> {
    const stage1 = args?.stage1 !== undefined ? normBranches(args.stage1, p.stage1) : p.stage1;
    const stage2 = args?.stage2 !== undefined ? normBranches(args.stage2, p.stage2) : p.stage2;
    return tween(p, { ...p, stage1, stage2, highlightPath: null }, 0.6, 'easeOutCubic');
  },
  answer(p, args): VerbClip<ProbTreeP> {
    return tween(p, { ...p, answer: num(args?.p ?? args) }, 0.3, 'easeOutCubic');
  },
};

/** stage visibility progress: 1 shown, 0 hidden, seg.p while (un)revealing. */
function stageProg(fromRev: number, toRev: number, stage: number, p: number): number {
  const was = fromRev >= stage,
    is = toRev >= stage;
  if (was && is) return 1;
  if (!was && is) return p;
  if (was && !is) return 1 - p;
  return 0;
}

function render(
  _params: ProbTreeP,
  state: ManipState<ProbTreeP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const portrait = box.h > box.w;
  const n1 = P.stage1.length,
    n2 = P.stage2.length,
    N = n1 * n2;
  const fs = Math.min(box.w, box.h) * (portrait ? 0.042 : 0.05);
  const dotR = Math.min(box.w, box.h) * 0.012;

  const prog1 = stageProg(seg.from.revealed, seg.to.revealed, 1, seg.p);
  const prog2 = stageProg(seg.from.revealed, seg.to.revealed, 2, seg.p);
  const prodOp = P.showProducts
    ? seg.verb === 'showProducts' && !seg.from.showProducts
      ? seg.p
      : 1
    : 0;

  // ---- tree geometry (portrait: root top, grow down; else root left, grow right)
  // keep in sync with probtree onTap in interactions.ts (leaf slot mapping).
  const pad = (portrait ? box.w : box.h) * 0.06;
  const span = (portrait ? box.w : box.h) - 2 * pad;
  const slot = span / N;
  const leafAt = (k: number) => pad + (k + 0.5) * slot; // position along the fan axis
  const root = portrait ? { x: box.w / 2, y: box.h * 0.06 } : { x: box.w * 0.07, y: box.h / 2 };
  const depth1 = portrait ? box.h * 0.4 : box.w * 0.4; // stage-1 node depth
  const depth2 = portrait ? box.h * 0.72 : box.w * 0.72; // leaf depth
  const pt = (along: number, depth: number) =>
    portrait ? { x: along, y: depth } : { x: depth, y: along };
  const node1 = (i: number) => pt((leafAt(i * n2) + leafAt(i * n2 + n2 - 1)) / 2, depth1);
  const leaf = (i: number, j: number) => pt(leafAt(i * n2 + j), depth2);

  // one branch: draw-on line (endpoint eased by prog) + probability label.
  const branch = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    prob: number,
    prog: number,
    z: number,
  ) => {
    if (prog <= 0.001) return;
    const ex = lerp(a.x, b.x, prog),
      ey = lerp(a.y, b.y, prog);
    prims.push({
      k: 'line',
      x1: a.x,
      y1: a.y,
      x2: ex,
      y2: ey,
      color: TOK.ink,
      weight: 'sm',
      cap: 'round',
      opacity: 0.9,
      z,
    });
    // probability label sits at the midpoint, nudged along the perpendicular
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy) || 1;
    const off = Math.min(box.w, box.h) * 0.035;
    prims.push({
      k: 'label',
      x: (a.x + b.x) / 2 - (dy / len) * off,
      y: (a.y + b.y) / 2 + (dx / len) * off,
      text: fmtP(prob),
      color: TOK.soft,
      size: fs * 0.9,
      align: 'middle',
      baseline: 'middle',
      opacity: prog * prog,
      z: z + 1,
    });
  };

  // ---- highlight overlay (thickening animates in/out via seg.p)
  const hiSet: { path: [number, number]; op: number }[] = [];
  if (seg.verb === 'highlight') {
    if (seg.to.highlightPath) hiSet.push({ path: seg.to.highlightPath, op: seg.p });
    if (seg.from.highlightPath) hiSet.push({ path: seg.from.highlightPath, op: 1 - seg.p });
  } else if (P.highlightPath) {
    hiSet.push({ path: P.highlightPath, op: 1 });
  }
  const hiW = Math.max(3, Math.min(box.w, box.h) * 0.012);
  for (const h of hiSet) {
    const [i, j] = h.path;
    if (i >= n1 || j >= n2 || h.op <= 0.001) continue;
    const a = node1(i),
      l = leaf(i, j);
    if (prog1 > 0.999)
      prims.push({
        k: 'line',
        x1: root.x,
        y1: root.y,
        x2: a.x,
        y2: a.y,
        color: TOK.accent,
        weight: hiW,
        cap: 'round',
        opacity: h.op,
        z: 6,
      });
    if (prog2 > 0.999)
      prims.push({
        k: 'line',
        x1: a.x,
        y1: a.y,
        x2: l.x,
        y2: l.y,
        color: TOK.accent,
        weight: hiW,
        cap: 'round',
        opacity: h.op,
        z: 6,
      });
  }

  // ---- root
  prims.push({ k: 'circle', cx: root.x, cy: root.y, r: dotR * 1.4, fill: TOK.ink, z: 4 });

  // ---- stage 1
  P.stage1.forEach((b1, i) => {
    const a = node1(i);
    branch(root, a, b1.p, prog1, 3);
    if (prog1 > 0.001) {
      prims.push({
        k: 'circle',
        cx: a.x,
        cy: a.y,
        r: dotR,
        fill: TOK.paper,
        color: TOK.ink,
        weight: 'sm',
        opacity: prog1,
        z: 4,
      });
      // outcome letter just past the node, away from the leaves
      prims.push({
        k: 'label',
        x: a.x + (portrait ? 0 : -fs * 0.2),
        y: a.y + (portrait ? -fs * 0.75 : -fs * 0.9),
        text: b1.label,
        color: TOK.ink,
        size: fs,
        align: 'middle',
        baseline: 'middle',
        opacity: prog1,
        z: 5,
      });
    }
    // ---- stage 2
    P.stage2.forEach((b2, j) => {
      const l = leaf(i, j);
      branch(a, l, b2.p, prog1 * prog2, 3);
      if (prog1 * prog2 > 0.001) {
        const op = prog1 * prog2;
        const hi = hiSet.find((h) => h.path[0] === i && h.path[1] === j);
        const hiOp = hi ? hi.op : 0;
        prims.push({
          k: 'circle',
          cx: l.x,
          cy: l.y,
          r: dotR,
          fill: hiOp > 0.5 ? TOK.accent : TOK.paper,
          color: TOK.ink,
          weight: 'sm',
          opacity: op,
          z: 4,
        });
        const combined = `${b1.label}·${b2.label}`; // leaf outcome, e.g. "H·T"
        const prod = b1.p * b2.p; // the multiplication rule — computed, never authored
        if (portrait) {
          prims.push({
            k: 'label',
            x: l.x,
            y: box.h * 0.78,
            text: combined,
            color: TOK.ink,
            size: fs,
            align: 'middle',
            baseline: 'middle',
            opacity: op,
            z: 5,
          });
          if (prodOp > 0.001) {
            if (hiOp > 0.001)
              prims.push({
                k: 'rect',
                x: l.x - slot * 0.42,
                y: box.h * 0.835,
                w: slot * 0.84,
                h: fs * 1.6,
                rx: fs * 0.4,
                fill: TOK.accent,
                opacity: 0.18 * hiOp * prodOp,
                color: TOK.accent,
                weight: 'sm',
                z: 5,
              });
            prims.push({
              k: 'label',
              x: l.x,
              y: box.h * 0.855,
              text: fmtP(prod),
              color: hiOp > 0.5 ? TOK.accent : TOK.soft,
              size: fs * 0.95,
              align: 'middle',
              baseline: 'middle',
              opacity: op * prodOp,
              z: 6,
            });
          }
        } else {
          prims.push({
            k: 'label',
            x: box.w * 0.745,
            y: l.y,
            text: combined,
            color: TOK.ink,
            size: fs,
            align: 'start',
            baseline: 'middle',
            opacity: op,
            z: 5,
          });
          if (prodOp > 0.001) {
            if (hiOp > 0.001)
              prims.push({
                k: 'rect',
                x: box.w * 0.855,
                y: l.y - fs * 0.8,
                w: box.w * 0.105,
                h: fs * 1.6,
                rx: fs * 0.4,
                fill: TOK.accent,
                opacity: 0.18 * hiOp * prodOp,
                color: TOK.accent,
                weight: 'sm',
                z: 5,
              });
            prims.push({
              k: 'label',
              x: box.w * 0.865,
              y: l.y,
              text: fmtP(prod),
              color: hiOp > 0.5 ? TOK.accent : TOK.soft,
              size: fs * 0.95,
              align: 'start',
              baseline: 'middle',
              opacity: op * prodOp,
              z: 6,
            });
          }
        }
      }
    });
  });

  // ---- Σ of all leaf products (computed check: exactly 1 when renormalized)
  if (prodOp > 0.001 && prog2 > 0.999) {
    let sum = 0;
    for (const b1 of P.stage1) for (const b2 of P.stage2) sum += b1.p * b2.p;
    const ok = Math.abs(sum - 1) < 1e-6;
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * (portrait ? 0.94 : 0.95),
      text: `Σ = ${fmtP(sum)} ${ok ? '✓' : ''}`,
      color: ok ? TOK.good : TOK.warn,
      size: fs,
      align: 'middle',
      baseline: 'middle',
      opacity: 0.75 * prodOp,
      z: 6,
    });
  }

  return { prims, view: box };
}

export const ProbabilityTree: Manipulative<ProbTreeP> = {
  kind: 'probtree',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
