'use client'

import type { RubricCriterion } from '@bingoo.ai/core'
import { Check } from 'lucide-react'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface RubricListProps {
  /** The success criteria — shown BEFORE the learner starts, as the books do. */
  criteria: RubricCriterion[]
  /** Controlled: ids of the criteria the learner says they met. */
  met: string[]
  onChange: (met: string[]) => void
  /** Heading, e.g. "Bài của em cần có:" — the caller localizes it. */
  title?: string
  /** How many must be met to pass; shown as "2 / 3" when the learner falls short. */
  need?: number
  reveal?: { correct: boolean }
  disabled?: boolean
  className?: string
}

/**
 * Success criteria the learner ticks off against their own work — how open tasks
 * (drawing, writing) are assessed, since no machine can mark them. Scoring lives in
 * `@bingoo.ai/core` (`gradeQuestion`), so a teacher or a model can overwrite the same
 * `met` list later without any change here. i18n-free.
 */
export function RubricList({
  criteria,
  met,
  onChange,
  title,
  need,
  reveal,
  disabled,
  className,
}: RubricListProps) {
  const locked = !!reveal || disabled
  const toggle = (id: string) => {
    if (locked) return
    onChange(met.includes(id) ? met.filter((m) => m !== id) : [...met, id])
  }
  const hit = criteria.filter((c) => met.includes(c.id)).length

  return (
    <div className={cn(tile({ state: 'quiet', size: 'none' }), 'flex w-full flex-col gap-2 p-3', className)}>
      {title ? (
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground-subtle">{title}</p>
          <p
            className={cn(
              'text-sm font-bold tabular-nums',
              reveal ? (reveal.correct ? 'text-success' : 'text-danger') : 'text-foreground-muted',
            )}
          >
            {hit}/{need ?? criteria.length}
          </p>
        </div>
      ) : null}
      {criteria.map((c, i) => {
        const on = met.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            disabled={locked}
            onClick={() => toggle(c.id)}
            style={stagger(i)}
            className={cn(
              // A ticked criterion is the learner claiming success — it wears the success tile.
              tile({ state: on ? 'correct' : 'idle', size: 'none' }),
              'flex items-center gap-2.5 px-3 py-2 text-left',
              // The entrance must step aside for the tick's pop — one animation per element.
              !on && 'motion-safe:animate-fade-up',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-md border-2',
                on ? 'border-success bg-success text-white' : 'border-border-strong',
              )}
            >
              {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <span className="text-sm font-medium text-foreground">{c.text}</span>
          </button>
        )
      })}
    </div>
  )
}
