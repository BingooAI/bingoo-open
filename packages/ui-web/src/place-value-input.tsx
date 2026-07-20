'use client'

import { Check, Minus, Plus, X } from 'lucide-react'
import { cn } from './lib/cn'
import { POP, SHAKE, tile } from './lib/interactive'

export interface PlaceValueInputProps {
  tens: number
  ones: number
  onChange: (tens: number, ones: number) => void
  reveal?: { correct: boolean; answer: number }
  /** Column labels, e.g. { tens: "Chục", ones: "Đơn vị" }. */
  columnLabels?: { tens: string; ones: string }
  disabled?: boolean
  label?: string
  className?: string
}

/** Build a two-digit number from base-ten blocks (tens rods + ones cubes). */
export function PlaceValueInput({
  tens,
  ones,
  onChange,
  reveal,
  columnLabels,
  disabled,
  label,
  className,
}: PlaceValueInputProps) {
  const locked = !!reveal || disabled
  const value = tens * 10 + ones

  const column = (kind: 'tens' | 'ones') => {
    const n = kind === 'tens' ? tens : ones
    const set = (next: number) => {
      const clamped = Math.max(0, Math.min(9, next))
      onChange(kind === 'tens' ? clamped : tens, kind === 'ones' ? clamped : ones)
    }
    return (
      <div className="flex flex-1 flex-col items-center gap-2">
        <span className="text-xs font-semibold uppercase text-foreground-muted">{columnLabels?.[kind]}</span>
        <div
          className={cn(
            tile({ state: 'quiet', size: 'none' }),
            'flex min-h-24 w-full flex-wrap content-end items-end justify-center gap-1 p-1.5',
          )}
        >
          {Array.from({ length: n }, (_, i) => (
            // Each block POPs as it lands, so adding one reads as placing a thing.
            <span
              key={i}
              className={cn('rounded-sm bg-primary', POP, kind === 'tens' ? 'h-16 w-2.5' : 'size-3.5')}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={locked || n === 0}
            onClick={() => set(n - 1)}
            className={cn(
              tile({ state: 'idle', size: 'none' }),
              'grid size-8 place-items-center text-foreground-muted',
            )}
          >
            <Minus className="size-4" />
          </button>
          <span className="w-5 text-center font-display font-bold tabular-nums">{n}</span>
          <button
            type="button"
            disabled={locked || n === 9}
            onClick={() => set(n + 1)}
            className={cn(
              tile({ state: 'idle', size: 'none' }),
              'grid size-8 place-items-center text-foreground-muted',
            )}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)} aria-label={label}>
      <div className="flex w-full max-w-sm gap-4">
        {column('tens')}
        {column('ones')}
      </div>
      <div className={cn('flex items-center gap-2', reveal && (reveal.correct ? POP : SHAKE))}>
        <span
          className={cn(
            'font-display text-2xl font-extrabold tabular-nums',
            reveal ? (reveal.correct ? 'text-success' : 'text-danger') : 'text-foreground',
          )}
        >
          {value}
        </span>
        {reveal ? (
          reveal.correct ? (
            <Check className="size-5 text-success" />
          ) : (
            <span className="flex items-center gap-1 text-danger">
              <X className="size-5" />
              <span className="font-bold tabular-nums">{reveal.answer}</span>
            </span>
          )
        ) : null}
      </div>
    </div>
  )
}
