'use client'

import { Heart } from 'lucide-react'
import { cn } from './lib/cn'

export type QuizSegmentStatus = 'pending' | 'correct' | 'incorrect'

export interface QuizProgressProps {
  total: number
  /** Index of the current question (highlighted). */
  index: number
  /** Per-question status; unset entries render as pending. */
  statuses?: QuizSegmentStatus[]
  /** Optional lives display (hearts). */
  lives?: { left: number; max: number }
  /** A11y label for the progress track (data). */
  label?: string
  className?: string
}

const SEG: Record<QuizSegmentStatus, string> = {
  pending: 'bg-surface-muted',
  correct: 'bg-success',
  incorrect: 'bg-danger',
}

/** A per-question segmented progress track, with optional lives (hearts). */
export function QuizProgress({ total, index, statuses, lives, label, className }: QuizProgressProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="flex flex-1 items-center gap-1.5"
        role="progressbar"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        {Array.from({ length: total }, (_, i) => {
          const status = statuses?.[i] ?? 'pending'
          const current = i === index
          return (
            <span
              key={i}
              className={cn(
                'h-2 flex-1 rounded-full transition-all duration-300',
                SEG[status],
                current && status === 'pending' && 'bg-primary/40',
                current && 'h-2.5 ring-2 ring-ring/40',
              )}
            />
          )
        })}
      </div>
      {lives ? (
        <div className="flex items-center gap-0.5" aria-label={label}>
          {Array.from({ length: lives.max }, (_, i) => (
            <Heart
              key={i}
              className={cn(
                'size-4 transition-colors',
                i < lives.left ? 'fill-danger text-danger' : 'text-border-strong',
              )}
              aria-hidden
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
