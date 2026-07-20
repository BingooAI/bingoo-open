/**
 * schema.ts — `explainer/v2` document + LocaleBundle (spec §4).
 *
 * Zod is the single source of truth; TS types are inferred from it so the
 * runtime validator and the compile-time types can never drift. AI-generated
 * documents are validated against these schemas (spec §13, FR-G-04).
 */
import { z } from 'zod';

/* ----------------------------------------------------------------- primitives */

export const Direction = z.enum(['left', 'right', 'up', 'down']);
export type Direction = z.infer<typeof Direction>;

export const Aspect = z.enum(['16:9', '9:16']);
export type Aspect = z.infer<typeof Aspect>;

export const FaceExpr = z.enum(['neutral', 'happy', 'think', 'surprise']);
export type FaceExpr = z.infer<typeof FaceExpr>;

/** A discrete element state selected per-beat (spec §4 Pose). */
export const Pose = z.object({
  visible: z.boolean(),
  x: z.number().optional(),
  y: z.number().optional(),
  scale: z.number().optional(),
  opacity: z.number().optional(),
  rot: z.number().optional(), // degrees, pivot = bottom-center (for sway)
  emphasis: z.number().optional(), // 0..1
  drawProgress: z.number().optional(), // 0..1 for drawOn
  joints: z.record(z.string(), z.number()).optional(), // stick joint angles (deg)
  face: FaceExpr.optional(),
});
export type Pose = z.infer<typeof Pose>;

/* -------------------------------------------------------------------- style */

/**
 * Styles bind to design *tokens*, never raw hex/px (spec §4, editor FR-C-05).
 * `register` selects the doodle look (warm/clean) — resolved in theme/registers.
 */
export const StyleTokens = z.object({
  color: z.string().optional(), // token id, e.g. "ink", "accent"
  fill: z.string().optional(),
  weight: z.string().optional(), // token id, e.g. "sm"|"md"|"lg"
  font: z.string().optional(),
  fontSize: z.string().optional(), // token id, e.g. "body"|"title"
  register: z.string().optional(), // "warm" | "clean"
  align: z.string().optional(),
  opacity: z.number().optional(), // static element opacity 0..1 (multiplies animation opacity)
});
export type StyleTokens = z.infer<typeof StyleTokens>;

/* -------------------------------------------------------------- visual actions */

export const VisualAction = z.discriminatedUnion('verb', [
  z.object({ verb: z.literal('reveal'), target: z.string(), from: Direction.optional() }),
  z.object({ verb: z.literal('drawOn'), target: z.string() }),
  z.object({
    verb: z.literal('emphasize'),
    target: z.string(),
    style: z.enum([
      'pulse',
      'glow',
      'scaleUp',
      'shake',
      'spin',
      'flash',
      'tada',
      'wobble',
      'jello',
      'bounce',
    ]),
  }),
  z.object({ verb: z.literal('move'), target: z.string(), toPose: z.string() }),
  z.object({
    verb: z.literal('exit'),
    target: z.string(),
    to: z.union([Direction, z.literal('fade')]).optional(),
  }),
  z.object({ verb: z.literal('point'), target: z.string() }),
  z.object({ verb: z.literal('sfx'), sound: z.string() }),
  // diagram / flow
  z.object({
    verb: z.literal('revealNode'),
    diagram: z.string(),
    node: z.string(),
    from: Direction.optional(),
  }),
  z.object({ verb: z.literal('connect'), diagram: z.string(), edge: z.string() }),
  z.object({ verb: z.literal('highlightPath'), diagram: z.string(), path: z.array(z.string()) }),
  z.object({ verb: z.literal('walk'), diagram: z.string(), to: z.string() }),
  // slide "build": bring in ONE row of a list/table/chart at a time, bound to a
  // narration cue — the thing every deck tool has and a whiteboard engine lacks.
  z.object({ verb: z.literal('revealItem'), target: z.string(), index: z.number() }),
  z.object({ verb: z.literal('revealAll'), target: z.string(), stagger: z.number().optional() }),
]);
export type VisualAction = z.infer<typeof VisualAction>;

