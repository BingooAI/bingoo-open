// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * choreographer.ts — ⭐ THE core (spec §6). "Smooth like an editor made it" vs
 * "stiff demo" lives entirely here.
 *
 * The choreographer is a single, centralized "taste engine": authors/AI declare
 * only INTENT (reveal / emphasize / move / connect …) — never ms or easing.
 * It compiles those intents into deterministic per-element keyframe tracks using
 * house rules (§6.1), motion character (§6.2: anticipation, overshoot+settle,
 * stagger, micro-motion), all as a pure function of `t` (§2 hard law).
 *
 * Change the "feel" of the whole system by editing THIS file.
 */
import type { Scene, Element, Pose, Mark, Beat, Direction, VisualAction } from './schema'
import { type EasingName, ease } from '@bingoo.ai/manipulatives'
import { lerpPose, seededNoise } from './interpolate'
import { asManipulative } from './schema'
import { compileManip, getManipulative } from '@bingoo.ai/manipulatives'
import type { ManipState } from '@bingoo.ai/manipulatives'

/* --------------------------------------------------- house rules (spec §6.1) */

export const HOUSE = {
  REVEAL_DUR: 0.28, // entrance ease-out ~280ms
  HOLD_AFTER: 0.35, // dwell after a reveal before the next beat
  STAGGER: 0.06, // ~60ms between staggered items — never pop all at once
  DRAW_DUR: 0.8, // drawOn stroke self-draws
  EMPHASIS_DUR: 0.5, // pulse ~1.06 scale feel
  MOVE_DUR: 0.45, // transform between poses (spring)
  EXIT_DUR: 0.35,
  NODE_DUR: 0.35, // diagram node pop
  ITEM_STAGGER: 0.5, // gap between bullets in a "build" (deck-style appear)
  CONNECT_DUR: 0.5, // edge self-draws
  MICRO_AMP: 2.2, // idle breathing amplitude (logical units)
  MICRO_HZ: 0.32, // idle breathing frequency
} as const

/** Element types whose content is a LIST OF ROWS the build verbs can walk. */
const ITEM_TYPES = new Set<string>(['list', 'table', 'chart'])

/** How many rows an element has — the one place that knows each slide type's shape. */
function itemCountOf(el: Element): number {
  const c = (el.content ?? {}) as { items?: unknown[]; rows?: unknown[]; series?: unknown[] }
  if (el.type === 'list') return c.items?.length ?? 0
  if (el.type === 'table') return c.rows?.length ?? 0
  if (el.type === 'chart') return c.series?.length ?? 0
  return 0
}

const DIR_OFFSET: Record<Direction, { x: number; y: number }> = {
  left: { x: -140, y: 0 },
  right: { x: 140, y: 0 },
  up: { x: 0, y: -140 },
  down: { x: 0, y: 140 },
}

/**
 * Emphasis "grammar" (spec §6.2 motion character). Each style is a set of
 * keyframes on rot/scale/opacity/emphasis, evenly spaced over `dur`, that
 * settles back to rest — a shared vocabulary the editor exposes by friendly
 * name (Nhấn/Xoay/Rung/Ta-da…). All are deterministic functions of t.
 */
type EmphFrame = { rot?: number; x?: number; scale?: number; opacity?: number; emphasis?: number }
const EMPHASIS: Record<string, { dur: number; ease?: EasingName; frames: EmphFrame[] }> = {
  pulse: { dur: 0.5, frames: [{ emphasis: 0 }, { emphasis: 1 }, { emphasis: 0 }] },
  glow: { dur: 0.6, frames: [{ emphasis: 0 }, { emphasis: 1 }, { emphasis: 1 }, { emphasis: 0 }] },
  scaleUp: { dur: 0.5, ease: 'easeOutBack', frames: [{ scale: 1 }, { scale: 1.22 }, { scale: 1 }] },
  shake: {
    dur: 0.5,
    frames: [{ rot: 0 }, { rot: 10 }, { rot: -9 }, { rot: 6 }, { rot: -3 }, { rot: 0 }],
  },
  spin: { dur: 0.7, ease: 'easeInOutCubic', frames: [{ rot: 0 }, { rot: 360 }] },
  flash: {
    dur: 0.6,
    frames: [{ opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }],
  },
  tada: {
    dur: 0.75,
    frames: [
      { scale: 1, rot: 0 },
      { scale: 0.9, rot: -4 },
      { scale: 1.15, rot: 4 },
      { scale: 1.15, rot: -4 },
      { scale: 1, rot: 0 },
    ],
  },
  wobble: {
    dur: 0.6,
    frames: [
      { rot: 0, x: 0 },
      { rot: -9, x: -8 },
      { rot: 7, x: 6 },
      { rot: -5, x: -4 },
      { rot: 3, x: 2 },
      { rot: 0, x: 0 },
    ],
  },
  jello: {
    dur: 0.6,
    frames: [{ rot: 0 }, { rot: -7 }, { rot: 6 }, { rot: -4 }, { rot: 2 }, { rot: 0 }],
  },
  bounce: { dur: 0.7, ease: 'easeOutBounce', frames: [{ scale: 1 }, { scale: 1.2 }, { scale: 1 }] },
}

