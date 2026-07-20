// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * interpolate.ts — tween math + seeded noise (spec §7.2, §6.2).
 *
 * This is OUR math, the source of truth (spec §15) — anime.js/Reanimated are
 * only downstream optimizers. Everything here is worklet-safe: pure, no
 * closures, no allocation in the hot path.
 */
import { ease, type EasingName, clamp01 } from '@bingoo.ai/manipulatives'
import type { Pose } from './schema'

export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p
}

/** Normalize an absolute time `t` into progress within [start, start+dur]. */
export function progress(t: number, start: number, dur: number): number {
  if (dur <= 0) return t >= start ? 1 : 0
  return clamp01((t - start) / dur)
}

/**
 * Deterministic value noise (spec §2: any "randomness" must be seeded by t).
 * Same (seed, x) always returns the same value in [-1, 1]. Used for idle
 * micro-motion so a scrubbed frame is bit-identical to a played one.
 */
export function seededNoise(seed: number, x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f) // smoothstep
  const a = hash01(seed, i)
  const b = hash01(seed, i + 1)
  return lerp(a, b, u) * 2 - 1
}

function hash01(seed: number, n: number): number {
  let h = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
  h = h - Math.floor(h)
  return h
}

/** Field-wise interpolation between two poses at eased progress `p`. */
export function lerpPose(a: Pose, b: Pose, p: number, easing: EasingName): Pose {
  const e = ease(easing, p)
  const out: Pose = {
    // `visible` flips once we're meaningfully into the transition; this keeps
    // an element out of hit-testing until it has actually started appearing.
    visible: e >= 0.001 ? b.visible : a.visible,
    x: lerpOpt(a.x, b.x, e, 0),
    y: lerpOpt(a.y, b.y, e, 0),
    scale: lerpOpt(a.scale, b.scale, e, 1),
    opacity: lerpOpt(a.opacity, b.opacity, e, 1),
    rot: lerpOpt(a.rot, b.rot, e, 0),
    emphasis: lerpOpt(a.emphasis, b.emphasis, e, 0),
    drawProgress: lerpOpt(a.drawProgress, b.drawProgress, e, undefined),
    // discrete fields snap at the midpoint rather than blending nonsense
    face: e < 0.5 ? a.face : b.face,
  }
  if (a.joints || b.joints) {
    out.joints = lerpJoints(a.joints, b.joints, e)
  }
  return out
}

function lerpOpt(
  a: number | undefined,
  b: number | undefined,
  p: number,
  fallback: number | undefined,
): number | undefined {
  if (a === undefined && b === undefined) return fallback
  const av = a ?? b ?? (fallback as number)
  const bv = b ?? a ?? (fallback as number)
  return lerp(av, bv, p)
}

function lerpJoints(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
  p: number,
): Record<string, number> {
  const out: Record<string, number> = {}
  const keys = new Set<string>([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])
  for (const k of keys) {
    const av = a?.[k] ?? b?.[k] ?? 0
    const bv = b?.[k] ?? a?.[k] ?? 0
    out[k] = lerp(av, bv, p)
  }
  return out
}

/** Rects use the same eased lerp; layout reflow animates smoothly if needed. */
export function lerpNum(a: number, b: number, p: number, easing: EasingName): number {
  return lerp(a, b, ease(easing, p))
}