/* -------------------------------------------------------------------- diagram */

export const DiagramNode = z.object({
  id: z.string(),
  label: z.string(),
  shape: z.enum(['box', 'diamond', 'circle', 'pill']).optional(),
  group: z.string().optional(),
});
export type DiagramNode = z.infer<typeof DiagramNode>;

export const DiagramEdge = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  kind: z.enum(['arrow', 'line', 'dashed']).optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdge>;

export const Diagram = z.object({
  layoutKind: z.enum(['flow', 'tree', 'cycle', 'grid', 'timeline']),
  direction: z.enum(['auto', 'LR', 'TB']).optional(),
  nodes: z.array(DiagramNode),
  edges: z.array(DiagramEdge),
});
export type Diagram = z.infer<typeof Diagram>;

/* -------------------------------------------------------------------- element */

export const ElementType = z.enum([
  'stroke',
  'text',
  'image',
  'shape',
  'stick',
  'audio',
  'mesh3d',
  'diagram',
  'manipulative',
  'connector',
  // ── the "slide" layer: what a deck tool gives you and a whiteboard doesn't.
  // These are STRUCTURED content, not free text — the engine knows a list has
  // items and a chart has a series, so it can size them, reveal them one at a
  // time, and (for charts) DERIVE the geometry instead of trusting an author to
  // eyeball a bar height.
  'list',
  'table',
  'chart',
  'stat',
  'quote',
]);
export type ElementType = z.infer<typeof ElementType>;

/* ----------------------------------------------------------------- slide layer */

/**
 * A bulleted / numbered / checklist block. Item text is localizable: the bundle
 * key `${elementId}.${i}` wins over the inline string, so a list translates
 * without re-authoring, exactly like a text element.
 */
export const ListContent = z.object({
  style: z.enum(['bullet', 'number', 'check', 'dash', 'none']).default('bullet'),
  items: z.array(z.string()),
  /** tighten the type one rung when a list is dense (author's call, still on-scale) */
  dense: z.boolean().optional(),
});
export type ListContent = z.infer<typeof ListContent>;

export const TableContent = z.object({
  header: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())),
  align: z.array(z.enum(['left', 'center', 'right'])).optional(),
});
export type TableContent = z.infer<typeof TableContent>;

/**
 * A chart the ENGINE draws from data. Bar heights, pie angles and axis ticks are
 * COMPUTED, never authored — the same math-by-code rule that keeps a diagram
 * honest. An LLM cannot hand us a bar chart whose bars contradict its numbers.
 */
export const ChartContent = z.object({
  chart: z.enum(['bar', 'column', 'line', 'area', 'pie', 'donut']),
  series: z.array(z.object({ label: z.string(), value: z.number(), color: z.string().optional() })),
  unit: z.string().optional(),
  /** axis maximum; omitted → derived from the data */
  max: z.number().optional(),
  showValues: z.boolean().optional(),
});
export type ChartContent = z.infer<typeof ChartContent>;

/** A single big number (KPI). `value` is a STRING so "1/2", "≈3.14" work too. */
export const StatContent = z.object({
  value: z.string(),
  label: z.string().optional(),
  unit: z.string().optional(),
  color: z.string().optional(),
});
export type StatContent = z.infer<typeof StatContent>;

export const QuoteContent = z.object({
  text: z.string(),
  by: z.string().optional(),
});
export type QuoteContent = z.infer<typeof QuoteContent>;

/* --------------------------------------------------------------- manipulative */

/**
 * A verb invoked on a manipulative, bound to a narration cue (spec: math kit).
 * `at` names a cue mark ("@cue" or "cue"); `args` is verb-specific. Verbs/args
 * are validated by each kit, not here — the schema stays open so adding a kit
 * never requires a schema edit (authoring stays declarative, FR-G-04).
 */
