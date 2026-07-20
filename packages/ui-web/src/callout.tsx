// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { cn } from './lib/cn'

export type CalloutVariant = 'info' | 'success' | 'warning' | 'danger'

export interface CalloutProps {
  variant?: CalloutVariant
  title?: ReactNode
  children?: ReactNode
  className?: string
}

const MAP: Record<CalloutVariant, { cls: string; Icon: ComponentType<{ className?: string }> }> = {
  info: { cls: 'border-info/30 bg-info-soft text-info', Icon: Info },
  success: { cls: 'border-success/30 bg-success-soft text-success', Icon: CheckCircle2 },
  warning: {
    cls: 'border-warning/40 bg-warning-soft text-warning-foreground',
    Icon: AlertTriangle,
  },
  danger: { cls: 'border-danger/30 bg-danger-soft text-danger', Icon: XCircle },
}

/** Inline alert / callout with semantic variant + icon. */
export function Callout({ variant = 'info', title, children, className }: CalloutProps) {
  const { cls, Icon } = MAP[variant]
  return (
    <div role="note" className={cn('flex gap-3 rounded-2xl border p-4', cls, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        {title ? <p className="font-display text-sm font-bold">{title}</p> : null}
        {children ? <div className="text-sm opacity-90">{children}</div> : null}
      </div>
    </div>
  )
}
