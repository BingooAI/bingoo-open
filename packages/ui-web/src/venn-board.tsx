'use client'

import type { QuizItem, VennRegion } from '@bingoo.ai/core'
import { useQuizText } from './quiz-locale'
import { Check, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from './lib/cn'
import { stagger, tile, tileState } from './lib/interactive'

export interface VennBoardProps {
  labelA: ReactNode
  labelB: ReactNode
  items: QuizItem[]
  assignment: Record<string, VennRegion>
  onChange: (assignment: Record<string, VennRegion>) => void
  /** After checking: itemId → correct. */
  reveal?: Record<string, boolean>
  /** Localized label for the "neither / outside" area. */
  neitherLabel?: ReactNode
  disabled?: boolean
  className?: string
}

/**
 * Sort items into a two-set Venn diagram by tapping: tap an item to arm it, tap a
 * region (A-only / overlap / B-only / outside) to drop it. Tap-based → works on
 * web + mobile. Grading in `@bingoo.ai/core`. i18n-free.
 */
export function VennBoard({
  labelA,
  labelB,
  items,
  assignment,
  onChange,
  reveal,
  neitherLabel,
  disabled,
  className,
}: VennBoardProps) {
  const t = useQuizText()
  const [armed, setArmed] = useState<string | null>(null)
  const locked = !!reveal || disabled

  function tapItem(id: string) {
    if (locked) return
    if (assignment[id]) {
      const next = { ...assignment }
      delete next[id]
      onChange(next)
      setArmed(null)
      return
    }
    setArmed((cur) => (cur === id ? null : id))
  }
  function drop(region: VennRegion) {
    if (locked || !armed) return
    onChange({ ...assignment, [armed]: region })
    setArmed(null)
  }

  const pool = items.filter((it) => !(it.id in assignment))
  const chip = (item: QuizItem, i: number) => {
    const ok = reveal?.[item.id]
    return (
      <button
        key={item.id}
        type="button"
        disabled={locked}
        aria-pressed={armed === item.id}
        onClick={() => tapItem(item.id)}
        style={stagger(i)}
        className={cn(
          tile({
            state: tileState({
              // Only the items the learner actually placed get a verdict.
              selected: reveal ? ok !== undefined : armed === item.id,
              revealed: reveal != null,
              correct: ok === true,
            }),
            size: 'none',
          }),
          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold',
          'motion-safe:animate-fade-up',
        )}
      >
        {item.emoji ? <span aria-hidden>{item.emoji}</span> : null}
        {t(item.label)}
        {ok === true ? <Check className="size-3" /> : null}
        {ok === false ? <X className="size-3" /> : null}
      </button>
    )
  }
  const zone = (region: VennRegion, extra: string) => {
    const droppable = !!armed && !locked
    return (
      <div
        role="button"
        tabIndex={droppable ? 0 : -1}
        onClick={() => drop(region)}
        onKeyDown={(e) =>
          droppable && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), drop(region))
        }
        className={cn(
          'flex flex-wrap content-start gap-1 p-1.5',
          droppable && 'cursor-pointer rounded-lg ring-2 ring-ring/40',
          extra,
        )}
      >
        {items.filter((it) => assignment[it.id] === region).map(chip)}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {pool.length > 0 ? <div className="flex flex-wrap gap-1.5">{pool.map(chip)}</div> : null}
      <div className="relative mx-auto h-56 w-full max-w-md">
        {/* Two overlapping circles. */}
        <div className="absolute left-0 top-4 h-44 w-2/3 rounded-full border-2 border-primary/50" />
        <div className="absolute right-0 top-4 h-44 w-2/3 rounded-full border-2 border-accent-teal/60" />
        <span className="absolute left-3 top-0 text-xs font-bold text-primary">{labelA}</span>
        <span className="absolute right-3 top-0 text-xs font-bold text-accent-teal">{labelB}</span>
        {/* Tap zones. */}
        {zone('a', 'absolute left-2 top-8 h-36 w-[30%] items-center justify-center')}
        {zone('both', 'absolute left-1/2 top-8 h-36 w-[24%] -translate-x-1/2 items-center justify-center')}
        {zone('b', 'absolute right-2 top-8 h-36 w-[30%] items-center justify-center')}
      </div>
      {/* Outside / neither. */}
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'rounded-xl border-dashed border-border-strong p-1.5',
        )}
      >
        <span className="px-1 text-2xs font-semibold uppercase text-foreground-muted">{neitherLabel}</span>
        {zone('neither', 'min-h-9')}
      </div>
    </div>
  )
}
