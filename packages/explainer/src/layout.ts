/**
 * layout.ts — resolveLayout(scene, aspect) + region templates + graph layout.
 *
 * Core rule (spec §10): NEVER place elements by absolute pixels. Templates
 * define regions for BOTH aspects; elements flow within a region (flexbox-like)
 * and the container flips row↔column by aspect — this is *reflow, not scale*.
 *
 * resolveLayout runs headless, so it doubles as the overflow lint across every
 * aspect × locale (spec §10, editor §4.13).
 */
import type { Aspect, Scene, Rect, Diagram, Element } from './schema';
import { propMeta, STICK_META } from './props';

/** Logical canvas units. Renderers map these into the actual viewport. */
export const CANVAS: Record<Aspect, { w: number; h: number }> = {
  '16:9': { w: 1600, h: 900 },
  '9:16': { w: 900, h: 1600 },
};

const PAD = 20; // inner slot padding (logical units) — slots exist to be filled

/* ══════════════════════ composition system (slot templates) ══════════════════
 * Beauty is not taste — it is FEWER ALIGNMENT AXES. Every slot below is derived
 * from one grid, so an image's edge lands on the same axis as a title's edge and
 * a chip's edge. Authors (and the LLM) never write coordinates: an element names
 * its slot via `Element.region`, and the engine computes the rect for BOTH
 * aspects. Overlap, off-frame drift and caption collisions become impossible by
 * construction rather than lint warnings after the fact.
 */

/** Safe gutter inside the backdrop frame (fraction of the frame). */
const SAFE = 0.035;
/** Persistent chrome, as a fraction of the framed area. */
const HEADER_H: Record<Aspect, number> = { '16:9': 0.11, '9:16': 0.075 };
const CAPTION_H: Record<Aspect, number> = { '16:9': 0.15, '9:16': 0.1 };
/** After aspect-preserving fit, an object fills this much of its cell. Near 1:
 *  a slot exists to BE filled — a shape adrift in a big empty box is the single
 *  most common reason a generated scene looks amateur. */
export const FILL_RATIO = 0.94;
/** Slots whose content reads as a discrete object → the renderer draws a card
 *  behind it, so the scene has structure instead of things floating on cream. */
export const CARD_SLOTS = new Set([
  'stage',
  'card',
  'left',
  'right',
  'steps',
  'grid',
  'activity',
  'diagram',
  // slide slots
  'list',
  'media',
  'colA',
  'colB',
  'chart',
  'insight',
  'stats',
  'table',
  'problem',
  'example',
]);

/** The default usable panel when the backdrop declares no inset. */
const FULL_INSET = { x: 0, y: 0, w: 1, h: 1 };

/** Where the content card sits when a backdrop wants a panel but declares no
 *  inset. Without this the panel is FULL-BLEED and hides the very backdrop it
 *  is supposed to sit on — the card must float on the scenery, not replace it. */
export const DEFAULT_PANEL_INSET: Record<Aspect, { x: number; y: number; w: number; h: number }> = {
  '16:9': { x: 0.045, y: 0.055, w: 0.91, h: 0.85 },
  '9:16': { x: 0.045, y: 0.045, w: 0.91, h: 0.9 },
};

/**
 * The usable panel for a backdrop: its declared `inset`, else the default card
 * inset when it wants a panel, else the whole canvas. ONE function so the layout
 * engine and the renderer can never disagree about where the panel is.
 */
export function insetOf(
  bg:
    | {
        inset?: { x: number; y: number; w: number; h: number };
        src?: string;
        srcPortrait?: string;
        panel?: boolean;
        kind?: string;
      }
    | null
    | undefined,
  aspect: Aspect,
): { x: number; y: number; w: number; h: number } | undefined {
  if (!bg || bg.kind === 'none') return undefined;
  if (bg.inset) return bg.inset;
  const hasArt = !!(bg.src ?? bg.srcPortrait);
  const wantsPanel = bg.panel ?? !hasArt;
  return wantsPanel ? DEFAULT_PANEL_INSET[aspect] : undefined;
}

