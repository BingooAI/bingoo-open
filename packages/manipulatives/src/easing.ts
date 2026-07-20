/**
 * easing.ts — the easing library + baked springs (spec §6.2, §6.4).
 *
 * These are the "soul" of the motion: linear easing is the #1 tell of a
 * machine-made demo (spec §6.2), so every transition uses a non-linear curve
 * with anticipation / overshoot where appropriate.
 *
 * HARD CONSTRAINT (spec §7.3): every function here is a *pure* self-contained
 * function of a normalized progress `p ∈ [0,1]` — no closures over outer state,
 * no allocation. This is what lets the identical math run as a Reanimated
 * worklet on the RN UI thread later. Keep it that way.
 */

export type EasingName =
  | 'linear'
  | 'easeOutCubic'
  | 'easeInCubic'
  | 'easeInOutCubic'
  | 'easeOutQuint'
  | 'easeOutBack' // overshoot + settle (entrances)
  | 'easeInBack'
  | 'easeInOutBack'
  | 'easeOutElastic' // springy overshoot (đàn hồi)
  | 'easeOutBounce' // bounce-in (rơi nảy)
  | 'spring' // baked spring, seek-exact
  | 'pulse'; // 0 → 1 → 0, for emphasis

export function linear(p: number): number {
  return p;
}

export function easeOutCubic(p: number): number {
  const u = 1 - p;
  return 1 - u * u * u;
}

export function easeInCubic(p: number): number {
  return p * p * p;
}

export function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function easeOutQuint(p: number): number {
  return 1 - Math.pow(1 - p, 5);
}

/** Overshoot-and-settle. The signature curve of a lively entrance. */
export function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = p - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/** Anticipation — dips slightly negative before launching. */
export function easeInBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * p * p * p - c1 * p * p;
}

export function easeInOutBack(p: number): number {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  return p < 0.5
    ? (Math.pow(2 * p, 2) * ((c2 + 1) * 2 * p - c2)) / 2
    : (Math.pow(2 * p - 2, 2) * ((c2 + 1) * (p * 2 - 2) + c2) + 2) / 2;
}

/** Springy overshoot that oscillates into place — "đàn hồi". */
export function easeOutElastic(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1;
}

/** Bounce-in as if dropped and settling — "rơi nảy". */
export function easeOutBounce(p: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (p < 1 / d1) return n1 * p * p;
  if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
  if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
  return n1 * (p -= 2.625 / d1) * p + 0.984375;
}

/**
 * Baked spring (spec §6.4): a *fixed* curve computed from a damping model,
 * NOT a live simulation — so seeking to the same `p` always yields the same
 * value. Under-damped, so it overshoots ~1.0 then settles, giving natural feel.
 */
export function spring(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  // damped cosine: 1 - e^{-a p} cos(b p)
  const a = 6.0; // damping
  const b = 8.5; // angular frequency
  return 1 - Math.exp(-a * p) * Math.cos(b * p);
}

/** Emphasis pulse: rises to 1 at the midpoint, returns to 0. */
export function pulse(p: number): number {
  return Math.sin(Math.PI * clamp01(p));
}

export function clamp01(p: number): number {
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

const TABLE: Record<EasingName, (p: number) => number> = {
  linear,
  easeOutCubic,
  easeInCubic,
  easeInOutCubic,
  easeOutQuint,
  easeOutBack,
  easeInBack,
  easeInOutBack,
  easeOutElastic,
  easeOutBounce,
  spring,
  pulse,
};

/** Resolve a named easing to its pure function. */
export function ease(name: EasingName, p: number): number {
  const fn = TABLE[name] ?? easeOutCubic;
  return fn(clamp01(p));
}
