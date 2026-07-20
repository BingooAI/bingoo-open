/**
 * frame.ts — the spine (spec §2):
 *   frame(program, t) → RenderModel
 * A PURE function of `t`. No side effects, no rAF, no closures over mutable
 * state. Same t ⇒ same RenderModel ⇒ same pixels on any renderer.
 *
 * RenderModel is platform-neutral data (resolved elements + pose + rect at t).
 * The web SVG renderer and (later) the RN Skia renderer both consume THIS —
 * that boundary is what makes the engine cross-platform.
 */
import type {
  Aspect,
  Pose,
  Rect,
  StyleTokens,
  ElementType,
  GateSpec,
  Diagram,
  Background,
} from './schema';
import { asDiagram, asManipulative } from './schema';
import type { Chrome } from './layout';
import type { Ambient } from './schema';
import { getManipulative } from '@bingoo/manipulatives';
import type { ManipModel } from '@bingoo/manipulatives';
import { graphLayout, type GraphLayout } from './layout';
import type { Program, SceneSlot } from './runtime';
import type { ExplainerDoc } from './schema';
import { sceneAt } from './runtime';
import type { DiagramRenderState } from './choreographer';
import { easeOutCubic } from '@bingoo/manipulatives';

/* ------------------------------------------------------ resolved render data */

export type StrokeContent = { kind: 'stroke'; path: string; local: number }; // path in 0..100 box
export type TextContent = { kind: 'text'; text: string };
export type ShapeContent = { kind: 'shape'; shape: string; text?: string };
/** `w`/`h` are the asset's NATURAL pixel size (the media library returns them).
 *  Layout uses them to hand the image a rect of the right aspect so it fills its
 *  slot instead of letterboxing into a tiny centred speck. */
export type ImageContent = {
  kind: 'image';
  src?: string;
  alt?: string;
  /** natural-language description used to SEARCH the media library first */
  query?: string;
  /** English fallback used only if the library has nothing and we generate */
  prompt?: string;
  w?: number;
  h?: number;
};
export type StickContent = { kind: 'stick' };
export type DiagramContent = {
  kind: 'diagram';
  diagram: Diagram;
  graph: GraphLayout;
  state: DiagramRenderState;
};
/** A manipulative resolved to platform-neutral primitives at t (math kit).
 *  Named *…RenderContent to avoid clashing with schema.ManipulativeContent (the
 *  authored form). */
export type ManipulativeRenderContent = {
  kind: 'manipulative';
  manipKind: string;
  model: ManipModel;
};
export type ConnectorContent = {
  kind: 'connector';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arrow: boolean;
  label?: string;
  dash?: boolean;
  cx: number;
  cy: number;
};
/* ── the slide layer, resolved: localized strings in, per-row reveal attached ──
 * `reveal[i]` is 0..1 for row i, sampled from the timeline — so a bulleted list
 * builds in one line at a time exactly like a deck, and it is still a PURE
 * function of t, so scrubbing backwards un-builds it. */
export type ListRenderContent = {
  kind: 'list';
  style: 'bullet' | 'number' | 'check' | 'dash' | 'none';
  items: string[];
  dense?: boolean;
  reveal: number[];
};
export type TableRenderContent = {
  kind: 'table';
  header?: string[];
  rows: string[][];
  align?: ('left' | 'center' | 'right')[];
  reveal: number[];
};
export type ChartRenderContent = {
  kind: 'chart';
  chart: 'bar' | 'column' | 'line' | 'area' | 'pie' | 'donut';
  series: { label: string; value: number; color?: string }[];
  unit?: string;
  /** DERIVED, never authored — see resolveContent */
  max: number;
  total: number;
  showValues: boolean;
  reveal: number[];
};
export type StatRenderContent = {
  kind: 'stat';
  value: string;
  label?: string;
  unit?: string;
  color?: string;
};
export type QuoteRenderContent = { kind: 'quote'; text: string; by?: string };

export type ResolvedContent =
  | StrokeContent
  | TextContent
  | ShapeContent
  | ImageContent
  | StickContent
  | DiagramContent
  | ManipulativeRenderContent
  | ConnectorContent
  | ListRenderContent
  | TableRenderContent
  | ChartRenderContent
  | StatRenderContent
  | QuoteRenderContent;

