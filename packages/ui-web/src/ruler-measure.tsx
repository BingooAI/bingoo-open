'use client'

import { cn } from './lib/cn'
import { tile, tileState } from './lib/interactive'

export interface RulerMeasureProps {
  max: number
  /** Where the object starts on the ruler (0 = flush with the end). */
  start: number
  /** The object's length in units. */
  length: number
  unitLabel?: string
  /** Controlled: the tick the learner reads as the object's end. */
  value: number | null
  onChange: (value: number) => void
  reveal?: { correct: boolean; answer: number }
  disabled?: boolean
  className?: string
}

/**
 * Measure with a ruler — an object sits on a scale; the learner taps the tick
 * where it ends. Grading (tick === start + length) in `@bingoo.ai/core`. Tap-based →
 * web + mobile. i18n-free.
 */
export function RulerMeasure({
  max,
  start,
  length,
  unitLabel,
  value,
  onChange,
  reveal,
  disabled,
  className,
}: RulerMeasureProps) {
  const locked = !!reveal || disabled
  const units = Array.from({ length: max }, (_, i) => i)
  const ticks = Array.from({ length: max + 1 }, (_, i) => i)
  const end = start + length

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Object above the ruler */}
      <div className="flex w-full">
        {units.map((i) => {
          const inObject = i >= start && i < end
          return (
            <div key={i} className="flex-1 px-px">
              <div
                className={cn(
                  'h-7 rounded-md',
                  inObject ? 'bg-accent-coral' : 'bg-transparent',
                  inObject && i === start && 'rounded-l-lg',
                  inObject && i === end - 1 && 'rounded-r-lg',
                )}
              />
            </div>
          )
        })}
      </div>

      {/* Ruler with unit marks */}
      <div className="flex w-full overflow-hidden rounded-lg border-2 border-border-strong bg-accent-sunbeam-soft">
        {units.map((i) => (
          <div
            key={i}
            className="flex-1 border-border-strong/60 py-2 text-center text-2xs text-foreground-muted [&:not(:last-child)]:border-r"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Tick reading buttons 0..max */}
      <div className="flex w-full items-start justify-between">
        {ticks.map((t) => {
          const active = value === t
          const isAnswer = reveal?.answer === t
          return (
            <button
              key={t}
              type="button"
              disabled={locked}
              aria-label={`${t}${unitLabel ? ' ' + unitLabel : ''}`}
              aria-pressed={active}
              onClick={() => onChange(t)}
              className={cn(
                tile({
                  state: tileState({
                    selected: active,
                    revealed: !!reveal,
                    correct: reveal?.correct,
                    missed: isAnswer,
                  }),
                  size: 'none',
                }),
                'grid size-7 place-items-center rounded-full text-2xs font-bold tabular-nums',
              )}
            >
              {t}
            </button>
          )
        })}
      </div>
      {unitLabel ? (
        <span className="text-center text-xs font-semibold text-foreground-muted">{unitLabel}</span>
      ) : null}
    </div>
  )
}