export type Chrome = {
  /** the backdrop's usable inner panel */
  frame: Rect;
  /** persistent lesson chrome (title + progress) */
  header: Rect;
  /** where every slot lives */
  content: Rect;
  /** reserved caption band — no element may enter it */
  caption: Rect;
};

/**
 * Split the canvas into frame → header / content / caption. EVERY slot is a
 * fraction of `content`, so declaring a backdrop with an `inset` (framed art
 * whose usable panel is only the middle 75%) automatically pulls the whole
 * composition inside the art — no template needs to know about it.
 */
export function chromeOf(
  aspect: Aspect,
  inset?: { x: number; y: number; w: number; h: number },
): Chrome {
  const { w: W, h: H } = CANVAS[aspect];
  const ins = inset ?? FULL_INSET;
  const fx = ins.x * W,
    fy = ins.y * H,
    fw = ins.w * W,
    fh = ins.h * H;
  const gx = fw * SAFE,
    gy = fh * SAFE;
  const frame: Rect = { x: fx + gx, y: fy + gy, w: fw - 2 * gx, h: fh - 2 * gy };

  const hh = frame.h * HEADER_H[aspect];
  const ch = frame.h * CAPTION_H[aspect];
  // The caption is an OVERLAY, not a reserved band. It used to be subtracted from
  // `content`, so a lesson lost a fixed strip of its layout to a subtitle that is
  // only visible when captions are on — wasted space, and worse when captions are
  // off. Content now fills the whole frame below the header; the caption floats
  // over the bottom of it (like a video subtitle) and its rect is only WHERE to
  // draw that overlay, never something the composition has to avoid.
  return {
    frame,
    header: { x: frame.x, y: frame.y, w: frame.w, h: hh },
    content: { x: frame.x, y: frame.y + hh, w: frame.w, h: frame.h - hh },
    caption: { x: frame.x, y: frame.y + frame.h - ch, w: frame.w, h: ch },
  };
}

type Frac = { x: number; y: number; w: number; h: number };
const F = (x: number, y: number, w: number, h: number): Frac => ({ x, y, w, h });

/**
 * Slot geometry per template — FRACTIONS OF THE CONTENT BOX (not the canvas).
 * One grid, so a picture's edge lands on the same axis as a title's edge.
 * There is deliberately no `decor` slot: loose scenery with no teaching job is
 * noise, and atmosphere is the background layer's work.
 */
