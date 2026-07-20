/** Time-of-day bucket used to pick a localized greeting. */
export function greetingKey(date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/** Clamp a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Turn a 0–1 or 0–100 value into a clamped percentage (0–100). */
export function toPercent(value: number): number {
  const pct = value <= 1 ? value * 100 : value;
  return clamp(Math.round(pct), 0, 100);
}
