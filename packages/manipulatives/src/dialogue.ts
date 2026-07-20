/**
 * dialogue.ts — DialogueFlow: conversation / exchange builder (TOEIC
 * conversations, business email chains, speaking-test role-play; teens–adult).
 * A two-speaker chat: bubbles appear turn by turn (play mode), functional
 * labels (greeting / request / refusal…) can be highlighted on the matching
 * bubbles, and a scrambled exchange can be re-sequenced (reorder mode). The
 * correct sequence is the authored turn order — identity permutation (real,
 * code-verifiable). verbs: next · playAll · swap(i,j) · highlightFn(fn) ·
 * setDialogue(speakers,turns) · setMode(mode).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { clamp01, lerp, TOK } from './util';

export type DialogueTurn = { who: 0 | 1; text: string; fn?: string };
export type DialogueP = {
  speakers: [string, string];
  turns: DialogueTurn[];
  /** how many bubbles are visible in play mode. */
  shown: number;
  /** current arrangement: slot s shows turns[order[s]] (reorder practice). */
  order: number[];
  mode: 'play' | 'reorder';
  /** functional label to ring ("all" = every labelled bubble, null = none). */
  highlightFn: string | null;
  /** first slot of a two-tap swap (interaction state). */
  sel: number | null;
};

const DEFAULT: DialogueP = {
  speakers: ['A', 'B'],
  turns: [
    { who: 0, text: 'Good morning! Could you review my report?', fn: 'request' },
    { who: 1, text: 'Of course. When do you need it back?', fn: 'agreeing' },
    { who: 0, text: 'Would this Friday be possible?', fn: 'request' },
    { who: 1, text: 'Certainly — Friday works for me.', fn: 'confirming' },
  ],
  shown: 1,
  order: [0, 1, 2, 3],
  mode: 'play',
  highlightFn: null,
  sel: null,
};

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalize(raw: unknown): DialogueP {
  const r = (raw ?? {}) as Partial<DialogueP>;
  const sp = Array.isArray(r.speakers) ? r.speakers : DEFAULT.speakers;
  const speakers: [string, string] = [String(sp[0] ?? 'A') || 'A', String(sp[1] ?? 'B') || 'B'];
  const src = Array.isArray(r.turns) && r.turns.length ? r.turns : DEFAULT.turns;
  const turns: DialogueTurn[] = src.map((tn) => {
    const o = (tn ?? {}) as Partial<DialogueTurn>;
    return {
      who: Math.floor(num(o.who)) === 1 ? 1 : 0,
      text: String(o.text ?? ''),
      ...(o.fn != null ? { fn: String(o.fn) } : {}),
    };
  });
  const n = turns.length;
  let order = Array.isArray(r.order) ? r.order.map((x) => Math.floor(num(x))) : [];
  const perm = order.length === n && [...order].sort((a, b) => a - b).every((v, i) => v === i);
  if (!perm) order = turns.map((_, i) => i);
  const mode: DialogueP['mode'] = r.mode === 'reorder' ? 'reorder' : 'play';
  const sel = r.sel == null ? null : Math.max(0, Math.min(n - 1, Math.floor(num(r.sel))));
  return {
    speakers,
    turns,
    shown: Math.max(0, Math.min(n, Math.floor(num(r.shown ?? 1)))),
    order,
    mode,
    highlightFn: r.highlightFn == null ? null : String(r.highlightFn),
    sel,
  };
}