function slotFracs(template: string, aspect: Aspect): Record<string, Frac> {
  const land = aspect === '16:9';

  switch (template) {
    case 'teach':
      return land
        ? {
            title: F(0, 0, 1, 0.15),
            stage: F(0, 0.19, 0.68, 0.81),
            callout: F(0.72, 0.32, 0.28, 0.34),
          }
        : {
            title: F(0, 0, 1, 0.1),
            stage: F(0, 0.13, 1, 0.65),
            callout: F(0.18, 0.82, 0.64, 0.16),
          };

    case 'practice':
      return land
        ? { prompt: F(0, 0, 1, 0.16), activity: F(0, 0.2, 1, 0.8) }
        : { prompt: F(0, 0, 1, 0.11), activity: F(0, 0.15, 1, 0.85) };

    case 'compare':
      return land
        ? {
            title: F(0, 0, 1, 0.14),
            left: F(0, 0.19, 0.47, 0.65),
            right: F(0.53, 0.19, 0.47, 0.65),
            leftLabel: F(0, 0.87, 0.47, 0.13),
            rightLabel: F(0.53, 0.87, 0.47, 0.13),
          }
        : {
            title: F(0, 0, 1, 0.09),
            left: F(0.08, 0.12, 0.84, 0.32),
            leftLabel: F(0, 0.45, 1, 0.07),
            right: F(0.08, 0.55, 0.84, 0.32),
            rightLabel: F(0, 0.88, 1, 0.07),
          };

    case 'rule':
      return land
        ? {
            title: F(0, 0, 1, 0.14),
            card: F(0, 0.19, 0.6, 0.81),
            support: F(0.65, 0.24, 0.35, 0.7),
          }
        : { title: F(0, 0, 1, 0.09), card: F(0, 0.12, 1, 0.44), support: F(0.18, 0.6, 0.64, 0.4) };

    case 'sequence':
      // `steps` is ONE slot; flowInto() divides it evenly by element count, so
      // three different KINDS of step still get identical cells → same size,
      // same baseline, evenly gapped.
      return land
        ? { title: F(0, 0, 1, 0.14), steps: F(0, 0.19, 1, 0.81) }
        : { title: F(0, 0, 1, 0.09), steps: F(0, 0.12, 1, 0.88) };

    case 'recap':
      return land
        ? { title: F(0, 0, 1, 0.14), grid: F(0, 0.19, 1, 0.81) }
        : { title: F(0, 0, 1, 0.09), grid: F(0, 0.12, 1, 0.88) };

    case 'title-card':
      return land
        ? { title: F(0.05, 0.06, 0.9, 0.26), focal: F(0.3, 0.38, 0.4, 0.6) }
        : { title: F(0.02, 0.08, 0.96, 0.2), focal: F(0.18, 0.34, 0.64, 0.56) };

    case 'flow':
      return land
        ? { title: F(0, 0, 1, 0.13), diagram: F(0, 0.17, 1, 0.83) }
        : { title: F(0, 0, 1, 0.08), diagram: F(0, 0.11, 1, 0.89) };

    /* ───────────────────────────── slide templates ─────────────────────────
     * The shapes a deck tool gives you, expressed in the SAME grid as the
     * teaching templates — so a lesson can mix a bulleted slide and a
     * manipulative stage without the eye noticing a seam.
     */
    case 'bullets':
      return land
        ? { title: F(0, 0, 1, 0.17), list: F(0, 0.22, 1, 0.78) }
        : { title: F(0, 0, 1, 0.11), list: F(0, 0.15, 1, 0.85) };

    case 'bullets-media':
      return land
        ? { title: F(0, 0, 1, 0.17), list: F(0, 0.22, 0.55, 0.78), media: F(0.6, 0.22, 0.4, 0.78) }
        : { title: F(0, 0, 1, 0.1), media: F(0.1, 0.13, 0.8, 0.34), list: F(0, 0.52, 1, 0.48) };

    case 'two-col':
      return land
        ? { title: F(0, 0, 1, 0.16), colA: F(0, 0.21, 0.47, 0.79), colB: F(0.53, 0.21, 0.47, 0.79) }
        : { title: F(0, 0, 1, 0.1), colA: F(0, 0.13, 1, 0.42), colB: F(0, 0.58, 1, 0.42) };

    case 'data':
      return land
        ? {
            title: F(0, 0, 1, 0.15),
            chart: F(0, 0.2, 0.66, 0.8),
            insight: F(0.71, 0.28, 0.29, 0.44),
          }
        : { title: F(0, 0, 1, 0.09), chart: F(0, 0.12, 1, 0.62), insight: F(0, 0.78, 1, 0.22) };

    case 'stats':
      // one slot; flowInto() divides it evenly → every KPI is the same size
      return land
        ? { title: F(0, 0, 1, 0.19), stats: F(0, 0.26, 1, 0.74) }
        : { title: F(0, 0, 1, 0.11), stats: F(0, 0.16, 1, 0.84) };

    case 'quote':
      return land
        ? { quote: F(0.04, 0.08, 0.92, 0.62), by: F(0.04, 0.76, 0.92, 0.16) }
        : { quote: F(0, 0.1, 1, 0.6), by: F(0, 0.75, 1, 0.12) };

    case 'table':
      return land
        ? { title: F(0, 0, 1, 0.16), table: F(0, 0.21, 1, 0.79) }
        : { title: F(0, 0, 1, 0.1), table: F(0, 0.14, 1, 0.86) };

    case 'image-grid':
      return land
        ? { title: F(0, 0, 1, 0.15), grid: F(0, 0.2, 1, 0.8) }
        : { title: F(0, 0, 1, 0.09), grid: F(0, 0.13, 1, 0.87) };

    case 'definition':
      return land
        ? { term: F(0, 0, 1, 0.22), meaning: F(0, 0.28, 1, 0.34), example: F(0, 0.66, 1, 0.34) }
        : { term: F(0, 0, 1, 0.15), meaning: F(0, 0.2, 1, 0.36), example: F(0, 0.6, 1, 0.4) };

    case 'worked-example':
      return land
        ? {
            title: F(0, 0, 1, 0.13),
            problem: F(0, 0.17, 1, 0.2),
            steps: F(0, 0.41, 1, 0.41),
            answer: F(0.28, 0.86, 0.44, 0.14),
          }
        : {
            title: F(0, 0, 1, 0.08),
            problem: F(0, 0.11, 1, 0.14),
            steps: F(0, 0.28, 1, 0.55),
            answer: F(0.1, 0.87, 0.8, 0.13),
          };

    case 'section':
      // a divider: the eye should land on ONE thing and then move on
      return land
        ? { kicker: F(0, 0.24, 1, 0.12), title: F(0, 0.38, 1, 0.34) }
        : { kicker: F(0, 0.3, 1, 0.08), title: F(0, 0.4, 1, 0.28) };

    case 'swimlane':
      return land
        ? {
            title: F(0, 0, 1, 0.13),
            laneLabels: F(0, 0.17, 0.14, 0.83),
            diagram: F(0.17, 0.17, 0.83, 0.83),
          }
        : { title: F(0, 0, 1, 0.08), laneLabels: F(0, 0.11, 1, 0.07), diagram: F(0, 0.2, 1, 0.8) };

    default:
      return {};
  }
}

