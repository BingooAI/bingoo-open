// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface SymmetryGridProps {
  rows: number
  cols: number
  axis: 'vertical' | 'horizontal' | 'diagonal'
  /** Given (pre-filled) cells "row-col" — the half to mirror. */
  filled: string[]
  /** Controlled: cells the learner has added. */
  userFilled: string[]
  onChange: (userFilled: string[]) => void
  reveal?: { mode?: 'mirror' | 'design'; correct?: boolean; expected: string[]; filled: string[] }
  disabled?: boolean
  className?: string
}

/**
 * Complete a symmetric figure — the given cells are shown; tap empty cells to
 * mirror them across the axis. Grading (mirror the givens) in `@bingoo.ai/core`.
 * Tap-based → web + mobile. i18n-free.
 */
export function SymmetryGrid({
  rows,
  cols,
  axis,
  filled,
  userFilled,
  onChange,
  reveal,
  disabled,
  className,
}: SymmetryGridProps) {
  const locked = !!reveal || disabled
  const given = new Set(filled)
  const user = new Set(userFilled)
  const expected = reveal ? new Set(reveal.expected) : null
  const design = reveal?.mode === 'design'
  const designOk = reveal?.correct === true
  // A big grid should just appear; only a small one is worth walking in cell by cell.
  const staggered = rows * cols <= 40

  const toggle = (key: string) => {
    if (locked || given.has(key)) return
    if (user.has(key)) onChange(userFilled.filter((k) => k !== key))
    else onChange([...userFilled, key])
  }

  return (
    <div className={cn('flex justify-center', className)}>
      <div className="relative">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const key = `${r}-${c}`
              const isGiven = given.has(key)
              const isUser = user.has(key)
              const ok = expected?.has(key)
              const missing = reveal && expected?.has(key) && !user.has(key)
              const state = isUser
                ? reveal
                  ? (design ? designOk : ok)
                    ? 'correct'
                    : 'wrong'
                  : 'selected'
                : missing && !design
                  ? 'ghost'
                  : 'idle'
              return (
                <button
                  key={key}
                  type="button"
                  disabled={locked || isGiven}
                  aria-label={key}
                  onClick={() => toggle(key)}
                  style={staggered ? stagger(r * cols + c) : undefined}
                  className={cn(
                    tile({ state: isGiven ? 'selected' : state, size: 'none' }),
                    'size-9 rounded-md',
                    // The given half is printed on the page — solid, not the learner's soft fill.
                    isGiven && 'bg-primary',
                    staggered && !reveal && 'motion-safe:animate-fade-up',
                  )}
                />
              )
            }),
          )}
        </div>
        {/* Axis of symmetry */}
        {axis === 'diagonal' ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 size-full"
            aria-hidden
          >
            <line
              x1={0}
              y1={0}
              x2={100}
              y2={100}
              className="stroke-accent-coral"
              strokeWidth={1}
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div
            className={cn(
              'pointer-events-none absolute bg-accent-coral',
              axis === 'vertical'
                ? 'inset-y-0 left-1/2 w-0.5 -translate-x-1/2'
                : 'inset-x-0 top-1/2 h-0.5 -translate-y-1/2',
            )}
          />
        )}
      </div>
    </div>
  )
}
