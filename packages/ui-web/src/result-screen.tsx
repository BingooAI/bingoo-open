'use client'

import type { QuizSummary } from '@bingoo/core'
import { RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'
import { Card } from './card'
import { Confetti } from './celebration'
import { cn } from './lib/cn'
import { ProgressRing } from './progress-ring'

export interface ResultLabels {
  /** Headline — the caller picks it (e.g. praise vs. encouragement) by `passed`. */
  title: ReactNode
  subtitle?: ReactNode
  accuracyLabel: ReactNode
  /** Pre-formatted "8 / 10" style correct-count (data). */
  correctText: ReactNode
  correctLabel: ReactNode
  retry: ReactNode
  continueLabel: ReactNode
}

export interface ResultScreenProps {
  summary: QuizSummary
  labels: ResultLabels
  onRetry?: () => void
  onContinue?: () => void
  className?: string
}

/** End-of-quiz summary: accuracy ring, correct count, per-question review, actions. */
export function ResultScreen({ summary, labels, onRetry, onContinue, className }: ResultScreenProps) {
  const ringColor = summary.passed ? 'success' : 'primary'
  return (
    <Card
      className={cn('relative flex flex-col items-center gap-6 overflow-hidden p-8 text-center', className)}
    >
      {/* Passing is the moment worth celebrating — anything less would be hollow praise. */}
      {summary.passed ? <Confetti className="pointer-events-none absolute inset-0" /> : null}
      <div className="motion-safe:animate-pop-in">
        <ProgressRing value={summary.accuracy} max={100} size={132} strokeWidth={12} color={ringColor}>
          <span className="flex flex-col leading-none">
            <span className="font-display text-4xl font-extrabold text-foreground">
              {summary.accuracy}
              <span className="text-xl">%</span>
            </span>
            <span className="mt-1 text-2xs font-semibold uppercase tracking-wide text-foreground-muted">
              {labels.accuracyLabel}
            </span>
          </span>
        </ProgressRing>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold text-foreground">{labels.title}</h2>
        {labels.subtitle ? <p className="text-foreground-muted">{labels.subtitle}</p> : null}
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="font-display text-lg font-bold text-foreground">
          {labels.correctText}{' '}
          <span className="font-normal text-foreground-muted">{labels.correctLabel}</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {summary.review.map((r, i) => (
            <span
              key={r.question.id ?? i}
              className={cn(
                'size-2.5 rounded-full',
                r.grade?.correct ? 'bg-success' : r.grade ? 'bg-danger' : 'bg-surface-muted',
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry} leftIcon={<RotateCcw className="size-4" />}>
            {labels.retry}
          </Button>
        ) : null}
        {onContinue ? <Button onClick={onContinue}>{labels.continueLabel}</Button> : null}
      </div>
    </Card>
  )
}
