'use client'

import type { QuizItem } from '@bingoo/core'
import { useQuizText } from './quiz-locale'
import { Minus, Plus } from 'lucide-react'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface TallyChartProps {
  categories: QuizItem[]
  /** Controlled: catId → count. */
  counts: Record<string, number>
  onChange: (counts: Record<string, number>) => void
  reveal?: { cells: Record<string, boolean>; answer: Record<string, number> }
  disabled?: boolean
  className?: string
}

/** One group of up to 5 tally marks (four strokes + a diagonal for the fifth). */
function TallyGroup({ n }: { n: number }) {
  const bars = Math.min(n, 4)
  return (
    <svg width={26} height={22} className="shrink-0" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <line
          key={i}
          x1={3 + i * 5}
          y1={3}
          x2={3 + i * 5}
          y2={19}
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
      {n >= 5 ? (
        <line x1={1} y1={18} x2={21} y2={4} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      ) : null}
    </svg>
  )
}

function TallyMarks({ count }: { count: number }) {
  const fives = Math.floor(count / 5)
  const rem = count % 5
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Array.from({ length: fives }, (_, i) => (
        <TallyGroup key={i} n={5} />
      ))}
      {rem > 0 ? <TallyGroup n={rem} /> : null}
      {count === 0 ? <span className="text-sm text-foreground-subtle">—</span> : null}
    </div>
  )
}

/**
 * Tally chart — record a count per category as tally marks (grouped in fives).
 * Tap +/− to change each row. Grading (counts === answer) in `@bingoo/core`. i18n-free.
 */
export function TallyChart({ categories, counts, onChange, reveal, disabled, className }: TallyChartProps) {
  const t = useQuizText()
  const locked = !!reveal || disabled
  const bump = (id: string, d: number) => {
    if (locked) return
    onChange({ ...counts, [id]: Math.max(0, (counts[id] ?? 0) + d) })
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {categories.map((c, i) => {
        const n = counts[c.id] ?? 0
        const ok = reveal?.cells[c.id]
        return (
          <div
            key={c.id}
            style={stagger(i)}
            className={cn(
              // The row is the thing that gets marked, so the row is what pops or shakes.
              tile({
                // The row itself is never tapped (the +/− are), so it sits back until marked.
                state: ok === true ? 'correct' : ok === false ? 'wrong' : 'quiet',
                size: 'none',
              }),
              'flex items-center gap-3 p-2.5',
              !reveal && 'motion-safe:animate-fade-up',
            )}
          >
            <span className="flex w-24 shrink-0 items-center gap-1 text-sm font-semibold text-foreground">
              {c.emoji ? <span aria-hidden>{c.emoji}</span> : null}
              {t(c.label)}
            </span>
            <div className="min-h-6 flex-1 text-foreground">
              <TallyMarks count={n} />
            </div>
            <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
              {n}
            </span>
            {reveal && ok === false ? (
              <span className="shrink-0 text-xs font-semibold text-success">→ {reveal.answer[c.id]}</span>
            ) : null}
            {!locked ? (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label="−"
                  onClick={() => bump(c.id, -1)}
                  className={cn(
                    tile({ state: 'idle', size: 'none' }),
                    'grid size-7 place-items-center text-foreground',
                  )}
                >
                  <Minus className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="+"
                  onClick={() => bump(c.id, 1)}
                  className={cn(
                    // The + is the one you reach for, so it wears the primary tile.
                    tile({ state: 'selected', size: 'none' }),
                    'grid size-7 place-items-center text-primary',
                  )}
                >
                  <Plus className="size-4" />
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
