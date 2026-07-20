// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react'
import { cn } from './lib/cn'

export interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/** Placeholder for empty lists / zero-results. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="grid size-14 place-items-center rounded-2xl bg-surface-muted text-foreground-muted">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-bold text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-foreground-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
