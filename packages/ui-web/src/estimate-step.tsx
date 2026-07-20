// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { cn } from './lib/cn'
import { tile } from './lib/interactive'

export interface EstimateLabels {
  /** "Ước lượng của em" — step 1. */
  estimate: string
  /** "Đo / tính thật" — step 2. */
  actual: string
  /** Praise when the estimate landed inside the tolerance, e.g. "Ước lượng rất sát!". */
  close: string
  /** Shown when it did not, e.g. (off) => `Lệch ${off}`. */
  off: (off: number) => string
}

export interface EstimateStepProps {
  estimate: number | null
  actual: number | null
  onChange: (next: { estimate: number | null; actual: number | null }) => void
  unit?: string
  step?: number
  labels: EstimateLabels
  reveal?: { correct: boolean; actual: number; close: boolean; off: number | null }
  disabled?: boolean
  className?: string
}

/**
 * Estimate first, THEN measure/work it out — the pairing the books drill 200+ times.
 * Only the measured value is marked; the estimate is never right or wrong, it just gets
 * compared to the truth so the learner can see how good their sense of size is.
 * Grading lives in `@bingoo.ai/core`. i18n-free.
 */
export function EstimateStep({
  estimate,
  actual,
  onChange,
  unit,
  step = 1,
  labels,
  reveal,
  disabled,
  className,
}: EstimateStepProps) {
  const locked = !!reveal || disabled
  const estimated = estimate !== null

  return (
    <div className={cn('flex w-full flex-col items-center gap-3', className)}>
      <Field
        title={labels.estimate}
        value={estimate}
        onChange={(v) => onChange({ estimate: v, actual })}
        unit={unit}
        step={step}
        disabled={locked}
        tone={reveal ? (reveal.close ? 'good' : 'plain') : 'plain'}
      />

      {/* Step 2 unlocks only once an estimate is committed — you cannot peek first. */}
      <Field
        title={labels.actual}
        value={actual}
        onChange={(v) => onChange({ estimate, actual: v })}
        unit={unit}
        step={step}
        disabled={locked || !estimated}
        tone={reveal ? (reveal.correct ? 'good' : 'bad') : 'plain'}
      />

      {reveal ? (
        <div className="flex flex-col items-center gap-1">
          {!reveal.correct ? (
            <p className="text-sm font-bold text-success">
              → {reveal.actual}
              {unit ? ` ${unit}` : ''}
            </p>
          ) : null}
          {reveal.off !== null ? (
            <p
              className={cn('text-sm font-semibold', reveal.close ? 'text-success' : 'text-foreground-muted')}
            >
              {reveal.close ? labels.close : labels.off(reveal.off)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Field({
  title,
  value,
  onChange,
  unit,
  step,
  disabled,
  tone,
}: {
  title: string
  value: number | null
  onChange: (v: number) => void
  unit?: string
  step: number
  disabled?: boolean
  tone: 'plain' | 'good' | 'bad'
}) {
  const bump = (d: number) => onChange(Number(((value ?? 0) + d * step).toFixed(4)))
  const key = cn(tile({ size: 'none' }), 'size-9 rounded-xl text-lg font-bold')
  return (
    <div
      className={cn(
        tile({
          state: tone === 'good' ? 'correct' : tone === 'bad' ? 'wrong' : 'quiet',
          size: 'none',
        }),
        'flex w-full max-w-xs flex-col gap-1.5 p-3',
        disabled && 'opacity-60',
      )}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-foreground-subtle">{title}</p>
      <div className="flex items-center justify-center gap-3">
        <button type="button" disabled={disabled} aria-label="-" onClick={() => bump(-1)} className={key}>
          −
        </button>
        <p className="min-w-16 text-center text-2xl font-bold tabular-nums text-foreground">
          {value ?? '–'}
          {unit && value !== null ? (
            <span className="ml-1 text-sm font-semibold text-foreground-muted">{unit}</span>
          ) : null}
        </p>
        <button type="button" disabled={disabled} aria-label="+" onClick={() => bump(1)} className={key}>
          +
        </button>
      </div>
    </div>
  )
}