/** Aspect-preserving contain-fit + centre + scale to FILL_RATIO of the slot. */
export function fitInto(slot: Rect, naturalAspect: number, fill = FILL_RATIO): Rect {
  if (!Number.isFinite(naturalAspect) || naturalAspect <= 0) return slot;
  const bw = slot.w * fill;
  const bh = slot.h * fill;
  let w = bw;
  let h = w / naturalAspect;
  if (h > bh) {
    h = bh;
    w = h * naturalAspect;
  }
  return { x: slot.x + (slot.w - w) / 2, y: slot.y + (slot.h - h) / 2, w, h };
}

/** Clamp a rect inside the safe area (the escape hatch can never leave frame). */
function clampSafe(r: Rect, aspect: Aspect): Rect {
  const { w: W, h: H } = CANVAS[aspect];
  const minX = W * SAFE,
    minY = H * SAFE;
  const maxX = W * (1 - SAFE),
    maxY = H * (1 - SAFE);
  const w = Math.min(r.w, maxX - minX);
  const h = Math.min(r.h, maxY - minY);
  return {
    w,
    h,
    x: Math.min(Math.max(r.x, minX), maxX - w),
    y: Math.min(Math.max(r.y, minY), maxY - h),
  };
}

/** Where the ground line sits, per aspect (fraction of canvas height). */
export const GROUND_FRAC: Record<Aspect, number> = { '16:9': 0.8, '9:16': 0.74 };

export function groundY(aspect: Aspect): number {
  return CANVAS[aspect].h * GROUND_FRAC[aspect];
}

type RegionMap = Record<string, Rect>;