/* ------------------------------------------------------------------ tracks */

type Keyframe = { t: number; pose: Pose; ease: EasingName }
type ElementTrack = { keys: Keyframe[] }
type ScalarKey = { t: number; v: number; ease: EasingName }

export type SfxEvent = { t: number; sound: string }

/** Compiled, seekable timeline for one scene. Pure — depends only on t. */
export type SceneTimeline = {
  duration: number
  poseAt(elementId: string, t: number): Pose
  diagramAt(diagramId: string, t: number): DiagramRenderState
  /** Per-item reveal 0..1 for a list/table/chart — the slide "build". */
  itemsAt(elementId: string, t: number, count: number): number[]
  /** Compiled, seekable state for a manipulative element (null if none). */
  manipStateOf(elementId: string): ManipState<unknown> | null
  sfxEvents: SfxEvent[]
  overflowAtCompile?: string[]
}

export type DiagramRenderState = {
  nodeReveal: Map<string, number> // nodeId → 0..1
  edgeDraw: Map<string, number> // edgeId → 0..1
  highlight: Set<string> // active highlighted node/edge ids
  focus: string | null // camera walk target
}

/** A verb only gets paced to the voice when the sentence is long enough to be
 *  worth watching — below this it should just snap. */
const PACE_MIN = 1.2
/** Finish a little before the next line starts, so the motion settles. */
const PACE_FILL = 0.85
/** Last cue in a scene has no "next" — assume a line of this length. */
const PACE_FALLBACK = 3.5

const RESTING: Pose = { visible: true, x: 0, y: 0, scale: 1, opacity: 1, emphasis: 0 }

function mergePose(a: Pose, b?: Partial<Pose>): Pose {
  return { ...a, ...(b ?? {}) }
}

/** Beats sorted by their cue's timestamp in the current locale. */
function orderedBeats(beats: Beat[], markOf: Map<string, number>): Beat[] {
  return [...beats].sort((a, b) => (markOf.get(a.cue) ?? 0) - (markOf.get(b.cue) ?? 0))
}

/**
 * Compile a scene against a locale's marks into a seekable timeline.
 * `markOf` maps cue → absolute seconds (scene-local).
 */
