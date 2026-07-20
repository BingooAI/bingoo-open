'use client'

import { gridArea, gridPerimeter } from '@bingoo/core'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface GridShapeTarget {
  area?: number
  perimeter?: number
  cells?: string[]
}

export interface GridShapeBoardProps {
  rows: number
  cols: number
  /** Cells already shaded and locked. */
  given?: string[]
  /** Controlled: cells the learner has shaded. */
  cells: string[]
  onChange: (cells: string[]) => void
  target: GridShapeTarget
  unitLabel?: string
  /** Localized readout labels. */
  labels?: { area: string; perimeter: string }
  reveal?: { correct: boolean; area: number; perimeter: number; target: GridShapeTarget }
  disabled?: boolean
  className?: string
}

/**
 * Shade squares on a grid to build a shape with a given area / perimeter (Stage-3
 * area + perimeter work). Live readout of area + perimeter; grading (incl. the
 * one-connected-piece rule) lives in `@bingoo/core`. Tap-based → web + mobile.
 * i18n-free (readout labels are props).
 */
export function GridShapeBoard({
  rows,
  cols,
  given = [],
  cells,
  onChange,
  target,
  unitLabel,
  labels,
  reveal,
  disabled,
  className,
}: GridShapeBoardProps) {
  const locked = !!reveal || disabled
  const givenSet = new Set(given)
  const userSet = new Set(cells)
  const all = [...new Set([...given, ...cells])]
  const area = gridArea(all)
  const perimeter = gridPerimeter(all)
  const tone = reveal ? (reveal.correct ? 'text-success' : 'text-danger') : 'text-foreground'
  const fill = reveal ? (reveal.correct ? 'bg-success' : 'bg-danger') : 'bg-primary'
  // A big grid should simply BE there — only a small one is worth staggering in.
  const entrance = rows * cols <= 40

  const toggle = (key: string) => {
    if (locked || givenSet.has(key)) return
    if (userSet.has(key)) onChange(cells.filter((k) => k !== key))
    else onChange([...cells, key])
  }

  const unit = unitLabel ? ` ${unitLabel}` : ''

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const key = `${r}-${c}`
            const isGiven = givenSet.has(key)
            const on = isGiven || userSet.has(key)
            return (
              <button
                key={key}
                type="button"
                disabled={locked || isGiven}
                aria-label={key}
                aria-pressed={on}
                onClick={() => toggle(key)}
                className={cn(
                  tile({ state: isGiven ? 'quiet' : on ? 'selected' : 'idle', size: 'none' }),
                  // unit squares: hairline and square, never a fat rounded tile
                  'size-8 rounded-md border',
                  isGiven && 'bg-primary-soft',
                  !isGiven && on && fill,
                  entrance && 'motion-safe:animate-fade-up',
                )}
                style={entrance ? stagger(r * cols + c) : undefined}
              />
            )
          }),
        )}
      </div>

      {/* Live readout */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-bold tabular-nums">
        <span className={tone}>
          {labels?.area ?? 'Area'}: {area}
          {unit}
          {target.area !== undefined ? (
            <span className="ml-1 font-semibold text-foreground-muted">/ {target.area}</span>
          ) : null}
        </span>
        <span className={tone}>
          {labels?.perimeter ?? 'Perimeter'}: {perimeter}
          {unit}
          {target.perimeter !== undefined ? (
            <span className="ml-1 font-semibold text-foreground-muted">/ {target.perimeter}</span>
          ) : null}
        </span>
      </div>
    </div>
  )
}
