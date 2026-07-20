/**
 * Weekly-schedule math — shared, pure TS (§R2). Lays out class periods / study
 * slots on a week grid identically on web and native. Times are minutes from
 * midnight; days are 0–6 (Monday = 0) so the UI localizes day names itself.
 */

import { clamp } from './utils';

export interface ScheduleSlot {
  id: string;
  /** Day column, 0–6 (Monday = 0 — UI supplies localized day labels). */
  day: number;
  /** Start, minutes from midnight (e.g. 8:30 → 510). */
  startMin: number;
  /** End, minutes from midnight. Must be > startMin. */
  endMin: number;
}

export interface PositionedSlot<T extends ScheduleSlot> {
  slot: T;
  /** 0–1 offset of the slot's top within the visible day range. */
  top: number;
  /** 0–1 height of the slot within the visible day range. */
  height: number;
}

/** Format minutes-from-midnight as "H:MM" (24h; locale-specific AM/PM is the app's job). */
export function formatSlotTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** The [min, max) minute range that covers every slot, padded to whole hours. */
export function scheduleRange(
  slots: ScheduleSlot[],
  fallback: [number, number] = [480, 1020],
): [number, number] {
  if (slots.length === 0) return fallback;
  let min = Infinity;
  let max = -Infinity;
  for (const s of slots) {
    min = Math.min(min, s.startMin);
    max = Math.max(max, s.endMin);
  }
  return [Math.floor(min / 60) * 60, Math.ceil(max / 60) * 60];
}

/** Group slots by day and position each within the visible range (0–1 coords). */
export function layoutWeek<T extends ScheduleSlot>(
  slots: T[],
  range?: [number, number],
): { range: [number, number]; days: PositionedSlot<T>[][] } {
  const [lo, hi] = range ?? scheduleRange(slots);
  const span = Math.max(1, hi - lo);
  const days: PositionedSlot<T>[][] = Array.from({ length: 7 }, () => []);
  for (const slot of slots) {
    const day = clamp(slot.day, 0, 6);
    const top = clamp((slot.startMin - lo) / span, 0, 1);
    const bottom = clamp((slot.endMin - lo) / span, 0, 1);
    days[day]!.push({ slot, top, height: Math.max(0.02, bottom - top) });
  }
  for (const col of days) col.sort((a, b) => a.slot.startMin - b.slot.startMin);
  return { range: [lo, hi], days };
}

/** Whole-hour tick marks (minutes) across a range, for grid lines / labels. */
export function hourTicks([lo, hi]: [number, number]): number[] {
  const ticks: number[] = [];
  for (let m = Math.ceil(lo / 60) * 60; m <= hi; m += 60) ticks.push(m);
  return ticks;
}
