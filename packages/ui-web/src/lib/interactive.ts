// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { cva, type VariantProps } from 'class-variance-authority'

/**
 * The house feel for every tappable learning surface — one recipe so 60+ activity
 * components move, lift and light up the SAME way instead of each inventing its own.
 *
 * Motion comes from the design tokens (`ease-spring`, `animate-pop-in`, `animate-wiggle`,
 * `shadow-pop`), and every transform is behind `motion-safe:` so a learner who asks their
 * OS for reduced motion gets the colour feedback with none of the movement.
 *
 *   <button className={tile({ state: 'selected' })}>…
 *   <button className={tile({ state: revealed ? (ok ? 'correct' : 'wrong') : 'idle' })}>…
 */
export const tile = cva(
  [
    'relative rounded-2xl border-2 outline-none',
    'transition-[transform,box-shadow,border-color,background-color,color] duration-2 ease-spring',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:cursor-default disabled:opacity-60',
  ],
  {
    variants: {
      state: {
        idle: [
          'border-border bg-surface text-foreground shadow-xs',
          'hover:border-primary hover:shadow-md motion-safe:hover:-translate-y-0.5',
          'motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97] active:shadow-xs',
        ],
        selected: [
          'border-primary bg-primary-soft text-foreground shadow-pop',
          'motion-safe:active:scale-[0.97]',
        ],
        correct: ['border-success bg-success-soft text-success shadow-pop', 'motion-safe:animate-pop-in'],
        wrong: ['border-danger bg-danger-soft text-danger', 'motion-safe:animate-wiggle'],
        /** The answer the learner MISSED — shown dashed next to their wrong one. */
        ghost: 'border-dashed border-success bg-success-soft/40 text-success',
        /** A surface that is only along for the ride (a board, a slot, a well). */
        quiet: 'border-border bg-surface-muted text-foreground-muted shadow-none',
      },
      size: {
        sm: 'px-2.5 py-1.5 text-sm',
        md: 'px-3.5 py-2.5 text-base',
        lg: 'px-4 py-3 text-lg',
        /** No padding — the caller sizes it (tiles, cells, canvases). */
        none: '',
      },
    },
    defaultVariants: { state: 'idle', size: 'md' },
  },
)
export type TileProps = VariantProps<typeof tile>

/** Map a reveal to a tile state in one place, so every component agrees. */
export function tileState(opts: {
  selected?: boolean
  revealed?: boolean
  correct?: boolean
  /** The right answer the learner did not pick. */
  missed?: boolean
}): NonNullable<TileProps['state']> {
  if (opts.revealed) {
    if (opts.missed && !opts.selected) return 'ghost'
    if (!opts.selected) return 'idle'
    return opts.correct ? 'correct' : 'wrong'
  }
  return opts.selected ? 'selected' : 'idle'
}

/**
 * Stagger a list in on mount: `style={stagger(i)}` next to `motion-safe:animate-fade-up`.
 * Capped so a 40-cell grid does not take three seconds to appear.
 */
export function stagger(index: number, stepMs = 40, maxMs = 320): React.CSSProperties {
  return { animationDelay: `${Math.min(index * stepMs, maxMs)}ms` }
}

/** Entrance for a freshly-rendered question / panel. */
export const ENTER = 'motion-safe:animate-fade-up'
/** Entrance for a thing that should feel like it POPPED into place (a token, a stamp). */
export const POP = 'motion-safe:animate-pop-in'
/** Applied to the whole input when a checked answer turned out wrong. */
export const SHAKE = 'motion-safe:animate-wiggle'