/**
 * Resolve a semantically-placed element (spec §10 anchor model) into a rect.
 * Height comes from `size` (fraction of canvas H); width follows the prop's
 * natural aspect (or explicit `w`). Ground props stand ON the ground line; sky/
 * air/free props center at (x, y). Same declaration → aligned at both aspects.
 */
function placeElement(el: Element, aspect: Aspect): Rect | null {
  const p = el.place;
  if (!p) return null;
  const { w: W, h: H } = CANVAS[aspect];
  const shape = el.type === 'shape' ? (el.content as { shape?: string })?.shape : el.type;
  const meta = el.type === 'stick' ? STICK_META : propMeta(shape);

  const h = p.size * H;
  const w = p.w !== undefined ? p.w * W : h * meta.aspect;
  const cx = p.x * W;

  let y: number;
  if (p.at === 'ground') {
    // bottom sits on the ground line (center-anchored props straddle it)
    y = meta.anchor === 'bottom' ? groundY(aspect) - h : groundY(aspect) - h / 2;
  } else {
    const cy = (p.y ?? 0.3) * H;
    y = cy - h / 2;
  }
  return { x: cx - w / 2, y, w, h };
}

/**
 * Standard region geometry per template, per aspect. Scene.layout.regions maps
 * these named slots → element ids. Landscape and portrait get deliberately
 * different geometry so content reflows rather than squishes.
 */
function templateRegions(template: Scene['layout']['template'], aspect: Aspect): RegionMap {
  const { w, h } = CANVAS[aspect];
  const land = aspect === '16:9';

  switch (template) {
    case 'hero-caption': {
      // hero on top, caption band on the bottom
      const capH = land ? h * 0.22 : h * 0.16;
      return {
        hero: { x: 0, y: 0, w, h: h - capH },
        caption: { x: 0, y: h - capH, w, h: capH },
      };
    }
    case 'split': {
      // side-by-side in landscape, stacked in portrait
      if (land) {
        return {
          left: { x: 0, y: 0, w: w / 2, h },
          right: { x: w / 2, y: 0, w: w / 2, h },
        };
      }
      return {
        left: { x: 0, y: 0, w, h: h / 2 },
        right: { x: 0, y: h / 2, w, h: h / 2 },
      };
    }
    case 'stack': {
      // three vertical bands (top/mid/bottom)
      return {
        top: { x: 0, y: 0, w, h: h / 3 },
        mid: { x: 0, y: h / 3, w, h: h / 3 },
        bottom: { x: 0, y: (2 * h) / 3, w, h: h / 3 },
      };
    }
    case 'focus': {
      return { stage: { x: 0, y: 0, w, h } };
    }
    case 'macro-micro': {
      // large macro stage + smaller micro inset
      if (land) {
        return {
          macro: { x: 0, y: 0, w: w * 0.66, h },
          micro: { x: w * 0.66, y: 0, w: w * 0.34, h },
        };
      }
      return {
        macro: { x: 0, y: 0, w, h: h * 0.66 },
        micro: { x: 0, y: h * 0.66, w, h: h * 0.34 },
      };
    }
    default:
      return { stage: { x: 0, y: 0, w, h } };
  }
}

/** Flow element ids within a region rect (spec §10: order/grow/align). */
function flowInto(
  rect: Rect,
  elements: { id: string; grow?: number; order?: number }[],
  aspect: Aspect,
): RegionMap {
  const out: RegionMap = {};
  if (elements.length === 0) return out;

  const sorted = [...elements].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const inner: Rect = {
    x: rect.x + PAD,
    y: rect.y + PAD,
    w: Math.max(0, rect.w - 2 * PAD),
    h: Math.max(0, rect.h - 2 * PAD),
  };

  if (sorted.length === 1) {
    out[sorted[0]!.id] = inner;
    return out;
  }

  // Stack along the region's longer axis so items don't crush.
  const vertical = aspect === '9:16' ? true : inner.h >= inner.w;
  const totalGrow = sorted.reduce((s, e) => s + (e.grow ?? 1), 0) || 1;
  let cursor = vertical ? inner.y : inner.x;
  const gap = 16;
  const avail = (vertical ? inner.h : inner.w) - gap * (sorted.length - 1);

  for (const e of sorted) {
    const span = (avail * (e.grow ?? 1)) / totalGrow;
    out[e.id] = vertical
      ? { x: inner.x, y: cursor, w: inner.w, h: span }
      : { x: cursor, y: inner.y, w: span, h: inner.h };
    cursor += span + gap;
  }
  return out;
}

