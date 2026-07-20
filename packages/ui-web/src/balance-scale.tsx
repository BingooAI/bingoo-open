// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { cn } from './lib/cn'
import { stagger, tile, tileState } from './lib/interactive'

export type BalanceChoice = 'lt' | 'eq' | 'gt'

export interface BalanceScaleProps {
  left: number
  right: number
  leftLabel?: string
  rightLabel?: string
  leftEmoji?: string
  rightEmoji?: string
  /** Controlled: the learner's chosen relation. */
  choice: BalanceChoice | null
  onChange: (choice: BalanceChoice) => void
  reveal?: { correct: boolean; answer: BalanceChoice }
  /** Labels for the three relation buttons (defaults to symbols). */
  labels?: { lt: string; eq: string; gt: string }
  disabled?: boolean
  className?: string
}

const SYMBOL: Record<BalanceChoice, string> = { lt: '<', eq: '=', gt: '>' }

/**
 * Balance scale — a beam that tilts toward the heavier pan, so the learner reads
 * the picture then picks the relation (< = >). Grading in `@bingoo.ai/core`. i18n-free
 * (button labels are props; symbols by default).
 */
export function BalanceScale({
  left,
  right,
  leftLabel,
  rightLabel,
  leftEmoji,
  rightEmoji,
  choice,
  onChange,
  reveal,
  labels,
  disabled,
  className,
}: BalanceScaleProps) {
  const locked = !!reveal || disabled
  // Beam tilts toward the heavier side (the manipulative the learner reads).
  const tilt = left === right ? 0 : left > right ? -9 : 9
  const pan = (value: number, emoji?: string, label?: string, side: 'l' | 'r' = 'l') => (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'flex min-h-12 min-w-20 flex-wrap items-center justify-center gap-0.5 rounded-b-2xl rounded-t-md px-2 py-1',
        )}
      >
        {emoji ? (
          <span className="text-lg leading-tight">{emoji.repeat(Math.max(0, Math.min(value, 12)))}</span>
        ) : (
          <span className="text-xl font-bold text-foreground">{value}</span>
        )}
      </div>
      {label ? <span className="text-xs font-semibold text-foreground-muted">{label}</span> : null}
      <span className="sr-only">{side === 'l' ? 'left' : 'right'}</span>
    </div>
  )

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* Scale */}
      <div className="relative h-40 w-full max-w-sm">
        <div
          className="absolute left-1/2 top-6 flex w-[86%] -translate-x-1/2 items-start justify-between transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${tilt}deg)` }}
        >
          {pan(left, leftEmoji, leftLabel, 'l')}
          {pan(right, rightEmoji, rightLabel, 'r')}
        </div>
        {/* Fulcrum */}
        <div className="absolute bottom-0 left-1/2 h-20 w-0.5 -translate-x-1/2 bg-border-strong" />
        <div className="absolute bottom-0 left-1/2 size-6 -translate-x-1/2 translate-y-1 rounded-full bg-primary" />
      </div>

      {/* Relation buttons */}
      <div className="flex gap-2">
        {(['lt', 'eq', 'gt'] as BalanceChoice[]).map((c, i) => (
          <button
            key={c}
            type="button"
            disabled={locked}
            aria-pressed={choice === c}
            onClick={() => onChange(c)}
            style={stagger(i)}
            className={cn(
              tile({
                state: tileState({
                  selected: choice === c,
                  revealed: !!reveal,
                  correct: reveal?.correct,
                  missed: reveal?.answer === c,
                }),
                size: 'none',
              }),
              'grid size-14 place-items-center text-2xl font-bold motion-safe:animate-fade-up',
            )}
          >
            {labels ? labels[c] : SYMBOL[c]}
          </button>
        ))}
      </div>
    </div>
  )
}