export const ManipAction = z.object({
  verb: z.string(),
  at: z.string().optional(),
  args: z.unknown().optional(),
  /**
   * How long the verb takes, in seconds. Overrides the kit's own pacing.
   *
   * Why this exists: a kit's `setCount(6)` tweens 0→6 in 0.45s, which is right
   * for a snap but WRONG for counting. The teacher says "một, hai, ba, bốn, năm,
   * sáu" over five seconds and the six stars all appeared at once — the child
   * never saw them arrive one by one, which is the entire point of counting.
   * A verb had no way to be told "take as long as the sentence takes".
   *
   * Set `dur` to the length of the narration it accompanies, and the objects
   * arrive WITH the words.
   */
  dur: z.number().positive().optional(),
});
export type ManipAction = z.infer<typeof ManipAction>;

/**
 * Content for a "manipulative" element: which kit (`kind`), its params, and a
 * baked-at-compile action list. `params` is `unknown` — each kit normalises its
 * own shape.
 */
export const ManipulativeContent = z.object({
  kind: z.string(),
  params: z.unknown().optional(),
  actions: z.array(ManipAction).optional(),
});
export type ManipulativeContent = z.infer<typeof ManipulativeContent>;

/**
 * Semantic placement (spec §10, FR-C-11) — instead of per-aspect pixel rects,
 * an element declares WHERE it lives (sky/ground/air) and how big; the engine
 * computes the exact rect per aspect from a shared ground line, so a scene
 * composed from the kit is aligned automatically at 16:9 and 9:16.
 */
export const Place = z.object({
  at: z.enum(['sky', 'ground', 'air', 'free']),
  x: z.number(), // center x as fraction of canvas width (0..1)
  y: z.number().optional(), // center y fraction (sky/air/free)
  size: z.number(), // height as fraction of canvas height
  w: z.number().optional(), // explicit width fraction (text/diagram)
  rotate: z.number().optional(), // static rotation in degrees (editor direct-manip)
});
export type Place = z.infer<typeof Place>;

/** Continuous, deterministic ambient motion — a pure function of t (spec §6.2). */
export const Ambient = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('drift'), speed: z.number(), phase: z.number().optional() }), // clouds
  z.object({ kind: z.literal('sway'), amp: z.number().optional(), speed: z.number().optional() }), // trees/grass
  z.object({ kind: z.literal('bob'), amp: z.number().optional(), speed: z.number().optional() }), // birds/float
  z.object({ kind: z.literal('rise') }), // sun rises with scene progress
]);
export type Ambient = z.infer<typeof Ambient>;

export const Element = z.object({
  id: z.string(),
  type: ElementType,
  region: z.string().optional(),
  place: Place.optional(),
  ambient: Ambient.optional(),
  flow: z
    .object({
      order: z.number().optional(),
      grow: z.number().optional(),
      align: z.string().optional(),
    })
    .optional(),
  // type-specific; Diagram when type === "diagram". `.optional()` because some
  // elements (e.g. stick) carry no content — zod v4 makes a bare z.unknown() key
  // REQUIRED (v3 treated it as implicitly optional), so this keeps them valid.
  content: z.unknown().optional(),
  style: StyleTokens.optional(),
  z: z.number().optional(),
  /** discrete named poses selected by beats; "base" is the resting pose. */
  poses: z.record(z.string(), Pose).optional(),
  /** whether the element is on stage before any reveal (default false → hidden). */
  startVisible: z.boolean().optional(),
});
export type Element = z.infer<typeof Element>;

/* ------------------------------------------------------------------ beat/scene */

export const Beat = z.object({
  id: z.string(),
  cue: z.string(), // matches per-locale TTS mark
  actions: z.array(VisualAction),
  hold: z.number().optional(), // extra dwell (seconds) after actions settle
});
export type Beat = z.infer<typeof Beat>;

