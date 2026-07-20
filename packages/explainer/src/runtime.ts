/**
 * runtime.ts — compiles a doc+bundle into a seekable Program and exposes the
 * ExplainerRuntime contract (spec §3): { duration, seek(t) }.
 *
 * Scenes are laid end-to-end on a global timeline. Exposition scenes advance by
 * their compiled duration; gate scenes are pause points — the controller stops
 * advancing `t` there (spec §11) and GateHost takes over.
 *
 * The Program is built ONCE (memoized by the player) so per-frame work is just
 * cheap sampling. `frame()` reads a Program purely (no side effects, no rAF).
 */
import type { ExplainerDoc, LocaleBundle, Aspect, Scene, Narration, Mark } from './schema';
import { compileScene, type SceneTimeline } from './choreographer';
import { resolveLayout, insetOf, type LayoutResult, CANVAS } from './layout';

export type Caption = { cue: string; text: string };

/** One voice-over line in a scene, placed at `at` seconds (scene-local). */
export type NarrSeg = { ref: string; at: number; narration: Narration };

export type SceneSlot = {
  index: number;
  scene: Scene;
  timeline: SceneTimeline;
  layout: LayoutResult;
  narration?: Narration; // primary (first) segment, for back-compat
  narrations: NarrSeg[]; // all voice lines in this scene, sorted by `at`
  captions: Caption[];
  marks: Mark[]; // cue marks from all segments, offset into scene-local time
  start: number; // global t where scene begins
  end: number; // global t where scene ends
};

/** All narration segments of a scene (legacy narrationRef = a segment at t=0). */
export function resolveNarrations(scene: Scene, bundle: LocaleBundle): NarrSeg[] {
  const refs: { ref: string; at: number }[] = [];
  if (scene.narrationRef) refs.push({ ref: scene.narrationRef, at: 0 });
  for (const s of scene.narrations ?? []) if (!refs.some((x) => x.ref === s.ref)) refs.push(s);
  const out: NarrSeg[] = [];
  for (const s of refs) {
    const n = bundle.narration[s.ref];
    if (n) out.push({ ref: s.ref, at: s.at, narration: n });
  }
  return out.sort((a, b) => a.at - b.at);
}

export type Program = {
  doc: ExplainerDoc;
  bundle: LocaleBundle;
  aspect: Aspect;
  canvas: { w: number; h: number };
  slots: SceneSlot[];
  duration: number;
  gateStarts: number[]; // global t of each gate (advance stops here)
  overflow: { sceneId: string; ids: string[] }[]; // headless layout lint
};

/**
 * How long a gate occupies on the GLOBAL timeline.
 *
 * It used to be 1.0s. A gate is where the child stops and thinks — the one place
 * they spend real time — and it was rendered as a one-second sliver. Three gates
 * in a row therefore stacked into a single dot on the scrubber (their markers
 * landed 1s apart on a 265-second bar), and the timeline told the learner the
 * whole practice section was over in three seconds. `scene.hold` overrides it.
 */
const GATE_HOLD = 30; // seconds

/** Vietnamese narration, spoken: ~14 characters/second. */
const CHARS_PER_SEC = 14;

/** How long a narration line takes to SAY, estimated from the text.
 *
 * Before TTS has run there is no audio, so `audioEnd` was 0 and a scene's length
 * came only from its last keyframe. A twenty-second script whose last cue sits at
 * 15s therefore got a 16-second scene: every line was cut off mid-sentence, and
 * the lesson felt like it was racing. The words take as long as they take —
 * whether or not anyone has spoken them yet. */
function spokenSeconds(script: string): number {
  const clean = script.replace(/\[\[cue:[^\]]+\]\]/g, '').trim();
  return clean.length / CHARS_PER_SEC;
}