export type RenderItem = {
  id: string;
  type: ElementType;
  rect: Rect; // laid-out box in logical canvas units
  pose: Pose; // sampled pose at t (offsets/opacity/scale/emphasis/joints…)
  z: number;
  style?: StyleTokens;
  content: ResolvedContent;
  t: number; // scene-local time — lets props animate internally (ripple, shimmer)
  seed: number; // stable per-element seed for deterministic phase offsets
  /** the slot it landed in, and that slot's CELL before aspect-fit. The renderer
   *  uses these to draw a card behind the object — that is what turns a set of
   *  floating shapes into a composition. */
  slot?: string;
  cell?: Rect;
};

export type RenderModel = {
  aspect: Aspect;
  canvas: { w: number; h: number };
  sceneId: string;
  sceneKind: 'exposition' | 'gate';
  items: RenderItem[]; // sorted by z ascending
  /** backdrop (scene overrides doc) — painted behind everything */
  background: Background | null;
  /** frame / header / content / caption bands, already in canvas units */
  chrome: Chrome;
  /** persistent header data: which lesson, and where we are in it */
  lessonTitle: string;
  sceneIndex: number;
  sceneCount: number;
  caption: string | null;
  gate: GateSpec | null; // present when the scene is a gate
  tGlobal: number;
  tScene: number; // scene-local time
  sceneStart: number;
  sceneEnd: number;
  duration: number;
};

/* --------------------------------------------------------------------- frame */

export function frame(program: Program, tGlobal: number): RenderModel {
  const t = Math.max(0, Math.min(program.duration, tGlobal));
  const slot = sceneAt(program, t);
  const tScene = Math.max(0, t - slot.start);

  const items: RenderItem[] = [];
  for (const el of slot.scene.elements) {
    if (el.type === 'audio' || el.type === 'mesh3d') continue; // no 2D geometry in v1
    // a connector draws a line between two OTHER elements' laid-out boxes, so it
    // follows them automatically when they move. It has no box of its own.
    if (el.type === 'connector') {
      const c = (el.content ?? {}) as {
        from?: string;
        to?: string;
        arrow?: boolean;
        label?: string;
        dash?: boolean;
        bendX?: number;
        bendY?: number;
      };
      const a = slot.layout.rects.get(c.from ?? ''),
        b = slot.layout.rects.get(c.to ?? '');
      if (!a || !b) continue;
      const pose = slot.timeline.poseAt(el.id, tScene);
      if (!pose.visible && (pose.opacity ?? 0) <= 0.001) continue;
      const ends = connectorEnds(a, b);
      // control point = chord midpoint + author's bend offset (drag the midpoint
      // handle to bend it any way; bend 0 → straight). Follows the shapes.
      const cpx = (ends.x1 + ends.x2) / 2 + (c.bendX ?? 0),
        cpy = (ends.y1 + ends.y2) / 2 + (c.bendY ?? 0);
      const xs = [ends.x1, ends.x2, cpx],
        ys = [ends.y1, ends.y2, cpy],
        pad = 12;
      const rect = {
        x: Math.min(...xs) - pad,
        y: Math.min(...ys) - pad,
        w: Math.max(...xs) - Math.min(...xs) + 2 * pad,
        h: Math.max(...ys) - Math.min(...ys) + 2 * pad,
      };
      items.push({
        id: el.id,
        type: 'connector',
        rect,
        pose,
        z: el.z ?? -1,
        style: el.style,
        content: {
          kind: 'connector',
          ...ends,
          arrow: c.arrow !== false,
          label: c.label,
          dash: !!c.dash,
          cx: cpx,
          cy: cpy,
        },
        t: tScene,
        seed: hashId(el.id),
      });
      continue;
    }
    const rect = slot.layout.rects.get(el.id);
    if (!rect) continue;
    let pose = slot.timeline.poseAt(el.id, tScene);
    // fully-hidden items are dropped from the model entirely
    if (!pose.visible && (pose.opacity ?? 0) <= 0.001) continue;

    const content = resolveContent(el.type, el.id, el.content, program, slot, rect, tScene);
    if (!content) continue;

    const seed = hashId(el.id);
    if (el.ambient) {
      pose = applyAmbient(
        el.ambient,
        pose,
        tScene,
        slot.end - slot.start,
        rect,
        program.canvas,
        seed,
      );
    }
    // static rotation (editor direct-manip) composes on top of any sway
    if (el.place?.rotate) pose = { ...pose, rot: (pose.rot ?? 0) + el.place.rotate };
    // static opacity multiplies the animated opacity (so fades still work)
    if (el.style?.opacity != null)
      pose = { ...pose, opacity: (pose.opacity ?? 1) * el.style.opacity };

    items.push({
      id: el.id,
      type: el.type,
      rect,
      pose,
      z: el.z ?? 0,
      style: el.style,
      content,
      t: tScene,
      seed,
      slot: slot.layout.slotOf.get(el.id),
      cell: slot.layout.cells.get(el.id),
    });
  }
  items.sort((a, b) => a.z - b.z);

  return {
    aspect: program.aspect,
    canvas: program.canvas,
    sceneId: slot.scene.id,
    sceneKind: slot.scene.kind,
    items,
    background: slot.scene.background ?? program.doc.background ?? null,
    chrome: slot.layout.chrome,
    lessonTitle: program.bundle.strings['meta.title'] ?? program.doc.meta.title,
    sceneIndex: program.doc.scenes.findIndex((sc) => sc.id === slot.scene.id),
    sceneCount: program.doc.scenes.length,
    caption: activeCaption(slot, tScene),
    gate: slot.scene.kind === 'gate' ? (slot.scene.gate ?? null) : null,
    tGlobal: t,
    tScene,
    sceneStart: slot.start,
    sceneEnd: slot.end,
    duration: program.duration,
  };
}

