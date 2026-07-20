// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './lib/cn'
import { ProgressRing, type ProgressRingProps } from './progress-ring'

export interface DailyGoalRingProps {
  value: number
  goal: number
  /** Small caption under the number (e.g. "phút" / "XP"). */
  unit?: ReactNode
  size?: number
  strokeWidth?: number
  color?: ProgressRingProps['color']
  /** Glass/light styling for overlaying on feed or arena media. */
  onMedia?: boolean
  label?: string
  className?: string
}

/**
 * A daily-goal progress ring (Apple-rings style) — reused as a dashboard tile, a
 * feed HUD, or an arena stat. Turns success-green + a check when the goal is met.
 */
export function DailyGoalRing({
  value,
  goal,
  unit,
  size = 96,
  strokeWidth = 10,
  color,
  onMedia,
  label,
  className,
}: DailyGoalRingProps) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const done = goal > 0 && value >= goal
  const ink = onMedia ? 'text-white' : 'text-foreground'
  const muted = onMedia ? 'text-white/70' : 'text-foreground-muted'
  return (
    <ProgressRing
      value={pct}
      max={100}
      size={size}
      strokeWidth={strokeWidth}
      color={done ? 'success' : (color ?? 'primary')}
      label={label}
      className={className}
    >
      {done ? (
        <Check className="size-8 text-success" />
      ) : (
        <span className="flex flex-col items-center leading-none">
          <span className={cn('font-display text-xl font-extrabold tabular-nums', ink)}>{value}</span>
          <span className={cn('text-2xs font-semibold', muted)}>/ {goal}</span>
          {unit ? <span className={cn('mt-0.5 text-2xs', muted)}>{unit}</span> : null}
        </span>
      )}
    </ProgressRing>
  )
}
