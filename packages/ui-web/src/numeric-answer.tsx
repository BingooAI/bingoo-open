'use client'

import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Input } from './input'
import { cn } from './lib/cn'
import { POP, SHAKE } from './lib/interactive'

export interface NumericAnswerProps {
  value: string
  onChange: (value: string) => void
  /** After checking: whether correct + the expected answer to show. */
  reveal?: { correct: boolean; answer: number }
  unitLabel?: ReactNode
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Numeric input for math questions (comma or dot decimals). Controlled +
 * i18n-free; grading (with tolerance) lives in `@bingoo.ai/core`. */
export function NumericAnswer({
  value,
  onChange,
  reveal,
  unitLabel,
  placeholder,
  disabled,
  className,
}: NumericAnswerProps) {
  const locked = !!reveal || disabled
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('w-40', reveal && !reveal.correct && SHAKE)}>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
          placeholder={placeholder}
          inputMode="decimal"
          autoComplete="off"
          invalid={reveal ? !reveal.correct : undefined}
          className={cn('text-center font-display text-lg font-bold', reveal?.correct && 'text-success')}
        />
      </div>
      {unitLabel ? <span className="font-semibold text-foreground-muted">{unitLabel}</span> : null}
      {reveal ? (
        reveal.correct ? (
          <Check className={cn('size-5 text-success', POP)} />
        ) : (
          <span className="flex items-center gap-1.5 text-danger">
            <X className="size-5" />
            <span className="font-display font-bold tabular-nums">{reveal.answer}</span>
          </span>
        )
      ) : null}
    </div>
  )
}
