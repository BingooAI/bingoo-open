/**
 * essaymap.ts — EssayMap: essay structure builder (IELTS Writing Task 2 /
 * academic writing; ages 15+ / adult). A vertical map of essay blocks
 * (hook → thesis → topic → evidence → conclusion) revealed top-down with
 * linking connectives drawn on the arrows, or scrambled with the role badges
 * HIDDEN for reorder practice — the learner restores the canonical sequence,
 * which is computed from the block roles (real logic, code-verifiable).
 * verbs: reveal · revealAll · swap(i,j) · showRoles · setMode(mode) ·
 * setBlocks(blocks).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { clamp01, lerp, TOK } from './util';

export type EssayRole = 'hook' | 'thesis' | 'topic' | 'evidence' | 'conclusion';
export type EssayBlock = { role: EssayRole; text: string };
export type EssayP = {
  blocks: EssayBlock[];
  /** how many blocks are visible (build mode reveals top-down). */
  revealed: number;
  /** current arrangement: slot s shows blocks[order[s]] (reorder practice). */
  order: number[];
  /** linking phrases cycled over the connector arrows. */
  connective: string[];
  mode: 'build' | 'reorder';
  /** role badges visible (reorder hides them — showRoles reveals the answer). */
  rolesShown: boolean;
  /** first slot of a two-tap swap (interaction state). */
  sel: number | null;
};

const ROLES: EssayRole[] = ['hook', 'thesis', 'topic', 'evidence', 'conclusion'];
/** Canonical position of each role in an essay — the REAL ordering logic
 *  (interactions.ts imports it to grade the drag-to-reorder: one source of truth). */
export const RANK: Record<EssayRole, number> = {
  hook: 0,
  thesis: 1,
  topic: 2,
  evidence: 3,
  conclusion: 4,
};
const BADGE_FILL: Record<EssayRole, string> = {
  hook: TOK.warn,
  thesis: TOK.accent,
  topic: TOK.ink,
  evidence: TOK.accent2,
  conclusion: TOK.good,
};

