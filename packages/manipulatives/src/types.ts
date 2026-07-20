/**
 * manipulative/types.ts — the shared Manipulative interface (spec: math kit).
 *
 * A Manipulative is a self-contained, PURE math visual: given its params + a
 * baked verb schedule, it emits platform-neutral drawing primitives at any time
 * `t`. It never touches the DOM, rAF, or wall-clock — every pixel is a function
 * of t, so a scrubbed frame is bit-identical to a played one (engine §2).
 *
 * Drawing is expressed as `Prim[]` (line/rect/circle/path/label) in the
 * element's LOCAL box [0..box.w × 0..box.h] — the SAME convention every other
 * element uses (elements/util.ts). Colours are design-token IDs (never hex), so
 * theme/register swaps restyle the whole kit for free. No SVG/web assumptions
 * live here → the future RN/Skia renderer consumes the identical Prim[].
 */
import type { BakedTrack } from './bake';

/**
 * The ONE escape hatch of this package — deliberately `any`, used at exactly two
 * dynamic boundaries and never inside a kit's own logic:
 *   1. the kind-keyed registries (`kind` → kit / interactions). Each kit has its
 *      OWN params type P; a registry keyed by string would need an existential
 *      type ("some P"), which TypeScript cannot express — `Manipulative<unknown>`
 *      is not a supertype (P is contravariant in `verbs`/`render`).
 *   2. a verb's authored `args`: free-form JSON from the content author, whose
 *      shape is known only to the verb receiving it. Every kit re-validates it
 *      through its own coercers (`num()`, `posArg()`…), so nothing is trusted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see the doc comment above: existential kit params + dynamic authored args
export type KitAny = any;

/** Canvas orientation. Structurally identical to the explainer doc's `Aspect`
 *  (defined there as a zod enum); kept local so this package has no dependency
 *  on the explainer engine — manipulatives are reusable on their own. */
export type Aspect = '16:9' | '9:16';

/* ----------------------------------------------------------------- primitives */

/** Stroke width: a theme weight-token id ("sm"|"md"|"lg") OR a raw logical px. */
export type Weight = string | number;

/** Platform-neutral drawing primitive. `k` is the discriminator. All geometry
 *  is in the element's local box; `color`/`fill` are token ids resolved by the
 *  renderer against the active theme. */
export type Prim =
  | {
      k: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color?: string;
      weight?: Weight;
      opacity?: number;
      dash?: number;
      cap?: 'round' | 'butt';
      z?: number;
    }
  | {
      k: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      color?: string;
      weight?: Weight;
      rx?: number;
      opacity?: number;
      z?: number;
    }
  | {
      k: 'circle';
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      color?: string;
      weight?: Weight;
      opacity?: number;
      z?: number;
    }
  | {
      k: 'path';
      d: string;
      fill?: string;
      color?: string;
      weight?: Weight;
      opacity?: number;
      closed?: boolean;
      dash?: number;
      z?: number;
    }
  | {
      k: 'label';
      x: number;
      y: number;
      text: string;
      color?: string;
      size?: number;
      align?: 'start' | 'middle' | 'end';
      baseline?: 'top' | 'middle' | 'bottom';
      opacity?: number;
      z?: number;
    }
  // media from a library: `src` = URL/data-URI (raster or SVG), or `asset` =
  // id in the built-in SVG registry (recolorable via `color`). Drawn into (x,y,w,h).
  | {
      k: 'image';
      x: number;
      y: number;
      w: number;
      h: number;
      src?: string;
      asset?: string;
      color?: string;
      opacity?: number;
      z?: number;
    };

/** What a manipulative's `render` returns: primitives in local box coords. */
export type ManipModel = { prims: Prim[]; view: { w: number; h: number } };

/** Context handed to `render` — the region box (aspect-aware, from layout) and
 *  the canvas aspect (for orientation choices like portrait stacking). */
export type RenderCtx = { aspect: Aspect; box: { w: number; h: number } };

/* ---------------------------------------------------------------- verb / state */

/**
 * A baked verb → seek-exact keyframes. `before`/`after` are the LOGICAL params
 * (used to chain verbs and to verify math by code); `track` holds the pre-baked
 * animation channels (at least "p", the eased master progress). Because the
 * curve is baked (not a live sim), seeking to the same local-t is exact.
 */
export type VerbClip<P> = {
  before: P;
  after: P;
  duration: number; // seconds
  track: BakedTrack;
};

/** One scheduled verb on the scene-local timeline. */
export type ScheduledVerb<P> = {
  verb: string;
  args: unknown;
  startT: number; // scene-local seconds
  clip: VerbClip<P>;
};

/**
 * Compiled, seekable state for one manipulative instance. Built ONCE at compile
 * (choreographer), sampled purely per frame. `schedule` is sorted by startT and
 * monotonic (a verb never precedes an earlier-declared one).
 */
export type ManipState<P> = {
  initial: P;
  final: P;
  schedule: ScheduledVerb<P>[];
  end: number; // scene-local t at which the last verb settles
};

/* ---------------------------------------------------------------- interface */

export interface Manipulative<P> {
  kind: string;
  defaultParams: P;
  /** Turn authored raw params into the fully-populated logical state P. Pure. */
  normalize(raw: unknown): P;
  /** Pure render at time `t` given the baked schedule. */
  render(params: P, state: ManipState<P>, t: number, ctx: RenderCtx): ManipModel;
  /** verb name → (currentLogicalParams, args) → baked clip. Deterministic. */
  verbs: Record<string, (params: P, args: KitAny) => VerbClip<P>>;
}

/* ------------------------------------------------------------- interactivity */

/** A verb exposed to the learner as a tappable control. */
export type ActionDesc = { verb: string; label: string; args?: unknown };

/** Result of a tap: either new params to snap to, or a verb to animate. */
export type TapResult<P> = { params?: P; verb?: string; args?: unknown } | null;

/**
 * Direct-manipulation descriptor for a kit (pure, no React). Used by the
 * interactive sandbox so a learner can DRIVE the manipulative — press verb
 * buttons, tap it, or drag a handle — instead of only watching it play. All
 * handlers are pure functions of (params, local-box point, ctx).
 */
/**
 * Hợp đồng ĐÁP ÁN của một kit — target mà `check()` mong đợi. ĐẶT CẠNH `check` để không drift: sửa
 * check thì thấy answer ngay đó. Dùng khi SINH item chấm được từ kit (nhà máy nội dung) — LLM bám
 * `shape` + `example` để tạo target hợp lệ, rồi validate lại bằng `checkAnswer`.
 */
export interface AnswerDoc {
  /** Mô tả target (khoá nào, nghĩa gì, miền giá trị) cho người/LLM đọc. */
  readonly shape: string;
  /** Một target HỢP LỆ mẫu (đúng thứ `check` đọc). */
  readonly example: Record<string, unknown>;
}

export interface Interactions<P> {
  hint?: string;
  /** verb controls shown as buttons; if omitted the host derives them. */
  actions?: ActionDesc[];
  /** discrete tap in the element's local box → snap-params or a verb to run. */
  onTap?(params: P, pt: { x: number; y: number }, ctx: RenderCtx): TapResult<P>;
  /** continuous drag in the local box → new params rendered live. */
  onDrag?(params: P, pt: { x: number; y: number }, ctx: RenderCtx): P | null;
  /** grade the learner's current params against a goal (interactive gate). */
  check?(params: P, target: Record<string, unknown>): boolean;
}
