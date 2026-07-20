/**
 * phonics.ts — Phonics sound blocks (Cambridge Primary English: Reading — phonics
 * & word recognition). A word shown as grapheme boxes with "sound buttons";
 * `segment` slides them apart to sound each phoneme, `blend` pushes them together
 * to read the whole word. The blend↔segment move is the core early-reading skill
 * (analogous to base-10 regroup), so it's the deep case here.
 * verbs: segment · blend · sound(i) · setWord(word, graphemes).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { lerp, TOK } from './util';

export type PhonicsP = { graphemes: string[]; segmented: boolean; sounded: number | null };

const DEFAULT: PhonicsP = { graphemes: ['c', 'a', 't'], segmented: false, sounded: null };

function normalize(raw: unknown): PhonicsP {
  const r = (raw ?? {}) as Partial<PhonicsP> & { word?: string };
  let graphemes = r.graphemes;
  if (!graphemes && r.word) graphemes = r.word.split('');
  return {
    graphemes: graphemes ?? DEFAULT.graphemes,
    segmented: !!r.segmented,
    sounded: r.sounded ?? null,
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<PhonicsP>['verbs'] = {
  segment(p): VerbClip<PhonicsP> {
    return tween(
      { ...p, segmented: false },
      { ...p, segmented: true, sounded: null },
      0.6,
      'easeOutCubic',
    );
  },
  blend(p): VerbClip<PhonicsP> {
    return tween(
      { ...p, segmented: true },
      { ...p, segmented: false, sounded: null },
      0.6,
      'easeInOutCubic',
    );
  },
  sound(p, args): VerbClip<PhonicsP> {
    return tween(p, { ...p, sounded: Math.floor(num(args?.i ?? args ?? 0)) }, 0.4, 'easeOutBack');
  },
  setWord(p, args): VerbClip<PhonicsP> {
    const graphemes = args?.graphemes ?? (args?.word ? String(args.word).split('') : p.graphemes);
    return tween(p, { graphemes, segmented: false, sounded: null }, 0.4, 'easeOutBack');
  },
};

function render(
  _params: PhonicsP,
  state: ManipState<PhonicsP>,
  t: number,
  ctx: RenderCtx,
): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const n = P.graphemes.length;
  const boxH = Math.min(box.h * 0.32, box.w * 0.2);
  const boxW = Math.min(boxH, (box.w * 0.86) / n / 1.7);
  const maxGap = boxW * 0.9;
  // animate the inter-box gap between blended (0) and segmented (maxGap)
  const segFrom = seg.from.segmented ? maxGap : 0;
  const segTo = P.segmented ? maxGap : 0;
  const gap = seg.verb === 'segment' || seg.verb === 'blend' ? lerp(segFrom, segTo, seg.p) : segTo;
  const totalW = n * boxW + (n - 1) * gap;
  const ox = (box.w - totalW) / 2;
  const cy = box.h * 0.42;

  P.graphemes.forEach((g, i) => {
    const x = ox + i * (boxW + gap);
    const hi = P.sounded === i;
    const grow = hi && seg.verb === 'sound' ? seg.p : hi ? 1 : 0;
    prims.push({
      k: 'rect',
      x,
      y: cy - boxH / 2,
      w: boxW,
      h: boxH,
      fill: hi ? TOK.warn : TOK.paper,
      color: TOK.ink,
      weight: 'md',
      rx: boxW * 0.14,
      opacity: hi ? 0.4 + 0.6 * grow : 1,
      z: 2,
    });
    prims.push({
      k: 'label',
      x: x + boxW / 2,
      y: cy,
      text: g,
      color: TOK.ink,
      size: boxH * 0.6,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    });
    // sound button: dot for a single letter, dash for a digraph/trigraph
    const by = cy + boxH * 0.66;
    if (g.length === 1)
      prims.push({
        k: 'circle',
        cx: x + boxW / 2,
        cy: by,
        r: boxW * 0.09,
        fill: TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        z: 3,
      });
    else
      prims.push({
        k: 'line',
        x1: x + boxW * 0.2,
        y1: by,
        x2: x + boxW * 0.8,
        y2: by,
        color: TOK.accent2,
        weight: 'md',
        cap: 'round',
        z: 3,
      });
  });

  // whole word (bold when blended)
  const word = P.graphemes.join('');
  prims.push({
    k: 'label',
    x: box.w / 2,
    y: box.h * 0.85,
    text: word,
    color: P.segmented ? TOK.soft : TOK.accent,
    size: boxH * 0.7,
    align: 'middle',
    baseline: 'middle',
    z: 4,
  });

  return { prims, view: box };
}

export const PhonicsBlocks: Manipulative<PhonicsP> = {
  kind: 'phonics',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
