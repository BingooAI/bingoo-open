'use client'

import type { ReactNode } from 'react'
import { Button } from './button'
import { cn } from './lib/cn'
import { Stepper, type StepperStep } from './patterns'

export interface StepLessonProps {
  steps: StepperStep[]
  current: number
  children: ReactNode
  onNext: () => void
  onPrev?: () => void
  onFinish?: () => void
  nextLabel: ReactNode
  prevLabel?: ReactNode
  finishLabel: ReactNode
  className?: string
}

/**
 * A multi-step lesson flow (explain → example → practice…) with a step indicator
 * and prev/next nav. Reuses the shared Stepper. Controlled `current`. i18n-free.
 */
export function StepLesson({
  steps,
  current,
  children,
  onNext,
  onPrev,
  onFinish,
  nextLabel,
  prevLabel,
  finishLabel,
  className,
}: StepLessonProps) {
  const isLast = current >= steps.length - 1
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <Stepper steps={steps} current={current} />
      <div key={current} className="motion-safe:animate-fade-up">
        {children}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onPrev} disabled={current === 0 || !onPrev}>
          {prevLabel}
        </Button>
        <Button onClick={isLast ? (onFinish ?? onNext) : onNext}>{isLast ? finishLabel : nextLabel}</Button>
      </div>
    </div>
  )
}
