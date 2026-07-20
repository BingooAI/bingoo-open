// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { TrendingDown, TrendingUp } from 'lucide-react'
import { type ReactNode } from 'react'
import { cn } from './lib/cn'
import { Card } from './card'
import { IconChip, type IconChipColor } from './icon-chip'

export interface StatCardProps {
  icon: ReactNode
  label: ReactNode
  value: ReactNode
  color?: IconChipColor
  /** e.g. "+12%" — positive renders success, negative renders danger. */
  trend?: { value: ReactNode; direction: 'up' | 'down' }
  hint?: ReactNode
  className?: string
}

export function StatCard({ icon, label, value, color = 'primary', trend, hint, className }: StatCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <IconChip color={color}>{icon}</IconChip>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              trend.direction === 'up' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {trend.value}
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="font-display text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
        <div className="mt-0.5 text-sm text-foreground-muted">{label}</div>
        {hint && <div className="mt-1 text-xs text-foreground-subtle">{hint}</div>}
      </div>
    </Card>
  )
}
