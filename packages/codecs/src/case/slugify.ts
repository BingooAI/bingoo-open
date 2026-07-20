// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

/**
 * Turning a label into a slug segment.
 *
 * Slugs are **minted, never typed**, and this is where minting happens for imported frameworks.
 * Two rules govern it, and both exist because of what breaks otherwise.
 *
 * **Diacritics are stripped, `đ` becomes `d`.** A slug is an ASCII key; leaving Vietnamese
 * diacritics in one produces an identifier that behaves differently depending on how a system
 * normalises Unicode, and two systems disagreeing about whether `phép` equals `phép` is a class
 * of bug nobody should have to debug.
 *
 * **Length is capped at a word boundary.** A truncated slug that cuts mid-word reads as a typo
 * for the rest of its life, and slugs are immutable.
 *
 * Note this is only for *imported* labels. Concepts authored in the studio derive their slug
 * from the English title, which is a different rule and a different file — the point there is
 * that "Phép cộng trong phạm vi 20" and "Add within 20" must produce the *same* slug, or one
 * piece of knowledge becomes two nodes and a learner's evidence is split in half.
 */

const MAX_SEGMENT = 56

/** One segment: lowercase, ASCII, kebab-case. */
export function slugifySegment(input: string): string {
  const stripped = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (stripped.length === 0) return 'node'
  if (stripped.length <= MAX_SEGMENT) return stripped

  // Cut at a word boundary rather than mid-word — a slug is permanent, and one that ends
  // "…multiplic" reads as a mistake forever.
  const cut = stripped.slice(0, MAX_SEGMENT)
  const lastDash = cut.lastIndexOf('-')
  return lastDash > MAX_SEGMENT / 2 ? cut.slice(0, lastDash) : cut.replace(/-+$/, '')
}

/**
 * A dotted path: each `.`-separated part is slugified independently.
 *
 * Codes carry their own structure — `CCSS.MATH.CONTENT.1.OA.A.1` — and flattening the dots
 * would lose it. Keeping them makes the namespace legible to a person reading a URL.
 */
export function slugifyPath(input: string): string {
  const parts = input
    .split('.')
    .map((p) => slugifySegment(p))
    .filter((p) => p.length > 0)

  return parts.length > 0 ? parts.join('.') : 'node'
}
