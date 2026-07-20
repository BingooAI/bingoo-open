// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { type HTMLAttributes } from 'react'
import { cn } from './lib/cn'
import { toPercent } from '@bingoo.ai/core'

const BAR_COLOR = {
  primary: 'bg-primary',
  teal: 'bg-accent-teal',
  sunbeam: 'bg-accent-sunbeam',
  coral: 'bg-accent-coral',
  success: 'bg-success',
} as const

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  color?: keyof typeof BAR_COLOR
  size?: 'sm' | 'md' | 'lg'
  /** Accessible label for the progressbar. */
  label?: string
}

export function Progress({
  className,
  value,
  max = 100,
  color = 'primary',
  size = 'md',
  label,
  ...props
}: ProgressProps) {
  const pct = toPercent(value / max)
  const track = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' }[size]

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-surface-muted', track, className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out-soft', BAR_COLOR[color])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