export type LayoutResult = {
  rects: Map<string, Rect>;
  /** the element's CELL before aspect-fit — what a card/backdrop is drawn on */
  cells: Map<string, Rect>;
  /** which slot each element landed in (renderer decides card vs bare) */
  slotOf: Map<string, string>;
  /** frame / header / content / caption bands for this aspect */
  chrome: Chrome;
  overflow: string[]; // element ids whose rect leaves the canvas (lint)
};

/** Natural width/height ratio of an element, or null when the renderer decides
 *  (images, manipulatives, text, diagrams contain-fit themselves). */
function naturalAspectOf(el: Element): number | null {
  if (el.type === 'stick') return STICK_META.aspect;
  if (el.type === 'shape') {
    const shape = (el.content as { shape?: string })?.shape;
    return propMeta(shape).aspect;
  }
  if (el.type === 'image') {
    // the media library gives natural pixel dims — use them so the picture fills
    // its slot at the right proportions instead of letterboxing into a speck.
    const c = el.content as { w?: number; h?: number } | undefined;
    if (c?.w && c?.h && c.h > 0) return c.w / c.h;
  }
  return null;
}

/** Resolve every element's rect for a scene at a given aspect.
 *
 * SLOTS WIN. An element names its slot with `Element.region`; the engine derives
 * the rect from the template's grid. Free `place{x,y}` is now only an ESCAPE
 * HATCH for the rare decorative prop — and it is clamped into the safe area, so
 * even then nothing can leave the frame. (Previously free placement OVERRODE the
 * template, which is why LLM-authored scenes drifted, overlapped and collided
 * with the caption: the template system was effectively dead.)
 */
