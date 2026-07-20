/**
 * story.ts — story structure (Cambridge Primary English: Reading & Writing —
 * sequencing, beginning/middle/end). Stage boxes joined by arrows, events
 * dropped into stages. verbs: addEvent(stage,text) · highlightStage(i) · reveal.
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types';
import { tween, activeSegment } from './bake';
import { clamp01, TOK } from './util';

export type StoryEvent = { stage: number; text: string };
export type StoryP = {
  stages: string[];
  events: StoryEvent[];
  highlight: number | null;
  arrows: boolean;
};

const DEFAULT: StoryP = {
  stages: ['Beginning', 'Middle', 'End'],
  events: [],
  highlight: null,
  arrows: false,
};

function normalize(raw: unknown): StoryP {
  const r = (raw ?? {}) as Partial<StoryP>;
  return {
    stages: [...(r.stages ?? DEFAULT.stages)],
    events: [...(r.events ?? [])],
    highlight: r.highlight ?? null,
    arrows: !!r.arrows,
  };
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const verbs: Manipulative<StoryP>['verbs'] = {
  addEvent(p, args): VerbClip<StoryP> {
    const ev: StoryEvent = {
      stage: Math.floor(num(args?.stage ?? 0)),
      text: String(args?.text ?? ''),
    };
    return tween(p, { ...p, events: [...p.events, ev] }, 0.45, 'easeOutBack');
  },
  highlightStage(p, args): VerbClip<StoryP> {
    return tween(
      p,
      { ...p, highlight: Math.floor(num(args?.i ?? args ?? 0)) },
      0.4,
      'easeOutCubic',
    );
  },
  reveal(p): VerbClip<StoryP> {
    return tween(p, { ...p, arrows: true }, 0.6, 'easeOutCubic');
  },
};

function render(_params: StoryP, state: ManipState<StoryP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx;
  const seg = activeSegment(state, t);
  const P = seg.to;
  const prims: Prim[] = [];
  const n = P.stages.length;
  const pad = box.w * 0.04;
  const boxW = (box.w - 2 * pad - (n - 1) * box.w * 0.03) / n;
  const boxH = box.h * 0.62;
  const oy = box.h * 0.2;
  const newEvent = seg.verb === 'addEvent' ? P.events.length - 1 : -1;

  P.stages.forEach((st, i) => {
    const x = pad + i * (boxW + box.w * 0.03);
    const hi = P.highlight === i;
    prims.push({
      k: 'rect',
      x,
      y: oy,
      w: boxW,
      h: boxH,
      fill: hi ? TOK.warn : TOK.paper,
      color: TOK.ink,
      weight: 'md',
      rx: 12,
      opacity: hi ? 0.5 : 1,
      z: 2,
    });
    prims.push({
      k: 'label',
      x: x + boxW / 2,
      y: oy + boxH * 0.12,
      text: st,
      color: TOK.accent,
      size: box.h * 0.06,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    });
    // events in this stage
    const evs = P.events.map((e, k) => ({ e, k })).filter(({ e }) => e.stage === i);
    evs.forEach(({ e, k }, row) => {
      const grow = k === newEvent ? seg.p : 1;
      prims.push({
        k: 'label',
        x: x + boxW / 2,
        y: oy + boxH * 0.32 + row * box.h * 0.08,
        text: e.text,
        color: TOK.ink,
        size: box.h * 0.05,
        align: 'middle',
        baseline: 'middle',
        opacity: grow,
        z: 3,
      });
    });
    // arrow to next stage
    if (P.arrows && i < n - 1) {
      const ax0 = x + boxW,
        ax1 = ax0 + box.w * 0.03;
      const ay = oy + boxH / 2;
      const grow = seg.verb === 'reveal' ? clamp01(seg.p * n - i) : 1;
      if (grow > 0)
        prims.push({
          k: 'path',
          d: `M ${ax0} ${ay} L ${ax1} ${ay}`,
          color: TOK.accent2,
          weight: 'md',
          opacity: grow,
          z: 4,
        });
    }
  });

  return { prims, view: box };
}

export const StorySequence: Manipulative<StoryP> = {
  kind: 'story',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
};
