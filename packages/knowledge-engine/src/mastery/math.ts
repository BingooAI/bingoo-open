/** Nguyên hàm số học thuần dùng chung cho lõi mastery. */

export const DAY_MS = 86_400_000;
export const LN2 = Math.LN2;

/** SPEC §3.1 — kẹp về [0,1]. */
export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Kẹp về [lo,hi] (SPEC §4.1 dùng cho scale độ khó). */
export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** SPEC §4.1 — co tín hiệu về `neutral` khi ít dữ liệu. */
export function shrink(raw: number, n: number, shrinkK: number, neutral: number): number {
  return (n * raw + shrinkK * neutral) / (n + shrinkK);
}

/** Trung bình; mảng rỗng → 0. */
export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}