export function resolveLayout(
  scene: Scene,
  aspect: Aspect,
  /** the backdrop's usable panel (from Scene/Doc `background.inset`) */
  inset?: { x: number; y: number; w: number; h: number },
): LayoutResult {
  const { w, h } = CANVAS[aspect];
  const rects = new Map<string, Rect>();
  const cells = new Map<string, Rect>();
  const slotOf = new Map<string, string>();
  const byId = new Map(scene.elements.map((e) => [e.id, e] as const));

  const chrome = chromeOf(aspect, inset ?? insetOf(scene.background, aspect));
  const C = chrome.content;

  // slot rects: teaching templates are fractions OF THE CONTENT BOX → declaring
  // a framed backdrop pulls the whole composition inside the art for free.
  const fracs = slotFracs(scene.layout.template, aspect);
  const regions: RegionMap = Object.keys(fracs).length
    ? Object.fromEntries(
        Object.entries(fracs).map(([k, f]) => [
          k,
          { x: C.x + f.x * C.w, y: C.y + f.y * C.h, w: f.w * C.w, h: f.h * C.h },
        ]),
      )
    : templateRegions(scene.layout.template, aspect);
  regions['caption'] ??= chrome.caption;

  // 1. group elements by the slot they name (Element.region)
  const bySlot = new Map<string, Element[]>();
  for (const el of scene.elements) {
    if (el.type === 'audio') continue; // no geometry
    if (!el.region) continue;
    const list = bySlot.get(el.region) ?? [];
    list.push(el);
    bySlot.set(el.region, list);
  }
  // legacy: scene.layout.regions maps slot → ids (still honoured)
  for (const [slot, ids] of Object.entries(scene.layout.regions ?? {})) {
    for (const id of ids) {
      const el = byId.get(id);
      if (!el || el.region) continue;
      const list = bySlot.get(slot) ?? [];
      list.push(el);
      bySlot.set(slot, list);
    }
  }

  // 2. flow each slot's elements into equal cells, then aspect-fit inside the cell
  for (const [slot, els] of bySlot.entries()) {
    const rect = regions[slot];
    if (!rect) continue; // element names a slot this template doesn't have
    const flowed = flowInto(
      rect,
      els.map((e) => ({ id: e.id, grow: e.flow?.grow, order: e.flow?.order })),
      aspect,
    );
    for (const [id, r] of Object.entries(flowed)) {
      const el = byId.get(id)!;
      const na = naturalAspectOf(el);
      cells.set(id, r);
      slotOf.set(id, slot);
      rects.set(id, na ? fitInto(r, na) : r);
    }
  }

  // 3. escape hatch — free `place` ONLY for elements with no slot, clamped safe
  for (const el of scene.elements) {
    if (el.type === 'audio' || rects.has(el.id)) continue;
    const r = placeElement(el, aspect);
    if (r) {
      const c = clampSafe(r, aspect);
      rects.set(el.id, c);
      cells.set(el.id, c);
    }
  }

  // 4. orphans (no slot, no place) → the stage slot, else the content box
  for (const el of scene.elements) {
    if (el.type === 'audio' || rects.has(el.id)) continue;
    const fallback = regions.stage ?? regions.activity ?? regions.diagram ?? C;
    const na = naturalAspectOf(el);
    cells.set(el.id, fallback);
    rects.set(el.id, na ? fitInto(fallback, na) : fallback);
  }

  // per-aspect nudge overrides
  const ov = scene.layout.overrides?.[aspect];
  if (ov)
    for (const [id, r] of Object.entries(ov)) {
      rects.set(id, r);
      cells.set(id, r);
    }

  // overflow lint
  const overflow: string[] = [];
  for (const [id, r] of rects.entries()) {
    if (r.x < -1 || r.y < -1 || r.x + r.w > w + 1 || r.y + r.h > h + 1) {
      overflow.push(id);
    }
  }
  return { rects, cells, slotOf, chrome, overflow };
}

/* ------------------------------------------------------------- graph layout */

export type NodeBox = { id: string; x: number; y: number; w: number; h: number };
export type EdgePath = { id: string; from: string; to: string; points: { x: number; y: number }[] };
export type GraphLayout = { nodes: Map<string, NodeBox>; edges: EdgePath[] };

const NODE_W = 190;
const NODE_H = 90;

/**
 * Aspect-aware graph layout (spec §10.1). `direction: "auto"` → LR for 16:9,
 * TB for 9:16 (reflow). Positions are computed ONCE for the whole graph
 * (spec §10.2 stable-final-layout) so progressive reveal never shifts nodes.
 *
 * A compact layered layout — enough for flow/tree; cycle/timeline/grid handled
 * by their own placement. (dagre/elkjs is the production upgrade path.)
 */
export function graphLayout(diagram: Diagram, aspect: Aspect, rect: Rect): GraphLayout {
  const dir =
    diagram.direction === 'auto' || !diagram.direction
      ? aspect === '16:9'
        ? 'LR'
        : 'TB'
      : diagram.direction;

  const nodes = new Map<string, NodeBox>();
  const layoutKind = diagram.layoutKind;

  if (layoutKind === 'cycle') {
    placeCycle(diagram, rect, nodes);
  } else if (layoutKind === 'grid') {
    placeGrid(diagram, rect, nodes);
  } else {
    // flow / tree / timeline → layered along `dir`
    placeLayered(diagram, rect, dir, nodes);
  }

  const edges: EdgePath[] = diagram.edges.map((e) => {
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    const pts =
      a && b
        ? [
            { x: a.x + a.w / 2, y: a.y + a.h / 2 },
            { x: b.x + b.w / 2, y: b.y + b.h / 2 },
          ]
        : [];
    return { id: e.id, from: e.from, to: e.to, points: pts };
  });

  return { nodes, edges };
}