const DEFAULT: EssayP = {
  blocks: [
    { role: 'hook', text: 'Remote work is now common worldwide.' },
    { role: 'thesis', text: 'I believe it benefits staff and firms.' },
    { role: 'topic', text: 'Employees save hours of commuting.' },
    { role: 'evidence', text: 'Surveys report two extra free hours a day.' },
    { role: 'conclusion', text: 'Flexible work is a clear win for both.' },
  ],
  revealed: 1,
  order: [0, 1, 2, 3, 4],
  connective: ['First,', 'For example,', 'In conclusion,'],
  mode: 'build',
  rolesShown: true,
  sel: null,
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalize(raw: unknown): EssayP {
  const r = (raw ?? {}) as Partial<EssayP>;
  const src = Array.isArray(r.blocks) && r.blocks.length ? r.blocks : DEFAULT.blocks;
  const blocks: EssayBlock[] = src.map((b) => {
    const role = (b as EssayBlock | null)?.role as EssayRole;
    return {
      role: ROLES.includes(role) ? role : 'topic',
      text: String((b as EssayBlock | null)?.text ?? ''),
    };
  });
  const n = blocks.length;
  let order = Array.isArray(r.order) ? r.order.map((x) => Math.floor(num(x))) : [];
  const perm = order.length === n && [...order].sort((a, b) => a - b).every((v, i) => v === i);
  if (!perm) order = blocks.map((_, i) => i);
  const mode: EssayP['mode'] = r.mode === 'reorder' ? 'reorder' : 'build';
  const sel = r.sel == null ? null : Math.max(0, Math.min(n - 1, Math.floor(num(r.sel))));
  return {
    blocks,
    revealed: Math.max(0, Math.min(n, Math.floor(num(r.revealed ?? 1)))),
    order,
    connective:
      Array.isArray(r.connective) && r.connective.length
        ? r.connective.map(String)
        : [...DEFAULT.connective],
    mode,
    rolesShown: r.rolesShown != null ? !!r.rolesShown : mode !== 'reorder',
    sel,
  };
}

const verbs: Manipulative<EssayP>['verbs'] = {
  reveal(p): VerbClip<EssayP> {
    return tween(
      p,
      { ...p, revealed: Math.min(p.blocks.length, p.revealed + 1) },
      0.55,
      'easeOutCubic',
    );
  },
  revealAll(p): VerbClip<EssayP> {
    const left = Math.max(1, p.blocks.length - p.revealed);
    return tween(
      p,
      { ...p, revealed: p.blocks.length },
      Math.min(0.9, 0.35 + 0.14 * left),
      'easeOutCubic',
    );
  },
  swap(p, args): VerbClip<EssayP> {
    const n = p.order.length;
    const ci = (v: unknown) => Math.max(0, Math.min(n - 1, Math.floor(num(v))));
    const i = ci(args?.i ?? 0);
    const j = ci(args?.j ?? i + 1);
    const order = [...p.order];
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
    return tween(p, { ...p, order, sel: null }, 0.6, 'easeInOutCubic');
  },
  showRoles(p): VerbClip<EssayP> {
    return tween(p, { ...p, rolesShown: true }, 0.5, 'easeOutCubic');
  },
  setMode(p, args): VerbClip<EssayP> {
    const mode: EssayP['mode'] = (args?.mode ?? args) === 'reorder' ? 'reorder' : 'build';
    const next: EssayP =
      mode === 'reorder'
        ? { ...p, mode, rolesShown: false, revealed: p.blocks.length, sel: null }
        : { ...p, mode, rolesShown: true, sel: null };
    return tween(p, next, 0.45, 'easeOutCubic');
  },
  setBlocks(p, args): VerbClip<EssayP> {
    const next = normalize({
      ...p,
      blocks: (args?.blocks ?? p.blocks) as EssayBlock[],
      order: [],
      sel: null,
    });
    return tween(p, next, 0.5, 'easeOutCubic');
  },
};

/* ---------------------------------------------------------------- layout */

// keep in sync with contrib/essaymap.interactions.ts.txt onTap
function geom(n: number, box: { w: number; h: number }) {
  const portrait = box.h > box.w;
  const colW = box.w * (portrait ? 0.86 : 0.52);
  const slotH = (box.h * 0.88) / Math.max(1, n);
  return { colX: (box.w - colW) / 2, colW, top: box.h * 0.06, slotH, cardH: slotH * 0.74 };
}

function trunc(s: string, max: number): string {
  const m = Math.max(2, Math.floor(max));
  return s.length <= m ? s : s.slice(0, m - 1).trimEnd() + '…';
}

function render(_params: EssayP, state: ManipState<EssayP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const n = P.blocks.length;
  const g = geom(n, box);
  const size = Math.min(g.cardH * 0.3, box.h * 0.045);
  const badgeSize = size * 0.72;
  const reorder = P.mode === 'reorder';
  const rx = g.cardH * 0.16;

  // per-slot visibility (reveal / revealAll animate in; reorder shows all)
  const vis = (s: number): number => {
    if (reorder) return 1;
    if (seg.verb === 'reveal') return s < seg.from.revealed ? 1 : s < P.revealed ? seg.p : 0;
    if (seg.verb === 'revealAll') {
      const r0 = seg.from.revealed;
      if (s < r0) return 1;
      if (s >= P.revealed) return 0;
      return clamp01(seg.p * Math.max(1, P.revealed - r0) - (s - r0));
    }
    return s < P.revealed ? 1 : 0;
  };

  // badge opacity (the "answer" fading in via showRoles)
  const badgeOp = P.rolesShown ? (seg.verb === 'showRoles' ? seg.p : 1) : 0;

  // map block index → previous slot (for the swap glide)
  const prevSlot: number[] = [];
  const fromOrder = seg.verb === 'swap' ? seg.from.order : P.order;
  for (let s = 0; s < n; s++) prevSlot[fromOrder[s]!] = s;

  for (let s = 0; s < n; s++) {
    const bi = reorder ? P.order[s]! : s;
    const b = P.blocks[bi]!;
    const v = vis(s);
    if (v <= 0.001) continue;

    let x = g.colX;
    let y = g.top + s * g.slotH;
    if (!reorder) {
      // build mode: new card slides in from the left
      x = g.colX - (1 - v) * box.w * 0.22;
    } else if (seg.verb === 'swap') {
      const oldS = prevSlot[bi] ?? s;
      if (oldS !== s) {
        y = lerp(g.top + oldS * g.slotH, y, seg.p);
        // glide PAST each other: sideways arc, opposite directions
        x += Math.sin(Math.PI * clamp01(seg.p)) * g.colW * 0.09 * (oldS < s ? 1 : -1);
      }
    }

    // card
    prims.push({
      k: 'rect',
      x,
      y,
      w: g.colW,
      h: g.cardH,
      fill: TOK.paper,
      color: TOK.ink,
      weight: 'sm',
      rx,
      opacity: v,
      z: 3,
    });
    // selection ring (two-tap swap)
    if (reorder && P.sel === s) {
      prims.push({
        k: 'rect',
        x: x - size * 0.25,
        y: y - size * 0.25,
        w: g.colW + size * 0.5,
        h: g.cardH + size * 0.5,
        fill: 'none',
        color: TOK.accent,
        weight: 'lg',
        rx: rx + size * 0.25,
        opacity: v,
        z: 6,
      });
    }
    // role badge (colour-coded; text comes from the authored role param)
    if (badgeOp > 0.001) {
      const bw = b.role.length * badgeSize * 0.62 + badgeSize;
      prims.push({
        k: 'rect',
        x: x + size * 0.5,
        y: y + g.cardH * 0.1,
        w: bw,
        h: badgeSize * 1.5,
        fill: BADGE_FILL[b.role],
        rx: badgeSize * 0.7,
        opacity: v * badgeOp,
        z: 4,
      });
      prims.push({
        k: 'label',
        x: x + size * 0.5 + bw / 2,
        y: y + g.cardH * 0.1 + badgeSize * 0.78,
        text: b.role,
        color: TOK.paper,
        size: badgeSize,
        align: 'middle',
        baseline: 'middle',
        opacity: v * badgeOp,
        z: 5,
      });
    }
    // block text (short, truncated)
    const maxChars = (g.colW - size) / (size * 0.52);
    prims.push({
      k: 'label',
      x: x + size * 0.5,
      y: y + g.cardH * 0.68,
      text: trunc(b.text, maxChars),
      color: TOK.ink,
      size,
      align: 'start',
      baseline: 'middle',
      opacity: v,
      z: 4,
    });
  }

  // connectors (build mode): arrows drawing on, labelled with the connective
  if (!reorder) {
    const cx = g.colX + g.colW * 0.5;
    const gap = g.slotH - g.cardH;
    for (let s = 1; s < n; s++) {
      const v = Math.min(vis(s), vis(s - 1));
      if (v <= 0.001) continue;
      const y0 = g.top + (s - 1) * g.slotH + g.cardH;
      const yEnd = y0 + gap * v; // arrow draws on with seg.p
      const ah = Math.min(gap * 0.4, size * 0.5);
      prims.push({
        k: 'line',
        x1: cx,
        y1: y0,
        x2: cx,
        y2: yEnd,
        color: TOK.accent2,
        weight: 'md',
        opacity: v,
        z: 2,
      });
      prims.push({
        k: 'path',
        d: `M ${cx - ah * 0.7} ${yEnd - ah} L ${cx} ${yEnd} L ${cx + ah * 0.7} ${yEnd - ah}`,
        color: TOK.accent2,
        weight: 'md',
        opacity: v,
        z: 2,
      });
      const phrase = P.connective[(s - 1) % P.connective.length] ?? '';
      prims.push({
        k: 'label',
        x: cx + size * 0.7,
        y: y0 + gap / 2,
        text: trunc(phrase, (box.w - cx) / (size * 0.45)),
        color: TOK.accent2,
        size: size * 0.8,
        align: 'start',
        baseline: 'middle',
        opacity: v,
        z: 4,
      });
    }
  }

  return { prims, view: box };
}

export const EssayMap: Manipulative<EssayP> = {
  kind: 'essaymap',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