export const Rect = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type Rect = z.infer<typeof Rect>;

export const LayoutSpec = z.object({
  /**
   * A template is a TEACHING MOVE, not a shape. It fixes the slot geometry for
   * both aspects so nothing can overlap, drift off-frame, or collide with the
   * caption. Elements name their slot via `Element.region` — never coordinates.
   * (The first five are the legacy shapes, kept for back-compat.)
   */
  template: z.enum([
    'hero-caption',
    'split',
    'stack',
    'focus',
    'macro-micro',
    'teach', // giảng một ý: stage(hero) + callout + caption
    'practice', // hoạt động: activity chiếm trọn khung
    'compare', // so sánh: left/right cân bằng + nhãn
    'rule', // chốt quy tắc: card lớn + support nhỏ
    'sequence', // các bước: strip N thẻ tự chia
    'recap', // tổng kết: lưới
    'title-card', // mở bài: tiêu đề lớn + focal
    'flow', // sơ đồ quy trình (flowchart/cycle/tree/timeline)
    'swimlane', // BPMN: lane labels + lanes
    // ── slide layer: the shapes a deck tool (PowerPoint / Slides) gives you,
    //    expressed in the SAME grid, so a lesson can mix a bulleted slide and a
    //    manipulative stage without the eye noticing a seam.
    'bullets', // gạch đầu dòng (build từng dòng)
    'bullets-media', // gạch đầu dòng + ảnh
    'two-col', // hai cột bất kỳ
    'data', // biểu đồ + nhận xét
    'stats', // dải KPI, mọi ô cùng cỡ
    'quote', // trích dẫn lớn
    'table', // bảng
    'image-grid', // lưới ảnh
    'definition', // thuật ngữ / nghĩa / ví dụ
    'worked-example', // đề → các bước → đáp án
    'section', // vách ngăn chương
  ]),
  regions: z.record(z.string(), z.array(z.string())),
  overrides: z
    .object({
      '16:9': z.record(z.string(), Rect).optional(),
      '9:16': z.record(z.string(), Rect).optional(),
    })
    .partial()
    .optional(),
});
export type LayoutSpec = z.infer<typeof LayoutSpec>;