/** Assign each node a layer via longest-path from roots, then place by layer. */
function placeLayered(diagram: Diagram, rect: Rect, dir: 'LR' | 'TB', out: Map<string, NodeBox>) {
  const indeg = new Map<string, number>();
  diagram.nodes.forEach((n) => indeg.set(n.id, 0));
  diagram.edges.forEach((e) => indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1));

  const layer = new Map<string, number>();
  const adj = new Map<string, string[]>();
  diagram.edges.forEach((e) => {
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
  });
  // BFS layering from zero-indegree roots (fallback: first node)
  const roots = diagram.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const queue = roots.length ? [...roots] : diagram.nodes.slice(0, 1).map((n) => n.id);
  queue.forEach((id) => layer.set(id, 0));
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++]!;
    const l = layer.get(id) ?? 0;
    for (const nxt of adj.get(id) ?? []) {
      const cand = l + 1;
      if (cand > (layer.get(nxt) ?? -1)) {
        layer.set(nxt, cand);
        queue.push(nxt);
      }
    }
  }
  diagram.nodes.forEach((n) => {
    if (!layer.has(n.id)) layer.set(n.id, 0);
  });

  // group by layer
  const byLayer = new Map<number, string[]>();
  for (const n of diagram.nodes) {
    const l = layer.get(n.id)!;
    byLayer.set(l, [...(byLayer.get(l) ?? []), n.id]);
  }
  const layers = [...byLayer.keys()].sort((a, b) => a - b);
  const nLayers = layers.length;

  layers.forEach((l, li) => {
    const ids = byLayer.get(l)!;
    ids.forEach((id, idx) => {
      const acrossFrac = ids.length === 1 ? 0.5 : idx / (ids.length - 1);
      const alongFrac = nLayers === 1 ? 0.5 : li / (nLayers - 1);
      let cx: number, cy: number;
      if (dir === 'LR') {
        cx = rect.x + NODE_W / 2 + PAD + alongFrac * (rect.w - NODE_W - 2 * PAD);
        cy = rect.y + NODE_H / 2 + PAD + acrossFrac * (rect.h - NODE_H - 2 * PAD);
      } else {
        cx = rect.x + NODE_W / 2 + PAD + acrossFrac * (rect.w - NODE_W - 2 * PAD);
        cy = rect.y + NODE_H / 2 + PAD + alongFrac * (rect.h - NODE_H - 2 * PAD);
      }
      out.set(id, { id, x: cx - NODE_W / 2, y: cy - NODE_H / 2, w: NODE_W, h: NODE_H });
    });
  });
}

function placeCycle(diagram: Diagram, rect: Rect, out: Map<string, NodeBox>) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const r = Math.min(rect.w, rect.h) / 2 - NODE_H;
  const n = diagram.nodes.length;
  diagram.nodes.forEach((node, i) => {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(ang) * r - NODE_W / 2;
    const y = cy + Math.sin(ang) * r - NODE_H / 2;
    out.set(node.id, { id: node.id, x, y, w: NODE_W, h: NODE_H });
  });
}

function placeGrid(diagram: Diagram, rect: Rect, out: Map<string, NodeBox>) {
  const n = diagram.nodes.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  diagram.nodes.forEach((node, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const cellW = (rect.w - 2 * PAD) / cols;
    const cellH = (rect.h - 2 * PAD) / rows;
    const x = rect.x + PAD + c * cellW + cellW / 2 - NODE_W / 2;
    const y = rect.y + PAD + r * cellH + cellH / 2 - NODE_H / 2;
    out.set(node.id, { id: node.id, x, y, w: NODE_W, h: NODE_H });
  });
}
