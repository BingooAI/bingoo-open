'use client'

import type { QuizItem } from '@bingoo.ai/core'
import { useQuizText } from './quiz-locale'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from './lib/cn'
import { tile } from './lib/interactive'

export interface CarrollGridProps {
  rows: string[]
  cols: string[]
  items: QuizItem[]
  /** Controlled: itemId → cell "row-col". */
  assignment: Record<string, string>
  onChange: (assignment: Record<string, string>) => void
  /** After checking: itemId → correct. */
  reveal?: { items: Record<string, boolean>; answer: Record<string, string> }
  disabled?: boolean
  className?: string
}

/**
 * Carroll diagram — sort items by two criteria into a rows × columns grid. Tap an
 * item to arm it, tap a cell to drop it. Tap-based → web + mobile. Grading in
 * `@bingoo.ai/core`. i18n-free.
 */
export function CarrollGrid({
  rows,
  cols,
  items,
  assignment,
  onChange,
  reveal,
  disabled,
  className,
}: CarrollGridProps) {
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
  function drop(cell: string) {
    if (locked || !armed) return
    onChange({ ...assignment, [armed]: cell })
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
          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold',
        )}
      >
        {item.emoji ? <span aria-hidden>{item.emoji}</span> : null}
        {t(item.label)}
        {ok === true ? <Check className="size-3" /> : null}
        {ok === false ? <X className="size-3" /> : null}
      </button>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {pool.length > 0 ? <div className="flex flex-wrap gap-1.5">{pool.map(chip)}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-16" />
              {cols.map((c) => (
                <th
                  key={c}
                  className="rounded-lg bg-surface-muted px-2 py-1.5 text-xs font-bold text-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((rowLabel, r) => (
              <tr key={rowLabel}>
                <th className="rounded-lg bg-surface-muted px-2 py-1.5 text-left text-xs font-bold text-foreground">
                  {rowLabel}
                </th>
                {cols.map((_, c) => {
                  const cell = `${r}-${c}`
                  const droppable = !!armed && !locked
                  const inCell = items.filter((it) => assignment[it.id] === cell)
                  return (
                    <td
                      key={cell}
                      role="button"
                      tabIndex={droppable ? 0 : -1}
                      onClick={() => drop(cell)}
                      onKeyDown={(e) =>
                        droppable && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), drop(cell))
                      }
                      className={cn(
                        tile({ state: droppable ? 'selected' : 'quiet', size: 'none' }),
                        'h-16 min-w-16 rounded-lg border-dashed p-1 align-top',
                        droppable && 'cursor-pointer',
                      )}
                    >
                      <div className="flex flex-wrap gap-1">{inCell.map(chip)}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