/** Parse `[[cue:id]] text …` narration into ordered caption segments (spec §5). */
export function parseCaptions(narration?: Narration): Caption[] {
  if (!narration) return [];
  const re = /\[\[cue:([^\]]+)\]\]/g;
  const out: Caption[] = [];
  let m: RegExpExecArray | null;
  const parts: { cue: string; start: number }[] = [];
  while ((m = re.exec(narration.script))) parts.push({ cue: m[1]!, start: m.index + m[0].length });
  for (let i = 0; i < parts.length; i++) {
    const end =
      i + 1 < parts.length
        ? narration.script.indexOf('[[cue:', parts[i]!.start)
        : narration.script.length;
    out.push({
      cue: parts[i]!.cue,
      text: narration.script.slice(parts[i]!.start, end === -1 ? undefined : end).trim(),
    });
  }
  // fallback: no cue markers → whole script as one caption
  if (out.length === 0 && narration.script.trim())
    out.push({ cue: '_all', text: narration.script.trim() });
  return out;
}

/** Override a manipulative's authored `params.labels` with the active bundle's
 *  translated versions (key `${id}.label.${k}`) BEFORE the kit state is compiled,
 *  so a kit renders "2 syllables" in an EN lesson, not "2 âm tiết". No-op when the
 *  bundle has no override (the source stays). Only clones scenes that need it. */
function localizeManipLabels(scene: Scene, bundle: LocaleBundle): Scene {
  if (!scene.elements.some((el) => el.type === 'manipulative')) return scene;
  let touched = false;
  const elements = scene.elements.map((el) => {
    if (el.type !== 'manipulative') return el;
    const params = (el.content as { params?: { labels?: Record<string, string> } } | undefined)
      ?.params;
    const labels = params?.labels;
    if (!labels) return el;
    const next: Record<string, string> = {};
    let changed = false;
    for (const [k, v] of Object.entries(labels)) {
      const t = bundle.strings[`${el.id}.label.${k}`];
      next[k] = t ?? v;
      if (t != null && t !== v) changed = true;
    }
    if (!changed) return el;
    touched = true;
    const content = el.content as Record<string, unknown>;
    return { ...el, content: { ...content, params: { ...params, labels: next } } };
  });
  return touched ? { ...scene, elements } : scene;
}

export function buildProgram(doc: ExplainerDoc, bundle: LocaleBundle, aspect: Aspect): Program {
  const slots: SceneSlot[] = [];
  const gateStarts: number[] = [];
  const overflow: { sceneId: string; ids: string[] }[] = [];
  let cursor = 0;

  doc.scenes.forEach((scene, index) => {
    const segs = resolveNarrations(scene, bundle);
    const narration = segs[0]?.narration;
    // merge every segment's cue marks into scene-local time (each offset by its
    // own start), so the choreographer still resolves cue→time across segments.
    const marks: Mark[] = segs.flatMap((s) =>
      (s.narration.marks ?? []).map((m) => ({ cue: m.cue, t: +(m.t + s.at).toFixed(3) })),
    );
    const timeline = compileScene(localizeManipLabels(scene, bundle), marks);
    const layout = resolveLayout(
      scene,
      aspect,
      insetOf(scene.background ?? doc.background, aspect),
    );
    if (layout.overflow.length) overflow.push({ sceneId: scene.id, ids: layout.overflow });

    // a voiced scene lasts at least until the LAST segment's last spoken word,
    // so every voice line plays fully and the visuals stay aligned to the voice.
    const audioEnd = segs.reduce((mx, s) => {
      const w = s.narration.words;
      return w?.length ? Math.max(mx, s.at + w[w.length - 1]!.end) : mx;
    }, 0);
    // With real audio, trust it. Without, ESTIMATE from the script — a scene must
    // last at least as long as its narration takes to say.
    const spoken = segs.reduce(
      (mx, s2) => Math.max(mx, s2.at + spokenSeconds(s2.narration.script)),
      0,
    );
    const dur =
      scene.kind === 'gate'
        ? (scene.hold ?? GATE_HOLD)
        : Math.max(timeline.duration, audioEnd + 0.3, spoken + 0.4, scene.hold ?? 0);
    const slot: SceneSlot = {
      index,
      scene,
      timeline,
      layout,
      narration,
      narrations: segs,
      captions: parseCaptions(narration),
      marks,
      start: cursor,
      end: cursor + dur,
    };
    if (scene.kind === 'gate') gateStarts.push(cursor);
    slots.push(slot);
    cursor += dur;
  });

  return {
    doc,
    bundle,
    aspect,
    canvas: CANVAS[aspect],
    slots,
    duration: cursor,
    gateStarts,
    overflow,
  };
}

