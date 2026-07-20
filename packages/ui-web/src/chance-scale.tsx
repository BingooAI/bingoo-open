'use client'

import type { QuizItem } from '@bingoo.ai/core'
import { useQuizText } from './quiz-locale'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface ChanceLevel {
  id: string
  label?: string
}

export interface ChanceScaleProps {
  /** Likelihood levels in order, least → most likely. */
  levels: ChanceLevel[]
  items: QuizItem[]
  /** Controlled: itemId → levelId. */
  assignment: Record<string, string>
  onChange: (assignment: Record<string, string>) => void
  reveal?: { items: Record<string, boolean>; answer: Record<string, string> }
  disabled?: boolean
  className?: string
}

/**
 * Chance / likelihood scale — place each event on an ORDERED scale (won't → might
 * → will happen). Tap an event to arm it, tap a level to drop it. The ordering is
 * what makes this different from a plain categorize. Grading in `@bingoo.ai/core`.
 * Tap-based → web + mobile. i18n-free.
 */
export function ChanceScale({
  levels,
  items,
  assignment,
  onChange,
  reveal,
  disabled,
  className,
}: ChanceScaleProps) {
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
  function drop(levelId: string) {
    if (locked || !armed) return
    onChange({ ...assignment, [armed]: levelId })
    setArmed(null)
  }

  const pool = items.filter((it) => !(it.id in assignment))
  const chip = (item: QuizItem) => {
    const ok = reveal?.items[item.id]
    return (
      <button
        key={item.id}
        type="button"
        disabled={locked}
        aria-pressed={armed === item.id}
        onClick={() => tapItem(item.id)}
        className={cn(
          tile({
            state: ok === true ? 'correct' : ok === false ? 'wrong' : armed === item.id ? 'selected' : 'idle',
            size: 'none',
          }),
          'inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-1 text-left text-xs font-semibold',
        )}
      >
        {item.emoji ? <span aria-hidden>{item.emoji}</span> : null}
        <span className="min-w-0">{t(item.label)}</span>
        {ok === true ? <Check className="size-3 shrink-0" /> : null}
        {ok === false ? <X className="size-3 shrink-0" /> : null}
      </button>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {pool.length > 0 ? <div className="flex flex-wrap gap-1.5">{pool.map(chip)}</div> : null}

      {/* The ordered scale: an arrow from least → most likely */}
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-danger/40 via-accent-sunbeam/50 to-success/50" />
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}
        >
          {levels.map((lv, i) => {
            const droppable = !!armed && !locked
            const inLevel = items.filter((it) => assignment[it.id] === lv.id)
            return (
              <div
                key={lv.id}
                style={stagger(i)}
                role="button"
                tabIndex={droppable ? 0 : -1}
                onClick={() => drop(lv.id)}
                onKeyDown={(e) =>
                  droppable && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), drop(lv.id))
                }
                className={cn(
                  tile({ state: droppable ? 'selected' : 'quiet', size: 'none' }),
                  'flex min-h-24 flex-col gap-1.5 rounded-xl border-dashed p-2 motion-safe:animate-fade-up',
                  droppable && 'cursor-pointer',
                )}
              >
                <span className="text-center text-2xs font-bold uppercase tracking-wide text-foreground-muted">
                  {t(lv.label)}
                </span>
                <div className="flex flex-col gap-1">{inLevel.map(chip)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
