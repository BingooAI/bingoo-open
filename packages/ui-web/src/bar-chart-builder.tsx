'use client'

import type { QuizItem } from '@bingoo/core'
import { useQuizText } from './quiz-locale'
import { cn } from './lib/cn'
import { POP, SHAKE, stagger, tile } from './lib/interactive'

export interface BarChartBuilderProps {
  categories: QuizItem[]
  maxValue: number
  unitLabel?: string
  /** Controlled: catId → bar height. */
  heights: Record<string, number>
  onChange: (heights: Record<string, number>) => void
  reveal?: { cells: Record<string, boolean>; answer: Record<string, number> }
  disabled?: boolean
  className?: string
}

/**
 * Build a bar chart — tap a level in each column to set that bar's height (tap the
 * top again to lower it). Grading (heights === answer) in `@bingoo/core`. Tap-based
 * → web + mobile. i18n-free.
 */
export function BarChartBuilder({
  categories,
  maxValue,
  unitLabel,
  heights,
  onChange,
  reveal,
  disabled,
  className,
}: BarChartBuilderProps) {
  const locked = !!reveal || disabled
  const levels = Array.from({ length: maxValue }, (_, i) => maxValue - i) // top → bottom

  const t = useQuizText()
  const setHeight = (id: string, level: number) => {
    if (locked) return
    const cur = heights[id] ?? 0
    onChange({ ...heights, [id]: cur === level ? level - 1 : level })
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-end justify-around gap-2">
        {/* Y axis unit */}
        {unitLabel ? (
          <span className="self-start text-2xs font-semibold uppercase text-foreground-subtle">
            {unitLabel}
          </span>
        ) : null}
        {categories.map((c, i) => {
          const h = heights[c.id] ?? 0
          const ok = reveal?.cells[c.id]
          const barTone = reveal ? (ok ? 'bg-success' : 'bg-danger') : 'bg-primary'
          return (
            <div
              key={c.id}
              style={stagger(i)}
              className="flex flex-1 flex-col items-center gap-1 motion-safe:animate-fade-up"
            >
              <span className="text-sm font-bold tabular-nums text-foreground">{h}</span>
              {/* The column is the well; its stacked segments are the tap targets, so the
                  reveal feedback rides on the column rather than on every segment. */}
              <div
                className={cn(
                  tile({ state: 'quiet', size: 'none' }),
                  'flex w-full max-w-14 flex-col overflow-hidden rounded-lg',
                  reveal && (ok ? POP : SHAKE),
                )}
              >
                {levels.map((level) => {
                  const filled = level <= h
                  return (
                    <button
                      key={level}
                      type="button"
                      disabled={locked}
                      aria-label={`${t(c.label)}: ${level}`}
                      onClick={() => setHeight(c.id, level)}
                      className={cn(
                        'h-5 border-border outline-none duration-2 ease-spring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-safe:transition-colors [&:not(:last-child)]:border-b',
                        filled ? barTone : 'bg-surface hover:bg-primary-soft',
                      )}
                    />
                  )
                })}
              </div>
              <span className="flex items-center gap-0.5 text-center text-xs font-semibold text-foreground-muted">
                {c.emoji ? <span aria-hidden>{c.emoji}</span> : null}
                {t(c.label)}
              </span>
              {reveal && !ok ? (
                <span className="text-2xs font-semibold text-success">→ {reveal.answer[c.id]}</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