/** Tappable region for a hotspot gate; rect is normalized (0..1) of the stage. */
export const Hotspot = z.object({
  id: z.string(),
  label: z.string().optional(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type Hotspot = z.infer<typeof Hotspot>;

/**
 * A "manipulate" gate embeds a live manipulative the learner must set to a goal
 * (drag/tap/verb) — the interactive checkpoint inside a lesson. `target` is the
 * expected logical state; correctness is graded by code (manipulative/interactions
 * checkAnswer), never by a hardcoded pixel.
 */
export const ManipGate = z.object({
  kind: z.string(), // manipulative kind, e.g. "clock"
  params: z.unknown().optional(), // starting params
  target: z.unknown(), // goal state to check against
  aspect: Aspect.optional(),
});
export type ManipGate = z.infer<typeof ManipGate>;

/**
 * A generic interactive activity beat. Either embeds a `@bingoo/core` quiz
 * question (`quiz` — ANY of the ~40 shared question types: single/multiple/
 * fill/order/match/wordbank/categorize/highlight/numberline/clock/venn/tablefill/
 * fraction/money/… — rendered + graded by the shared quiz engine, so a new
 * question type added to core is available here with NO explainer change), or a
 * manipulative kit (`manip` — drive any of the kits, graded by checkAnswer). The
 * payload is `unknown` here so the schema never needs editing when the quiz
 * engine or kit registry grows; the player validates it against @bingoo/core.
 */
/**
 * What a learner DOES at a gate. Four shapes, and every one of them is graded by
 * CODE, not by a model's opinion:
 *   • quiz     — a @bingoo/core question (55 types), graded by gradeQuestion
 *   • manip    — any of the 67 kits, driven live, graded by checkAnswer
 *   • tracing  — write the letter/shape, graded by scoreTracedStroke
 *   • coloring — colour to a target, graded by coloringScore
 * Tracing and colouring existed in @bingoo/core and @bingoo/ui-web the whole
 * time; the gate simply never reached for them, so a lesson for a five-year-old
 * who cannot yet read could only ever offer them buttons to press.
 */
export const Activity = z.object({
  quiz: z.unknown().optional(), // a @bingoo/core QuizQuestion
  manip: z
    .object({ kind: z.string(), params: z.unknown().optional(), target: z.unknown().optional() })
    .optional(),
  tracing: z.unknown().optional(), // a @bingoo/core TracingGlyph
  coloring: z.unknown().optional(), // a @bingoo/core ColoringPicture
});
export type Activity = z.infer<typeof Activity>;

export const GateSpec = z.object({
  kind: z.enum([
    'predict-check',
    'sequence',
    'select',
    'hotspot',
    'input',
    'manipulate',
    'activity',
  ]),
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  hotspots: z.array(Hotspot).optional(), // hotspot gate
  answer: z.union([z.string(), z.array(z.string())]), // sequence → ordered array ("" for manipulate/activity)
  manip: ManipGate.optional(), // manipulate gate payload
  activity: Activity.optional(), // activity gate payload (ui-web component or manipulative, graded)
  feedback: z.object({ correct: z.string(), wrong: z.string() }).optional(),
  onPass: z.literal('resume'),
});
export type GateSpec = z.infer<typeof GateSpec>;

export const Transition = z.object({
  kind: z.enum(['cut', 'fade', 'push', 'morph']).optional(),
  duration: z.number().optional(),
});
export type Transition = z.infer<typeof Transition>;

/* ----------------------------------------------------------------- background */

/**
 * Scene backdrop. A lesson (or a single scene) sits ON something — a bare cream
 * void reads as "unfinished", and sprinkling a sun and a tree as loose elements
 * to fill it reads as random, because they carry no meaning. Scenery belongs in
 * the BACKGROUND layer, behind everything, where it is atmosphere and not
 * content.
 *
 * `src` / `srcPortrait` point at a framed backdrop from the media library. Such
 * art has a clear inner panel; `inset` declares that panel as canvas fractions,
 * and the layout engine confines EVERY slot to it — so content can never land on
 * the painted foliage. With no `src` the engine paints a built-in `kind`.
 */
export const Background = z.object({
  kind: z.enum(['paper', 'gradient', 'meadow', 'sky', 'grid', 'none']).default('paper'),
  /** gradient: token ids (or hex) + angle in degrees (0 = top→bottom) */
  from: z.string().optional(),
  to: z.string().optional(),
  angle: z.number().optional(),
  src: z.string().optional(), // landscape (16:9) art
  srcPortrait: z.string().optional(), // portrait (9:16) art
  /** the art's usable inner panel, as canvas fractions (x,y,w,h) */
  inset: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
  /** draw a card behind the content panel (false when the art already has one) */
  panel: z.boolean().optional(),
});
export type Background = z.infer<typeof Background>;

export const Scene = z.object({
  id: z.string(),
  kind: z.enum(['exposition', 'gate']),
  layout: LayoutSpec,
  elements: z.array(Element),
  beats: z.array(Beat).optional(), // exposition only
  narrationRef: z.string().optional(), // legacy: primary narration, treated as segment at t=0
  narrations: z.array(z.object({ ref: z.string(), at: z.number() })).optional(), // multiple voice lines per scene, each at its own time
  gate: GateSpec.optional(), // gate only
  transition: Transition.optional(),
  hold: z.number().optional(), // min scene length (s): hold visuals longer than content/audio
  /** per-scene backdrop; falls back to the doc's when absent */
  background: Background.optional(),
  /**
   * What JOB this scene does in the lesson. Declaring it is what lets the engine
   * check that a lesson actually TEACHES — that it explores before it explains,
   * lets a child handle the thing before it names the rule, and puts a guided
   * example between "watch me" and "your turn". See arc.ts.
   */
  phase: z
    .enum(['explore', 'orient', 'teach', 'formalize', 'guided', 'practice', 'recap', 'checkout'])
    .optional(),
});
export type Scene = z.infer<typeof Scene>;

/* ---------------------------------------------------------------------- theme */

export const ThemeTokens = z.object({
  colors: z.record(z.string(), z.string()),
  fontSizes: z.record(z.string(), z.number()),
  weights: z.record(z.string(), z.number()),
  fonts: z.record(z.string(), z.string()).optional(),
  register: z.string().default('warm'), // active style register
});
export type ThemeTokens = z.infer<typeof ThemeTokens>;

/* ------------------------------------------------------------------- document */

export const ExplainerDoc = z.object({
  version: z.literal('explainer/v2'),
  meta: z.object({
    id: z.string(),
    title: z.string(),
    topic: z.string().optional(),
    domain: z.string().optional(),
    tags: z.array(z.string()).optional(),
    defaultLocale: z.string(),
    /** How long the lesson should RUN. The scene count and the phase minimums
     *  are derived from this — a teacher has minutes, not scenes. */
    targetMinutes: z.number().min(3).max(45).optional(),
    /** Provenance from the LessonBrief that produced this doc (see engine/brief.ts):
     *  who it was written for and which objectives it teaches. Hosts (player,
     *  library, review tools) read these; generation stamps them. */
    audience: z.object({ stage: z.string(), grade: z.string().optional() }).optional(),
    objectives: z.array(z.object({ id: z.string(), statement: z.string() })).optional(),
  }),
  locales: z.array(z.string()),
  theme: ThemeTokens,
  scenes: z.array(Scene),
  /** lesson-wide backdrop; a scene may override it */
  background: Background.optional(),
  music: z.object({ src: z.string(), volume: z.number().optional() }).optional(), // looping background music
});
export type ExplainerDoc = z.infer<typeof ExplainerDoc>;

/* ------------------------------------------------------------- locale bundle */

export const Mark = z.object({ cue: z.string(), t: z.number() });
export type Mark = z.infer<typeof Mark>;

export const WordTiming = z.object({ word: z.string(), start: z.number(), end: z.number() });
export type WordTiming = z.infer<typeof WordTiming>;

export const Narration = z.object({
  script: z.string(), // keeps [[cue:...]] markers
  voice: z.string(),
  audioUrl: z.string().optional(), // TTS audio (data URL or path)
  marks: z.array(Mark), // per-locale timing (cue → t)
  words: z.array(WordTiming).optional(), // per-word timing (TTS) for caption + anchoring
});
export type Narration = z.infer<typeof Narration>;

export const LocaleBundle = z.object({
  locale: z.string(),
  strings: z.record(z.string(), z.string()), // elementId → translated text
  narration: z.record(z.string(), Narration), // narrationId → narration
  emphasis: z.record(z.string(), z.string()).optional(), // cue → token ref
});
export type LocaleBundle = z.infer<typeof LocaleBundle>;

/* ----------------------------------------------------------------- validators */

export function parseDoc(input: unknown): ExplainerDoc {
  return ExplainerDoc.parse(input);
}
export function parseBundle(input: unknown): LocaleBundle {
  return LocaleBundle.parse(input);
}

/** Type-narrowing helper for diagram element content. */
export function asDiagram(content: unknown): Diagram {
  return Diagram.parse(content);
}

/** Lenient parse for manipulative content — returns null instead of throwing so
 *  a malformed authored element is skipped rather than crashing the frame. */
export function asManipulative(content: unknown): ManipulativeContent | null {
  const r = ManipulativeContent.safeParse(content);
  return r.success ? r.data : null;
}
