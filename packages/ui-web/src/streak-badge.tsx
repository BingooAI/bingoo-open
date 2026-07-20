import type { ReactNode } from 'react'
import { cn } from './lib/cn'

export interface StreakBadgeProps {
  days: number
  /** Unit label, e.g. "ngày" / "days" — pass localized text. */
  label?: ReactNode
  className?: string
}

/** Streak chip with a flame. */
export function StreakBadge({ days, label, className }: StreakBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-accent-coral-soft px-2.5 py-1 text-sm font-bold text-accent-coral',
        className,
      )}
    >
      <span aria-hidden>🔥</span>
      <span className="tabular-nums">{days}</span>
      {label ? <span>{label}</span> : null}
    </span>
  )
}