/** Locate the scene slot active at global time `t`. */
export function sceneAt(program: Program, t: number): SceneSlot {
  const slots = program.slots;
  for (const s of slots) if (t >= s.start && t < s.end) return s;
  return slots[slots.length - 1] ?? throwEmpty();
}

function throwEmpty(): never {
  throw new Error('Program has no scenes');
}

/* ------------------------------------------------------- runtime controller */

/**
 * ExplainerRuntime (spec §3). `seek(t)` is the only motion primitive; "play" is
 * an external controller calling seek every rAF tick. The controller stops at
 * gate boundaries and reports them so the host can enter gate mode.
 */
export interface ExplainerRuntime {
  duration: number;
  seek(t: number): void;
}

export type PlayController = {
  play(): void;
  pause(): void;
  isPlaying(): boolean;
  seek(t: number): void;
  t(): number;
  dispose(): void;
};

/**
 * rAF-driven play controller (spec §3). Deterministic: it merely advances a
 * clock and calls the supplied `onSeek(t)`; the rendering is a pure function of
 * that t. Stops advancing when it reaches the next gate boundary and fires
 * `onReachGate`.
 */
export function createPlayController(opts: {
  duration: number;
  gateStarts: number[];
  onSeek: (t: number) => void;
  onReachGate: (t: number) => void;
  onEnd: () => void;
  now: () => number; // injectable clock (performance.now in browser)
  raf: (cb: () => void) => number;
  cancel: (id: number) => void;
  rate?: () => number; // playback speed multiplier (1 = realtime); read per tick
  clock?: () => number | null; // external master clock (e.g. audio time); null → use rAF delta
}): PlayController {
  let current = 0;
  let playing = false;
  let rafId = 0;
  let last = 0;
  // gate boundary just past `current` that we must stop at (once)
  const passedGates = new Set<number>();

  const nextGate = (from: number): number | null => {
    let best: number | null = null;
    for (const g of opts.gateStarts) {
      if (g > from + 1e-4 && !passedGates.has(g) && (best === null || g < best)) best = g;
    }
    return best;
  };

  const tick = () => {
    if (!playing) return;
    const t = opts.now();
    const rate = opts.rate ? Math.max(0, opts.rate()) : 1;
    const dt = ((t - last) / 1000) * rate;
    last = t;
    // when generated voice is playing it is the master clock, so the caption /
    // visuals track the audio EXACTLY (no rAF-vs-audio drift). Otherwise advance
    // by the wall-clock delta. `clock()` returns null when there's no audio.
    const ext = opts.clock ? opts.clock() : null;
    const next = ext != null ? Math.max(current, ext) : current + dt;

    const gate = nextGate(current);
    if (gate !== null && next >= gate) {
      current = gate;
      passedGates.add(gate);
      opts.onSeek(current);
      playing = false;
      opts.onReachGate(current);
      return;
    }
    if (next >= opts.duration) {
      current = opts.duration;
      opts.onSeek(current);
      playing = false;
      opts.onEnd();
      return;
    }
    current = next;
    opts.onSeek(current);
    rafId = opts.raf(tick);
  };

  return {
    play() {
      if (playing) return;
      playing = true;
      last = opts.now();
      rafId = opts.raf(tick);
    },
    pause() {
      playing = false;
      opts.cancel(rafId);
    },
    isPlaying: () => playing,
    seek(t: number) {
      current = Math.max(0, Math.min(opts.duration, t));
      // seeking backwards past a gate re-arms it
      for (const g of [...passedGates]) if (g > current) passedGates.delete(g);
      opts.onSeek(current);
    },
    t: () => current,
    dispose() {
      playing = false;
      opts.cancel(rafId);
    },
  };
}
