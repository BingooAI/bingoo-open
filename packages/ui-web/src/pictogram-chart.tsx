'use client'

import type { QuizItem } from '@bingoo/core'
import { useQuizText } from './quiz-locale'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface PictogramChartProps {
  categories: QuizItem[]
  maxIcons: number
  /** Units each icon represents (the key). */
  iconValue?: number
  /** Controlled: catId → number of icons. */
  counts: Record<string, number>
  onChange: (counts: Record<string, number>) => void
  reveal?: { cells: Record<string, boolean>; answer: Record<string, number> }
  disabled?: boolean
  /** Localized "= " key text, e.g. "= {n}" rendered by the caller as `${keyLabel}`. */
  keyLabel?: string
  className?: string
}

/**
 * Pictogram — fill each row with icons; tap a cell to set the row's count (tap the
 * top again to lower it). Each icon can stand for several units (the key). Grading
 * (icon counts === answer) in `@bingoo/core`. Tap-based → web + mobile. i18n-free.
 */
export function PictogramChart({
  categories,
  maxIcons,
  iconValue = 1,
  counts,
  onChange,
  reveal,
  disabled,
  keyLabel,
  className,
}: PictogramChartProps) {
  const locked = !!reveal || disabled
  const slots = Array.from({ length: maxIcons }, (_, i) => i + 1)
  const t = useQuizText()
  const setCount = (id: string, level: number) => {
    if (locked) return
    const cur = counts[id] ?? 0
    onChange({ ...counts, [id]: cur === level ? level - 1 : level })
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Key */}
      {iconValue > 1 ? (
        <span className="text-xs font-semibold text-foreground-muted">
          {categories[0]?.emoji ?? '⬤'} {keyLabel ?? `= ${iconValue}`}
        </span>
      ) : null}
      {categories.map((c, i) => {
        const n = counts[c.id] ?? 0
        const ok = reveal?.cells[c.id]
        return (
          <div
            key={c.id}
            style={stagger(i)}
            className={cn(
              tile({
                state: ok === true ? 'correct' : ok === false ? 'wrong' : 'quiet',
                size: 'none',
              }),
              'flex items-center gap-2 p-2 motion-safe:animate-fade-up',
              reveal == null && 'bg-surface',
            )}
          >
            <span className="w-20 shrink-0 truncate text-sm font-semibold text-foreground">{t(c.label)}</span>
            <div className="flex flex-1 flex-wrap gap-0.5">
              {slots.map((level) => {
                const filled = level <= n
                return (
                  <button
                    key={level}
                    type="button"
                    disabled={locked}
                    aria-label={`${t(c.label)}: ${level}`}
                    onClick={() => setCount(c.id, level)}
                    className={cn(
                      tile({ state: filled ? 'selected' : 'idle', size: 'none' }),
                      // an icon cell is one tick in a row — hairline, never a fat tile
                      'grid size-7 place-items-center rounded-md border text-lg leading-none',
                      filled && 'border-transparent shadow-none',
                      !filled && 'border-dashed bg-surface-muted/40',
                    )}
                  >
                    <span className={cn(!filled && 'opacity-0')}>{c.emoji ?? '⬤'}</span>
                  </button>
                )
              })}
            </div>
            {reveal && ok === false ? (
              <span className="shrink-0 text-xs font-semibold text-success">→ {reveal.answer[c.id]}</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
