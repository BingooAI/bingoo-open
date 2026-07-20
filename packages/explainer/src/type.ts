// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * type.ts — THE type scale. One rung → one size, for the whole lesson.
 *
 * This lives in the ENGINE, not the renderer, because two very different things
 * need the same answer and must never disagree:
 *   • the web renderer, deciding how big to draw a title;
 *   • the authoring contract, telling an LLM "this slot holds ~34 characters".
 * If those two ever drifted, generation would confidently produce text that
 * overflows its slot — the exact failure the whole slot system exists to make
 * impossible.
 */
import type { Aspect } from './schema'
import { CANVAS } from './layout'

/** Rung → share of the canvas unit. */
export const RUNG: Record<string, number> = {
  huge: 0.115,
  title: 0.072,
  body: 0.05,
  caption: 0.042,
  label: 0.04,
}
export const DEFAULT_RUNG = 'body'

/** Fitting may shrink a rung by at most this much. Past it the text is simply
 *  TOO LONG for the slot, and the honest fix is fewer words — which is why the
 *  character budget below is derived from the SHRUNK size, not the ideal one. */
export const MIN_SHRINK = 0.6

/** The type unit: the canvas's SHORT side — 900 at BOTH aspects, so one rung is
 *  one absolute size in portrait and landscape alike. */
export function typeUnit(canvas: { w: number; h: number }): number {
  return Math.min(canvas.w, canvas.h)
}

export function rungSize(rung: string | undefined, canvas: { w: number; h: number }): number {
  return (RUNG[rung ?? DEFAULT_RUNG] ?? RUNG[DEFAULT_RUNG]!) * typeUnit(canvas)
}

/** Average glyph advance as a share of the font size (Latin + Vietnamese). The
 *  renderer's wrapText uses the same constant, so the budget and the wrap agree. */
export const GLYPH_W = 0.52

/**
 * How many characters actually FIT in a rect at a given rung — computed, never
 * guessed. This is what turns "keep it short" (which an LLM ignores) into
 * "≤ 34 characters" (which it obeys, and which the validator can enforce).
 */
export function charBudget(
  rect: { w: number; h: number },
  rung: string | undefined,
  aspect: Aspect,
  /** how many lines the slot may use before it looks like a paragraph */
  maxLines = 3,
): number {
  const canvas = CANVAS[aspect]
  const ideal = rungSize(rung, canvas)
  const floor = ideal * MIN_SHRINK // budget at the SMALLEST legible size
  const perLine = Math.floor((rect.w * 0.94) / (floor * GLYPH_W))
  const linesThatFit = Math.floor((rect.h * 0.94) / (floor * 1.24))
  return Math.max(1, perLine * Math.min(maxLines, Math.max(1, linesThatFit)))
}