/** Convenience one-shot (builds a program each call) — for tests/tools. */
export function frameOnce(program: Program, t: number): RenderModel {
  return frame(program, t);
}

/** Round an axis maximum UP to a readable tick (1/2/5 × 10ⁿ) — so a bar chart
 *  never tops out at an ugly 37 and the gridlines land on round numbers. */
function niceMax(peak: number): number {
  if (!(peak > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(peak)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const cand = step * mag;
    if (cand >= peak) return cand;
  }
  return 10 * mag;
}

/* --------------------------------------------------------- content resolvers */

function resolveContent(
  type: ElementType,
  id: string,
  raw: unknown,
  program: Program,
  slot: SceneSlot,
  rect: Rect,
  tScene: number,
): ResolvedContent | null {
  const bundle = program.bundle;
  switch (type) {
    case 'text': {
      const text = bundle.strings[id] ?? (raw as { text?: string })?.text ?? '';
      return { kind: 'text', text };
    }
    case 'stroke': {
      const c = (raw ?? {}) as { path?: string };
      return { kind: 'stroke', path: c.path ?? '', local: 100 };
    }
    case 'shape': {
      const c = (raw ?? {}) as { shape?: string; text?: string };
      const text = bundle.strings[id] ?? c.text;
      return { kind: 'shape', shape: c.shape ?? 'rect', text };
    }
    case 'image': {
      const c = (raw ?? {}) as {
        src?: string;
        alt?: string;
        query?: string;
        prompt?: string;
        w?: number;
        h?: number;
      };
      // `query` must survive into the render model: it is what the placeholder
      // shows before the picture is resolved. Dropping it meant an unresolved
      // image rendered as NOTHING, so a preview of a fresh lesson had holes
      // where its pictures were — and the whole point of previewing before
      // spending money on image generation is to see the lesson.
      return {
        kind: 'image',
        src: c.src,
        // the alt shows in the placeholder before the picture resolves, so it
        // must translate too (bundle override, like every other string).
        alt: bundle.strings[`${id}.alt`] ?? c.alt,
        query: c.query,
        prompt: c.prompt,
        w: c.w,
        h: c.h,
      };
    }
    case 'stick': {
      return { kind: 'stick' };
    }
    // ── slide layer ──────────────────────────────────────────────────────────
    case 'list': {
      const c = (raw ?? {}) as {
        style?: ListRenderContent['style'];
        items?: string[];
        dense?: boolean;
      };
      // `${id}.${i}` in the bundle beats the inline string → a list translates
      // without re-authoring, exactly like a text element.
      const items = (c.items ?? []).map((v, i) => bundle.strings[`${id}.${i}`] ?? v);
      return {
        kind: 'list',
        style: c.style ?? 'bullet',
        items,
        dense: c.dense,
        reveal: slot.timeline.itemsAt(id, tScene, items.length),
      };
    }
    case 'table': {
      const c = (raw ?? {}) as {
        header?: string[];
        rows?: string[][];
        align?: TableRenderContent['align'];
      };
      const rows = c.rows ?? [];
      return {
        kind: 'table',
        header: (c.header ?? []).map((v, i) => bundle.strings[`${id}.h${i}`] ?? v),
        rows: rows.map((r, ri) => r.map((v, ci) => bundle.strings[`${id}.${ri}.${ci}`] ?? v)),
        align: c.align,
        reveal: slot.timeline.itemsAt(id, tScene, rows.length),
      };
    }
    case 'chart': {
      const c = (raw ?? {}) as {
        chart?: ChartRenderContent['chart'];
        series?: { label: string; value: number; color?: string }[];
        unit?: string;
        max?: number;
        showValues?: boolean;
      };
      const series = (c.series ?? []).map((s2, i) => ({
        ...s2,
        label: bundle.strings[`${id}.${i}`] ?? s2.label,
      }));
      // MATH BY CODE: the axis maximum and the pie total are DERIVED from the
      // data. An author (or an LLM) cannot hand us a chart whose bars disagree
      // with its numbers, because the bars are not authored at all.
      const values = series.map((s2) => s2.value);
      const total = values.reduce((a, b) => a + b, 0);
      const peak = values.length ? Math.max(...values) : 0;
      return {
        kind: 'chart',
        chart: c.chart ?? 'bar',
        series,
        unit: c.unit,
        max: c.max ?? niceMax(peak),
        total,
        showValues: c.showValues ?? true,
        reveal: slot.timeline.itemsAt(id, tScene, series.length),
      };
    }
    case 'stat': {
      const c = (raw ?? {}) as { value?: string; label?: string; unit?: string; color?: string };
      return {
        kind: 'stat',
        value: bundle.strings[`${id}.value`] ?? c.value ?? '',
        label: bundle.strings[`${id}.label`] ?? c.label,
        unit: c.unit,
        color: c.color,
      };
    }
    case 'quote': {
      const c = (raw ?? {}) as { text?: string; by?: string };
      return {
        kind: 'quote',
        text: bundle.strings[id] ?? c.text ?? '',
        by: bundle.strings[`${id}.by`] ?? c.by,
      };
    }
    case 'diagram': {
      const diagram = asDiagram(raw);
      const graph = graphLayout(diagram, program.aspect, rect);
      const state = slot.timeline.diagramAt(id, tScene);
      return { kind: 'diagram', diagram, graph, state };
    }
    case 'manipulative': {
      const content = asManipulative(raw);
      if (!content) return null;
      const manip = getManipulative(content.kind);
      const state = slot.timeline.manipStateOf(id);
      if (!manip || !state) return null;
      // Draw in the element's local box; render is pure & seek-exact.
      const model = manip.render(state.initial, state, tScene, {
        aspect: program.aspect,
        box: { w: rect.w, h: rect.h },
      });
      return { kind: 'manipulative', manipKind: content.kind, model };
    }
    default:
      return null;
  }
}

/**
 * Every piece of AUTHORED display text that lives in the DOC (not already in a
 * per-locale bundle), keyed EXACTLY the way resolveContent() reads its per-locale
 * override. Translation walks this, translates the values, and writes them back
 * into the target bundle under these same keys — so list items, table cells,
 * chart labels, stats, quotes AND the lesson title all translate, not just the
 * `text` elements. Keep this in lockstep with resolveContent's key scheme above.
 */
export function collectLocalizable(doc: ExplainerDoc): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: unknown) => {
    if (typeof v === 'string' && v.trim()) out[k] = v;
  };
  put('meta.title', doc.meta.title);
  for (const scene of doc.scenes) {
    for (const el of scene.elements) {
      const c = (el.content ?? {}) as Record<string, unknown>;
      const id = el.id;
      switch (el.type) {
        case 'text':
        case 'shape':
          put(id, c.text);
          break;
        case 'list':
          (c.items as string[] | undefined)?.forEach((v, i) => put(`${id}.${i}`, v));
          break;
        case 'table':
          (c.header as string[] | undefined)?.forEach((v, i) => put(`${id}.h${i}`, v));
          (c.rows as string[][] | undefined)?.forEach((r, ri) =>
            r.forEach((v, ci) => put(`${id}.${ri}.${ci}`, v)),
          );
          break;
        case 'chart':
          (c.series as { label?: string }[] | undefined)?.forEach((s, i) =>
            put(`${id}.${i}`, s.label),
          );
          break;
        case 'stat':
          put(`${id}.value`, c.value);
          put(`${id}.label`, c.label);
          break;
        case 'quote':
          put(id, c.text);
          put(`${id}.by`, c.by);
          break;
        case 'image':
          // alt shows in the placeholder before the picture resolves → translate.
          // query stays the source text (it's the media-library SEARCH term).
          put(`${id}.alt`, c.alt);
          break;
        case 'manipulative': {
          // kit params ship authored labels ("{n} âm tiết", "{n} là số CHẴN") —
          // Vietnamese in a VI lesson, so they must translate like everything else.
          const labels = (c.params as { labels?: Record<string, unknown> } | undefined)?.labels;
          if (labels) for (const [k, v] of Object.entries(labels)) put(`${id}.label.${k}`, v);
          break;
        }
      }
    }
  }
  return out;
}