export function compileScene(scene: Scene, marks: Mark[]): SceneTimeline {
  const markOf = new Map(marks.map((m) => [m.cue, m.t] as const))
  const beats = scene.beats ? orderedBeats(scene.beats, markOf) : []
  const byId = new Map(scene.elements.map((e) => [e.id, e] as const))

  // which elements are targeted by a reveal → start hidden
  const revealed = new Set<string>()
  for (const b of beats)
    for (const a of b.actions) if (a.verb === 'reveal' || a.verb === 'drawOn') revealed.add(a.target)

  const tracks = new Map<string, ElementTrack>()
  const cursor = new Map<string, Pose>() // running pose while compiling
  const nodeKeys = new Map<string, ScalarKey[]>() // `${diagram}:${node}`
  const edgeKeys = new Map<string, ScalarKey[]>() // `${diagram}:${edge}`
  const itemKeys = new Map<string, ScalarKey[]>() // `${element}:${index}` — list/table/chart rows
  const highlightEvents: { t: number; diagram: string; ids: string[] }[] = []
  const focusEvents: { t: number; diagram: string; node: string }[] = []
  const sfxEvents: SfxEvent[] = []

  // A diagram's nodes/edges are normally built up by `revealNode`/`connect`
  // beats. But `startVisible` must mean the same thing for a diagram as for any
  // other element — SHOWN — otherwise a scene that just presents a finished
  // flowchart renders as an empty frame (which is exactly what happened).
  for (const el of scene.elements) {
    if (el.type !== 'diagram' || !el.startVisible) continue
    const d = el.content as { nodes?: { id: string }[]; edges?: { id: string }[] } | undefined
    for (const n of d?.nodes ?? []) nodeKeys.set(`${el.id}:${n.id}`, [{ t: 0, v: 1, ease: 'linear' }])
    for (const e of d?.edges ?? []) edgeKeys.set(`${el.id}:${e.id}`, [{ t: 0, v: 1, ease: 'linear' }])
  }

  // A slide element with no `revealItem`/`revealAll` beat shows every row from
  // t=0 — same rule as any other element. Only a `startVisible: false` list
  // waits to be built in. Without this a bulleted slide renders EMPTY, which is
  // exactly the bug the diagram had.
  for (const el of scene.elements) {
    if (!ITEM_TYPES.has(el.type)) continue
    const built = (scene.beats ?? []).some((b) =>
      b.actions.some((a) => (a.verb === 'revealItem' || a.verb === 'revealAll') && a.target === el.id),
    )
    if (built) continue
    for (let i = 0; i < itemCountOf(el); i++) {
      itemKeys.set(`${el.id}:${i}`, [{ t: 0, v: 1, ease: 'linear' }])
    }
  }

  // initial poses
  for (const el of scene.elements) {
    if (el.type === 'audio') continue
    const base = mergePose(RESTING, el.poses?.base)
    const hidden = revealed.has(el.id)
    const init: Pose = hidden
      ? { ...base, visible: false, opacity: 0 }
      : {
          ...base,
          // undrawn strokes that are never drawn should still appear complete
          drawProgress: base.drawProgress,
        }
    cursor.set(el.id, init)
    tracks.set(el.id, { keys: [{ t: 0, pose: init, ease: 'linear' }] })
  }

  let lastActivity = 0
  const push = (id: string, k: Keyframe) => {
    tracks.get(id)!.keys.push(k)
    if (k.t > lastActivity) lastActivity = k.t
  }

  for (const beat of beats) {
    const cueT = markOf.get(beat.cue) ?? lastActivity
    let staggerIdx = 0
    for (const action of beat.actions) {
      const startT = cueT + staggerIdx * HOUSE.STAGGER
      compileAction(action, startT, {
        byId,
        cursor,
        push,
        nodeKeys,
        edgeKeys,
        itemKeys,
        highlightEvents,
        focusEvents,
        sfxEvents,
      })
      // only entrances get staggered (spec §6.1)
      if (action.verb === 'reveal' || action.verb === 'revealNode') staggerIdx++
    }
    if (beat.hold) lastActivity += beat.hold
  }

  // Manipulatives: bake each element's verb schedule ONCE (seek-exact clips).
  // A verb bound to a late cue must extend the scene, so fold its end into
  // lastActivity before the duration is finalised.
  // every cue time in this scene, ascending — a verb fills the gap to the next one
  const cueTimes = [...markOf.values()].sort((a, b) => a - b)
  const manipStates = new Map<string, ManipState<unknown>>()
  for (const el of scene.elements) {
    if (el.type !== 'manipulative') continue
    const content = asManipulative(el.content)
    if (!content) continue
    const m = getManipulative(content.kind)
    if (!m) continue
    // PACE THE VERB TO THE VOICE.
    //
    // A verb with no `dur` runs at the kit's own pace: setCount(6) snaps 0→6 in
    // 0.45s. That is right for a snap and wrong for COUNTING — the teacher says
    // "một, hai, ba, bốn, năm, sáu" over five seconds and all six stars land at
    // once, so the child never sees them arrive one by one, which is the whole
    // point. An author cannot be expected to hand-time this against a script
    // they also wrote.
    //
    // So a verb bound to a cue is stretched to fill the gap until the NEXT cue:
    // the objects arrive with the words. An explicit `dur` still wins.
    const paced = (content.actions ?? []).map((a) => {
      if (a.dur || !a.at) return a
      const cue = a.at.replace(/^@/, '')
      const at = markOf.get(cue)
      if (at === undefined) return a
      const next = cueTimes.find((t) => t > at + 0.01)
      const span = (next ?? at + PACE_FALLBACK) - at
      return span >= PACE_MIN ? { ...a, dur: span * PACE_FILL } : a
    })
    const state = compileManip(m, content.params, paced, (cue) => markOf.get(cue))
    manipStates.set(el.id, state as ManipState<unknown>)
    if (state.end > lastActivity) lastActivity = state.end
  }

  const maxMark = marks.reduce((m, x) => Math.max(m, x.t), 0)
  // A slide "build" writes ITEM keys, not pose keys — so without this a scene
  // whose only beat is `revealAll` ended BEFORE its own last bullet appeared,
  // and the build was silently cut off mid-way. Item keys are activity too.
  for (const arr of itemKeys.values()) for (const k of arr) if (k.t > lastActivity) lastActivity = k.t

  const duration = Math.max(lastActivity + HOUSE.HOLD_AFTER, maxMark + 0.5, 0.5)

  // sort scalar keys
  for (const m of [nodeKeys, edgeKeys, itemKeys]) for (const arr of m.values()) arr.sort((a, b) => a.t - b.t)
  highlightEvents.sort((a, b) => a.t - b.t)
  focusEvents.sort((a, b) => a.t - b.t)

  return {
    duration,
    sfxEvents,
    poseAt(elementId, t) {
      const track = tracks.get(elementId)
      if (!track) return { visible: false }
      const base = sampleTrack(track.keys, t)
      return applyMicroMotion(elementId, base, t)
    },
    diagramAt(diagramId, t) {
      return sampleDiagram(diagramId, t, nodeKeys, edgeKeys, highlightEvents, focusEvents)
    },
    itemsAt(elementId, t, count) {
      const out: number[] = []
      for (let i = 0; i < count; i++) {
        const keys = itemKeys.get(`${elementId}:${i}`)
        out.push(keys?.length ? sampleScalar(keys, t, 0) : 0)
      }
      return out
    },
    manipStateOf(elementId) {
      return manipStates.get(elementId) ?? null
    },
  }
}

