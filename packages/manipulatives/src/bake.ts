/**
 * manipulative/bake.ts — keyframe *baking* + verb compilation (spec: math kit).
 *
 * Every verb becomes a BakedTrack: its animation channels are pre-sampled onto
 * a fixed grid at compile time (e.g. a spring pre-sampled to a table). Per-frame
 * we only interpolate the table — a pure lookup, no live physics — so seeking to
 * the same local-t is exact and the sampler is worklet-safe (no closures over
 * mutable state, plain-number data → serialisable to a Reanimated worklet).
 */
import { ease, type EasingName, clamp01 } from './easing'
import type { VerbClip, ManipState, ScheduledVerb, Manipulative } from './types'

/** One authored manipulative action on a scene beat. Structurally matches the
 *  explainer doc's `ManipAction` (a zod object there); kept local so this
 *  package stands alone. */
export type ManipAction = {
  verb: string
  at?: string
  args?: unknown
  /** Stretch the verb to take this many seconds — see the doc's ManipAction. */
  dur?: number
}

/** A channel table: values pre-sampled at `steps + 1` points over p ∈ [0,1]. */
export type BakedTrack = {
  duration: number
  steps: number
  channels: Record<string, number[]>
}

const STEPS = 64 // baking resolution — dense enough for springs/overshoot

/** Dwell held AFTER each verb settles before the next auto-sequenced verb (and
 *  after the last verb, extending the scene) so a learner can read each step.
 *  Explicit cue times override the start; this only affects spacing/end. */
export const MANIP_DWELL = 1.1

/**
 * Sample a baked channel at local time. FREE function (not a method) so an RN
 * worklet can call it on plain channel data. Linear-interpolates the table.
 */
export function sampleBaked(track: BakedTrack, name: string, localT: number, dflt = 0): number {
  const arr = track.channels[name]
  if (!arr || arr.length === 0) return dflt
  const p = track.duration <= 0 ? 1 : clamp01(localT / track.duration)
  const x = p * track.steps
  const i = Math.floor(x)
  if (i >= track.steps) return arr[track.steps]!
  const f = x - i
  return arr[i]! + (arr[i + 1]! - arr[i]!) * f
}

/** Bake named p→value functions into channel tables. */
export function bakeChannels(duration: number, defs: Record<string, (p: number) => number>): BakedTrack {
  const channels: Record<string, number[]> = {}
  for (const key of Object.keys(defs)) {
    const fn = defs[key]!
    const arr = new Array<number>(STEPS + 1)
    for (let i = 0; i <= STEPS; i++) arr[i] = fn(i / STEPS)
    channels[key] = arr
  }
  return { duration, steps: STEPS, channels }
}

/**
 * The common verb shape: a single eased master progress `p` (0→1) plus any extra
 * baked channels. Most manipulatives just read "p" and interpolate their own
 * geometry between `before` and `after`.
 */
export function tween<P>(
  before: P,
  after: P,
  duration: number,
  easing: EasingName = 'spring',
  extra?: Record<string, (p: number) => number>,
): VerbClip<P> {
  const track = bakeChannels(duration, {
    p: (u) => ease(easing, u),
    ...(extra ?? {}),
  })
  return { before, after, duration, track }
}

/* -------------------------------------------------------------- compilation */

/**
 * Compile authored params + actions into a seekable ManipState. Verbs fold in
 * declaration order (`after` of one is the `before` of the next), so the logical
 * math is deterministic and code-verifiable. Each verb's start time comes from
 * its cue mark (`at`), clamped to be monotonic so a mis-ordered cue can never
 * make a verb precede an earlier one.
 */
/**
 * Rescale a baked clip in time.
 *
 * The channels are sampled over p ∈ [0,1] and `duration` is what maps a local
 * time onto p — so stretching is exactly one number. The MOTION is untouched;
 * only its pace changes.
 */
function stretchClip<P>(clip: VerbClip<P>, seconds: number): VerbClip<P> {
  return { ...clip, duration: seconds, track: { ...clip.track, duration: seconds } }
}

export function compileManip<P>(
  m: Manipulative<P>,
  rawParams: unknown,
  actions: ManipAction[],
  markOf: (cue: string) => number | undefined,
): ManipState<P> {
  const initial = m.normalize(rawParams)
  const schedule: ScheduledVerb<P>[] = []
  let cur = initial
  let cursorT = 0

  for (const action of actions) {
    const fn = m.verbs[action.verb]
    if (!fn) continue // unknown verb → ignored (kept resilient for AI authoring)
    const cue = action.at ? action.at.replace(/^@/, '') : undefined
    const at = cue !== undefined ? markOf(cue) : undefined
    const startT = Math.max(at ?? cursorT, cursorT)
    let clip = fn(cur, action.args ?? {})
    // An author (or an engine) may stretch a verb to fit the words it goes with.
    // Rescaling the clip's keyframe times keeps the motion identical and only
    // changes its PACE — which is what "count along with me" needs.
    if (action.dur && action.dur > 0) clip = stretchClip(clip, action.dur)
    schedule.push({ verb: action.verb, args: action.args ?? {}, startT, clip })
    cur = clip.after
    // next auto-sequenced verb waits until this one settles + a reading dwell
    cursorT = startT + clip.duration + MANIP_DWELL
  }

  // `end` includes a trailing dwell so the final state lingers before the scene
  // advances (end = last settle + dwell).
  return { initial, final: cur, schedule, end: cursorT }
}

/* -------------------------------------------------------------- sampling */

export type Segment<P> = {
  verb: string | null
  from: P
  to: P
  p: number // eased master progress of the active verb (0 if none)
  local: number // seconds into the active verb
  clip: VerbClip<P> | null
}

/**
 * The active segment at time `t`: the last verb whose start ≤ t. Before any
 * verb → the initial state. After a verb settles → its `after` at p=1. During a
 * verb → `before`→`after` at eased progress p. Pure & seek-exact.
 */
export function activeSegment<P>(state: ManipState<P>, t: number): Segment<P> {
  let seg: ScheduledVerb<P> | null = null
  for (const s of state.schedule) {
    if (s.startT <= t + 1e-6) seg = s
    else break // schedule is sorted+monotonic
  }
  if (!seg) {
    return { verb: null, from: state.initial, to: state.initial, p: 0, local: 0, clip: null }
  }
  const local = t - seg.startT
  if (local >= seg.clip.duration) {
    return {
      verb: seg.verb,
      from: seg.clip.before,
      to: seg.clip.after,
      p: 1,
      local,
      clip: seg.clip,
    }
  }
  const p = sampleBaked(seg.clip.track, 'p', local, 0)
  return { verb: seg.verb, from: seg.clip.before, to: seg.clip.after, p, local, clip: seg.clip }
}
