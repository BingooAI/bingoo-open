import type { ReactNode } from 'react'
import { cn } from './lib/cn'

export interface MeterProps {
  value: number
  max?: number
  label?: ReactNode
  showValue?: boolean
  color?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}

const BAR = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const

/** A labelled measurement bar (distinct from Progress: a static known ratio). */
export function Meter({
  value,
  max = 100,
  label,
  showValue = true,
  color = 'primary',
  className,
}: MeterProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label || showValue ? (
        <div className="flex items-center justify-between text-sm">
          {label ? <span className="font-medium text-foreground">{label}</span> : <span />}
          {showValue ? <span className="tabular-nums text-foreground-muted">{Math.round(pct)}%</span> : null}
        </div>
      ) : null}
      <div
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', BAR[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