/* --------------------------------------------------------- ambient motion */

/**
 * Continuous ambient motion (spec §6.2 micro-motion / atmosphere). Every branch
 * is a pure function of tScene → seekable & deterministic. Clouds drift and
 * wrap, trees sway, birds bob, the sun rises with scene progress.
 */
function applyAmbient(
  a: Ambient,
  pose: Pose,
  tScene: number,
  sceneDur: number,
  rect: Rect,
  canvas: { w: number; h: number },
  seed: number,
): Pose {
  const ph = (seed % 1000) / 1000; // stable phase per element
  switch (a.kind) {
    case 'drift': {
      const span = canvas.w + rect.w * 2;
      const off = (((tScene * a.speed + (a.phase ?? ph) * span) % span) + span) % span;
      const effLeft = off - rect.w; // -w .. canvas.w+w
      const dy = Math.sin(tScene * 0.4 + ph * 6.28) * rect.h * 0.04; // faint vertical drift
      return { ...pose, x: (pose.x ?? 0) + (effLeft - rect.x), y: (pose.y ?? 0) + dy };
    }
    case 'sway': {
      const amp = a.amp ?? 2.4;
      const speed = a.speed ?? 1.4;
      return { ...pose, rot: (pose.rot ?? 0) + Math.sin(tScene * speed + ph * 6.28) * amp };
    }
    case 'bob': {
      const amp = a.amp ?? 12;
      const speed = a.speed ?? 1.8;
      return {
        ...pose,
        y: (pose.y ?? 0) + Math.sin(tScene * speed + ph * 6.28) * amp,
        x: (pose.x ?? 0) + Math.cos(tScene * speed * 0.6 + ph * 6.28) * amp * 0.5,
      };
    }
    case 'rise': {
      const u = Math.min(1, tScene / Math.max(0.5, sceneDur * 0.55));
      const e = easeOutCubic(u);
      return {
        ...pose,
        y: (pose.y ?? 0) + (1 - e) * canvas.h * 0.17,
        x: (pose.x ?? 0) + (1 - e) * -canvas.w * 0.04,
      };
    }
    default:
      return pose;
  }
}

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}