/* ----------------------------------------------------------- action compiler */

type Ctx = {
  byId: Map<string, Element>
  cursor: Map<string, Pose>
  push: (id: string, k: Keyframe) => void
  nodeKeys: Map<string, ScalarKey[]>
  edgeKeys: Map<string, ScalarKey[]>
  itemKeys: Map<string, ScalarKey[]>
  highlightEvents: { t: number; diagram: string; ids: string[] }[]
  focusEvents: { t: number; diagram: string; node: string }[]
  sfxEvents: SfxEvent[]
}

function compileAction(action: VisualAction, startT: number, ctx: Ctx) {
  const { cursor, push, byId } = ctx
  switch (action.verb) {
    case 'reveal': {
      const cur = cursor.get(action.target)
      if (!cur) return
      const off = action.from ? DIR_OFFSET[action.from] : { x: 0, y: 0 }
      const target = mergePose(byId.get(action.target)?.poses?.base ?? RESTING, {
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
      })
      const pre: Pose = {
        ...target,
        visible: false,
        opacity: 0,
        x: (target.x ?? 0) + off.x,
        y: (target.y ?? 0) + off.y,
        scale: 0.92,
      }
      push(action.target, { t: startT, pose: pre, ease: 'linear' })
      push(action.target, { t: startT + HOUSE.REVEAL_DUR, pose: target, ease: 'easeOutBack' })
      cursor.set(action.target, target)
      break
    }
    case 'drawOn': {
      const cur = cursor.get(action.target)
      if (!cur) return
      const start = mergePose(cur, { visible: true, opacity: 1, drawProgress: 0 })
      const end = mergePose(cur, { visible: true, opacity: 1, drawProgress: 1 })
      push(action.target, { t: startT, pose: start, ease: 'linear' })
      push(action.target, { t: startT + HOUSE.DRAW_DUR, pose: end, ease: 'easeOutCubic' })
      cursor.set(action.target, end)
      break
    }
    case 'emphasize': {
      const cur = cursor.get(action.target)
      if (!cur) return
      const spec = EMPHASIS[action.style] ?? EMPHASIS.pulse!
      const n = spec.frames.length
      spec.frames.forEach((f, i) => {
        const dt = n === 1 ? 0 : (i / (n - 1)) * spec.dur
        const ov: Partial<Pose> = {}
        if (f.rot !== undefined) ov.rot = (cur.rot ?? 0) + f.rot
        if (f.x !== undefined) ov.x = (cur.x ?? 0) + f.x
        if (f.scale !== undefined) ov.scale = (cur.scale ?? 1) * f.scale
        if (f.opacity !== undefined) ov.opacity = f.opacity
        if (f.emphasis !== undefined) ov.emphasis = f.emphasis
        push(action.target, {
          t: startT + dt,
          pose: mergePose(cur, ov),
          ease: i === 0 ? 'linear' : (spec.ease ?? 'easeOutCubic'),
        })
      })
      cursor.set(action.target, cur) // settles back to rest
      break
    }
    case 'move': {
      const cur = cursor.get(action.target)
      if (!cur) return
      const el = byId.get(action.target)
      const target = mergePose(cur, el?.poses?.[action.toPose])
      push(action.target, { t: startT, pose: cur, ease: 'linear' })
      push(action.target, { t: startT + HOUSE.MOVE_DUR, pose: target, ease: 'spring' })
      cursor.set(action.target, target)
      break
    }
    case 'point': {
      // treat as a brief emphasis; for stick, authors move a joint via `move`.
      const cur = cursor.get(action.target)
      if (!cur) return
      const up = mergePose(cur, { emphasis: 0.8 })
      push(action.target, { t: startT, pose: cur, ease: 'linear' })
      push(action.target, { t: startT + 0.2, pose: up, ease: 'easeOutCubic' })
      push(action.target, { t: startT + 0.5, pose: cur, ease: 'easeInCubic' })
      break
    }
    case 'exit': {
      const cur = cursor.get(action.target)
      if (!cur) return
      const off = action.to && action.to !== 'fade' ? DIR_OFFSET[action.to] : { x: 0, y: 0 }
      const target: Pose = {
        ...cur,
        visible: false,
        opacity: 0,
        x: (cur.x ?? 0) + off.x,
        y: (cur.y ?? 0) + off.y,
      }
      push(action.target, { t: startT, pose: cur, ease: 'linear' })
      push(action.target, { t: startT + HOUSE.EXIT_DUR, pose: target, ease: 'easeInCubic' })
      cursor.set(action.target, target)
      break
    }
    case 'sfx': {
      ctx.sfxEvents.push({ t: startT, sound: action.sound })
      break
    }
    // ---- diagram verbs ----
    case 'revealNode': {
      const key = `${action.diagram}:${action.node}`
      const arr = ctx.nodeKeys.get(key) ?? []
      arr.push({ t: startT, v: 0, ease: 'linear' })
      arr.push({ t: startT + HOUSE.NODE_DUR, v: 1, ease: 'easeOutBack' })
      ctx.nodeKeys.set(key, arr)
      break
    }
    case 'connect': {
      const key = `${action.diagram}:${action.edge}`
      const arr = ctx.edgeKeys.get(key) ?? []
      arr.push({ t: startT, v: 0, ease: 'linear' })
      arr.push({ t: startT + HOUSE.CONNECT_DUR, v: 1, ease: 'easeOutCubic' })
      ctx.edgeKeys.set(key, arr)
      break
    }
    // ---- slide build verbs ----
    case 'revealItem': {
      const key = `${action.target}:${action.index}`
      const arr = ctx.itemKeys.get(key) ?? []
      arr.push({ t: startT, v: 0, ease: 'linear' })
      arr.push({ t: startT + HOUSE.NODE_DUR, v: 1, ease: 'easeOutCubic' })
      ctx.itemKeys.set(key, arr)
      break
    }
    case 'revealAll': {
      // one bullet after another, like a deck's "appear" build
      const el = ctx.byId.get(action.target)
      const n = el ? itemCountOf(el) : 0
      const step = action.stagger ?? HOUSE.ITEM_STAGGER
      for (let i = 0; i < n; i++) {
        const key = `${action.target}:${i}`
        const arr = ctx.itemKeys.get(key) ?? []
        arr.push({ t: startT + i * step, v: 0, ease: 'linear' })
        arr.push({ t: startT + i * step + HOUSE.NODE_DUR, v: 1, ease: 'easeOutCubic' })
        ctx.itemKeys.set(key, arr)
      }
      break
    }
    case 'highlightPath': {
      ctx.highlightEvents.push({ t: startT, diagram: action.diagram, ids: action.path })
      break
    }
    case 'walk': {
      ctx.focusEvents.push({ t: startT, diagram: action.diagram, node: action.to })
      break
    }
  }
}

