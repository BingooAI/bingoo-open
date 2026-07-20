// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { forwardRef, type HTMLAttributes } from 'react'

/**
 * The style packs that re-skin structure (radius, depth, motion) via tokens.
 * `junior` (mầm non) and `pro` (người đi làm) extend the age range: junior is the
 * roundest/bounciest, pro the tightest/quietest — the same components, re-skinned.
 */
export type StylePack = 'base' | 'playful' | 'calm' | 'toy3d' | 'junior' | 'pro'
/** The accent packs that re-hue the primary/ring family. Blue = default. */
export type AccentPack = 'blue' | 'teal' | 'sunbeam' | 'coral' | 'grape'

export interface PackScopeProps extends HTMLAttributes<HTMLDivElement> {
  /** Style pack (radius/depth/motion). `base` = no attribute. */
  pack?: StylePack
  /** Accent hue. `blue` = no attribute (brand default). */
  accent?: AccentPack
  /** Theme world id (§3B) — sets `data-theme-pack` for a themed subtree. */
  themePack?: string
}

/**
 * Scopes design-system packs to a subtree by stamping `data-pack` / `data-accent`
 * / `data-theme-pack`. Token overrides cascade to every descendant — no component
 * changes needed. Nestable (a zone can override an ancestor). Defaults emit no
 * attribute so the base/blue look is untouched.
 */
export const PackScope = forwardRef<HTMLDivElement, PackScopeProps>(function PackScope(
  { pack, accent, themePack, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-pack={pack && pack !== 'base' ? pack : undefined}
      data-accent={accent && accent !== 'blue' ? accent : undefined}
      data-theme-pack={themePack || undefined}
      {...props}
    />
  )
})