/** Point on a rect's edge, from its center toward (tx,ty) — so a connector line
 *  touches the box border, not its center. */
function edgePoint(rect: Rect, tx: number, ty: number): { x: number; y: number } {
  const cx = rect.x + rect.w / 2,
    cy = rect.y + rect.h / 2;
  const dx = tx - cx,
    dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const s = Math.min(
    dx !== 0 ? rect.w / 2 / Math.abs(dx) : Infinity,
    dy !== 0 ? rect.h / 2 / Math.abs(dy) : Infinity,
  );
  return { x: cx + dx * s, y: cy + dy * s };
}
function connectorEnds(a: Rect, b: Rect): { x1: number; y1: number; x2: number; y2: number } {
  const p1 = edgePoint(a, b.x + b.w / 2, b.y + b.h / 2);
  const p2 = edgePoint(b, a.x + a.w / 2, a.y + a.h / 2);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/** Active caption = the latest cue whose mark time ≤ tScene (spec §5). */
function activeCaption(slot: SceneSlot, tScene: number): string | null {
  if (slot.captions.length === 0) return null;
  const markOf = new Map(slot.marks.map((m) => [m.cue, m.t] as const));
  let best: { t: number; text: string } | null = null;
  for (const cap of slot.captions) {
    const mt = markOf.get(cap.cue);
    if (mt === undefined) continue;
    if (mt <= tScene + 1e-3 && (best === null || mt >= best.t)) best = { t: mt, text: cap.text };
  }
  // before the first cue, show nothing (clean open) unless single _all caption
  if (!best && slot.captions.length === 1 && slot.captions[0]!.cue === '_all')
    return slot.captions[0]!.text;
  return best?.text ?? null;
}