/* ----------------------------------------------------------------- sampling */

function sampleTrack(keys: Keyframe[], t: number): Pose {
  if (keys.length === 0) return { visible: false }
  if (t <= keys[0]!.t) return keys[0]!.pose
  if (t >= keys[keys.length - 1]!.t) return keys[keys.length - 1]!.pose
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!
    const b = keys[i + 1]!
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t
      const p = span <= 0 ? 1 : (t - a.t) / span
      return lerpPose(a.pose, b.pose, p, b.ease)
    }
  }
  return keys[keys.length - 1]!.pose
}

/**
 * Idle micro-motion (spec §6.2): a faint "breathing" so a paused frame isn't
 * dead like a slide. Seeded by (element hash, t) → deterministic under scrub.
 * Only applied when the element is settled & visible, so it never fights an
 * active transition.
 */
function applyMicroMotion(id: string, pose: Pose, t: number): Pose {
  if (!pose.visible || (pose.opacity ?? 1) < 0.9) return pose
  // mid-transition poses carry non-resting emphasis/draw — skip those frames
  if ((pose.emphasis ?? 0) > 0.02) return pose
  const seed = hashString(id)
  const phase = t * HOUSE.MICRO_HZ * Math.PI * 2
  const driftY = Math.sin(phase) * HOUSE.MICRO_AMP
  const driftX = seededNoise(seed, t * 0.5) * (HOUSE.MICRO_AMP * 0.4)
  const breathe = 1 + Math.sin(phase * 0.5) * 0.004
  return {
    ...pose,
    x: (pose.x ?? 0) + driftX,
    y: (pose.y ?? 0) + driftY,
    scale: (pose.scale ?? 1) * breathe,
  }
}

