// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { cn } from './lib/cn'
import { POP, SHAKE } from './lib/interactive'

export interface FractionBarProps {
  /** Number of equal parts (denominator). */
  parts: number
  /** Controlled: indexes of the shaded parts. */
  shaded: number[]
  onChange: (shaded: number[]) => void
  shape?: 'bar' | 'circle'
  /** After checking. */
  reveal?: { correct: boolean; answer: number; parts: number }
  disabled?: boolean
  className?: string
}

function slicePath(i: number, n: number, r = 46) {
  const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
  const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
  const x0 = 50 + r * Math.cos(a0)
  const y0 = 50 + r * Math.sin(a0)
  const x1 = 50 + r * Math.cos(a1)
  const y1 = 50 + r * Math.sin(a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M50,50 L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`
}

/**
 * Shade a fraction of a whole — tap parts of a divided bar or pie to shade them.
 * Grading (shaded count === numerator) lives in `@bingoo.ai/core`. Tap-based →
 * works web + mobile. i18n-free.
 */
export function FractionBar({
  parts,
  shaded,
  onChange,
  shape = 'bar',
  reveal,
  disabled,
  className,
}: FractionBarProps) {
  const locked = !!reveal || disabled
  const on = new Set(shaded)
  const toggle = (i: number) => {
    if (locked) return
    const next = new Set(on)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    onChange([...next].sort((a, b) => a - b))
  }
  const fillClass = reveal ? (reveal.correct ? 'fill-success' : 'fill-danger') : 'fill-primary'
  const cellShaded = reveal ? (reveal.correct ? 'bg-success' : 'bg-danger') : 'bg-primary'

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {shape === 'circle' ? (
        <svg viewBox="0 0 100 100" className="w-40 max-w-full" role="group">
          {Array.from({ length: parts }, (_, i) => (
            <path
              key={i}
              d={slicePath(i, parts)}
              onClick={() => toggle(i)}
              className={cn(
                'cursor-pointer stroke-surface [stroke-width:1.5]',
                'motion-safe:transition-[r,fill,opacity] duration-2',
                on.has(i) ? fillClass : 'fill-surface-muted hover:fill-primary-soft',
                locked && 'cursor-default',
              )}
            />
          ))}
        </svg>
      ) : (
        // The bar is ONE whole cut into equal parts — gaps between the parts would turn it
        // into a row of beads and quietly destroy the very idea it exists to teach. So the
        // parts stay joined inside a single tube, and only the FILL reacts to a tap.
        <div className="flex h-16 w-full max-w-xs overflow-hidden rounded-2xl border-2 border-border-strong shadow-xs">
          {Array.from({ length: parts }, (_, i) => (
            <button
              key={i}
              type="button"
              disabled={locked}
              aria-pressed={on.has(i)}
              onClick={() => toggle(i)}
              className={cn(
                'flex-1 border-r border-border outline-none last:border-r-0',
                'transition-colors duration-2 ease-spring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                on.has(i) ? cellShaded : 'bg-surface hover:bg-primary-soft',
              )}
            />
          ))}
        </div>
      )}
      <span
        className={cn(
          'text-lg font-bold tabular-nums',
          reveal ? (reveal.correct ? 'text-success' : 'text-danger') : 'text-foreground',
          reveal?.correct === true && POP,
          reveal?.correct === false && SHAKE,
        )}
      >
        {on.size}/{parts}
        {reveal && !reveal.correct ? (
          <span className="ml-2 text-sm font-semibold text-success">
            → {reveal.answer}/{reveal.parts}
          </span>
        ) : null}
      </span>
    </div>
  )
}