const verbs: Manipulative<DialogueP>['verbs'] = {
  next(p): VerbClip<DialogueP> {
    return tween(p, { ...p, shown: Math.min(p.turns.length, p.shown + 1) }, 0.5, 'easeOutCubic');
  },
  playAll(p): VerbClip<DialogueP> {
    const left = Math.max(1, p.turns.length - p.shown);
    return tween(
      p,
      { ...p, shown: p.turns.length },
      Math.min(0.9, 0.35 + 0.14 * left),
      'easeOutCubic',
    );
  },
  swap(p, args): VerbClip<DialogueP> {
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
  highlightFn(p, args): VerbClip<DialogueP> {
    const raw = args && typeof args === 'object' ? (args.fn ?? null) : (args ?? null);
    return tween(p, { ...p, highlightFn: raw == null ? null : String(raw) }, 0.45, 'easeOutCubic');
  },
  setDialogue(p, args): VerbClip<DialogueP> {
    const next = normalize({
      ...p,
      speakers: (args?.speakers ?? p.speakers) as [string, string],
      turns: (args?.turns ?? p.turns) as DialogueTurn[],
      shown: 1,
      order: [],
      highlightFn: null,
      sel: null,
    });
    return tween(p, next, 0.5, 'easeOutCubic');
  },
  setMode(p, args): VerbClip<DialogueP> {
    const mode: DialogueP['mode'] = (args?.mode ?? args) === 'reorder' ? 'reorder' : 'play';
    const next: DialogueP =
      mode === 'reorder'
        ? { ...p, mode, shown: p.turns.length, sel: null }
        : { ...p, mode, sel: null };
    return tween(p, next, 0.45, 'easeOutCubic');
  },
};

/* ---------------------------------------------------------------- layout */

// keep in sync with contrib/dialogue.interactions.ts.txt onTap
function geom(n: number, box: { w: number; h: number }) {
  const top = box.h * 0.05;
  const slotH = (box.h * 0.9) / Math.max(1, n);
  return { top, slotH };
}

/** deterministic greedy word-wrap by estimated char count. */
function wrap(text: string, maxChars: number): string[] {
  const m = Math.max(4, Math.floor(maxChars));
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (cand.length <= m || !cur) cur = cand;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function render(
  _params: DialogueP,
  state: ManipState<DialogueP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const portrait = box.h > box.w;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const n = P.turns.length;
  const g = geom(n, box);
  const size = Math.min(g.slotH * 0.24, box.h * 0.05, box.w * 0.045);
  const avaR = Math.min(g.slotH * 0.2, box.w * 0.045);
  const charW = size * 0.52;
  const lineH = size * 1.3;
  const maxW = box.w * (portrait ? 0.62 : 0.56);
  const reorder = P.mode === 'reorder';

  // per-slot visibility (play mode: next / playAll animate in; reorder shows all)
  const vis = (s: number): number => {
    if (reorder) return 1;
    if (seg.verb === 'next') return s < seg.from.shown ? 1 : s < P.shown ? seg.p : 0;
    if (seg.verb === 'playAll') {
      const r0 = seg.from.shown;
      if (s < r0) return 1;
      if (s >= P.shown) return 0;
      return clamp01(seg.p * Math.max(1, P.shown - r0) - (s - r0)); // staggered
    }
    return s < P.shown ? 1 : 0;
  };

  // map turn index → previous slot (swap glide)
  const prevSlot: number[] = [];
  const fromOrder = seg.verb === 'swap' ? seg.from.order : P.order;
  for (let s = 0; s < n; s++) prevSlot[fromOrder[s]!] = s;

  const fnGlow = seg.verb === 'highlightFn' ? seg.p : 1;

  for (let s = 0; s < n; s++) {
    const ti = reorder ? P.order[s]! : s;
    const turn = P.turns[ti]!;
    const v = vis(s);
    if (v <= 0.001) continue;

    let cy = g.top + s * g.slotH + g.slotH / 2;
    let xShift = 0;
    if (!reorder) {
      cy += (1 - v) * g.slotH * 0.25; // slide up while fading in
    } else if (seg.verb === 'swap') {
      const oldS = prevSlot[ti] ?? s;
      if (oldS !== s) {
        cy = lerp(g.top + oldS * g.slotH + g.slotH / 2, cy, seg.p);
        xShift = Math.sin(Math.PI * clamp01(seg.p)) * box.w * 0.035 * (oldS < s ? 1 : -1);
      }
    }

    // word-wrap + adaptive bubble size (chars × size estimate)
    const maxChars = maxW / charW;
    const maxLines = Math.max(1, Math.floor((g.slotH * 0.88 - size * 0.8) / lineH));
    let lines = wrap(turn.text, maxChars);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      const last = lines[maxLines - 1]!;
      lines[maxLines - 1] = last.slice(0, Math.max(1, last.length - 1)) + '…';
    }
    const longest = lines.reduce((a, l) => Math.max(a, l.length), 1);
    const bw = longest * charW + size * 1.2;
    const bh = lines.length * lineH + size * 0.8;

    const left = turn.who === 0;
    const avaX = left ? box.w * 0.05 + avaR : box.w * 0.95 - avaR;
    const bx =
      (left ? box.w * 0.05 + avaR * 2 + size * 0.6 : box.w * 0.95 - avaR * 2 - size * 0.6 - bw) +
      xShift;
    const by = cy - bh / 2;
    const tint = left ? TOK.accent : TOK.accent2;
    const fill = reorder ? TOK.faint : tint;
    const fillOp = (reorder ? 0.55 : 0.22) * v; // grayed while reordering

    // bubble + tail
    prims.push({
      k: 'rect',
      x: bx,
      y: by,
      w: bw,
      h: bh,
      fill,
      rx: size * 0.7,
      opacity: fillOp,
      z: 3,
    });
    const tx = left ? bx : bx + bw;
    const dir = left ? -1 : 1;
    prims.push({
      k: 'path',
      d: `M ${tx - dir * 2} ${cy - size * 0.4} L ${tx + dir * size * 0.6} ${cy} L ${tx - dir * 2} ${cy + size * 0.4} Z`,
      fill,
      opacity: fillOp,
      closed: true,
      z: 3,
    });
    // selection ring (two-tap swap)
    if (reorder && P.sel === s) {
      prims.push({
        k: 'rect',
        x: bx - size * 0.3,
        y: by - size * 0.3,
        w: bw + size * 0.6,
        h: bh + size * 0.6,
        fill: 'none',
        color: TOK.accent,
        weight: 'lg',
        rx: size * 0.9,
        opacity: v,
        z: 6,
      });
    }
    // text lines
    lines.forEach((ln, li) => {
      prims.push({
        k: 'label',
        x: bx + size * 0.6,
        y: by + size * 0.4 + lineH * (li + 0.5),
        text: ln,
        color: TOK.ink,
        size,
        align: 'start',
        baseline: 'middle',
        opacity: v,
        z: 4,
      });
    });
    // avatar with speaker initial (from params)
    prims.push({ k: 'circle', cx: avaX, cy, r: avaR, fill: tint, opacity: 0.9 * v, z: 3 });
    const initial = (P.speakers[turn.who] || ' ').slice(0, 1).toUpperCase();
    prims.push({
      k: 'label',
      x: avaX,
      y: cy,
      text: initial,
      color: TOK.paper,
      size: avaR * 1.1,
      align: 'middle',
      baseline: 'middle',
      opacity: v,
      z: 4,
    });

    // functional label badge + ring when highlighted
    const match =
      turn.fn != null &&
      P.highlightFn != null &&
      (P.highlightFn === 'all' || P.highlightFn === turn.fn);
    if (match && turn.fn) {
      const bsz = size * 0.72;
      const bwid = turn.fn.length * bsz * 0.62 + bsz;
      const bxx = left ? bx + bw - bwid : bx;
      prims.push({
        k: 'rect',
        x: bxx,
        y: by - bsz * 0.9,
        w: bwid,
        h: bsz * 1.5,
        fill: TOK.paper,
        color: TOK.warn,
        weight: 'sm',
        rx: bsz * 0.7,
        opacity: v * fnGlow,
        z: 6,
      });
      prims.push({
        k: 'label',
        x: bxx + bwid / 2,
        y: by - bsz * 0.15,
        text: turn.fn,
        color: TOK.warn,
        size: bsz,
        align: 'middle',
        baseline: 'middle',
        opacity: v * fnGlow,
        z: 7,
      });
      prims.push({
        k: 'rect',
        x: bx - size * 0.2,
        y: by - size * 0.2,
        w: bw + size * 0.4,
        h: bh + size * 0.4,
        fill: 'none',
        color: TOK.warn,
        weight: 'md',
        rx: size * 0.8,
        opacity: v * fnGlow,
        z: 6,
      });
    }
  }

  return { prims, view: box };
}

export const DialogueFlow: Manipulative<DialogueP> = {
  kind: 'dialogue',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