function sampleScalar(keys: ScalarKey[] | undefined, t: number, dflt: number): number {
  if (!keys || keys.length === 0) return dflt
  if (t <= keys[0]!.t) return keys[0]!.v
  if (t >= keys[keys.length - 1]!.t) return keys[keys.length - 1]!.v
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!
    const b = keys[i + 1]!
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t
      const p = span <= 0 ? 1 : (t - a.t) / span
      // reuse pose lerp via a scalar shim
      const eased = easeScalar(b.ease, p)
      return a.v + (b.v - a.v) * eased
    }
  }
  return keys[keys.length - 1]!.v
}

function easeScalar(name: EasingName, p: number): number {
  return ease(name, p)
}

function sampleDiagram(
  diagramId: string,
  t: number,
  nodeKeys: Map<string, ScalarKey[]>,
  edgeKeys: Map<string, ScalarKey[]>,
  highlightEvents: { t: number; diagram: string; ids: string[] }[],
  focusEvents: { t: number; diagram: string; node: string }[],
): DiagramRenderState {
  const nodeReveal = new Map<string, number>()
  const edgeDraw = new Map<string, number>()
  const prefix = `${diagramId}:`
  for (const [k, arr] of nodeKeys)
    if (k.startsWith(prefix)) nodeReveal.set(k.slice(prefix.length), sampleScalar(arr, t, 0))
  for (const [k, arr] of edgeKeys)
    if (k.startsWith(prefix)) edgeDraw.set(k.slice(prefix.length), sampleScalar(arr, t, 0))

  let highlight = new Set<string>()
  for (const e of highlightEvents) if (e.diagram === diagramId && e.t <= t) highlight = new Set(e.ids)

  let focus: string | null = null
  for (const e of focusEvents) if (e.diagram === diagramId && e.t <= t) focus = e.node

  return { nodeReveal, edgeDraw, highlight, focus }
}

/* -------------------------------------------------------------------- utils */

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 100000
}
