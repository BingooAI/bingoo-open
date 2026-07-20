// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from './lib/cn'

export type BadgeColor =
  'neutral' | 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success' | 'warning' | 'danger' | 'info'

export type BadgeTone = 'soft' | 'solid' | 'outline'

const SOFT: Record<BadgeColor, string> = {
  neutral: 'bg-surface-muted text-foreground-muted',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  teal: 'bg-accent-teal-soft text-accent-teal',
  sunbeam: 'bg-accent-sunbeam-soft text-accent-sunbeam',
  coral: 'bg-accent-coral-soft text-accent-coral',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}

const SOLID: Record<BadgeColor, string> = {
  neutral: 'bg-foreground text-background',
  primary: 'bg-primary text-primary-foreground',
  teal: 'bg-accent-teal text-accent-teal-foreground',
  sunbeam: 'bg-accent-sunbeam text-accent-sunbeam-foreground',
  coral: 'bg-accent-coral text-accent-coral-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-danger text-danger-foreground',
  info: 'bg-info text-info-foreground',
}

const OUTLINE: Record<BadgeColor, string> = {
  neutral: 'border border-border-strong text-foreground-muted',
  primary: 'border border-primary/40 text-primary',
  teal: 'border border-accent-teal/40 text-accent-teal',
  sunbeam: 'border border-accent-sunbeam/50 text-accent-sunbeam',
  coral: 'border border-accent-coral/40 text-accent-coral',
  success: 'border border-success/40 text-success',
  warning: 'border border-warning/50 text-warning',
  danger: 'border border-danger/40 text-danger',
  info: 'border border-info/40 text-info',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor
  tone?: BadgeTone
  size?: 'sm' | 'md'
  dot?: boolean
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, color = 'neutral', tone = 'soft', size = 'md', dot, children, ...props },
  ref,
) {
  const tones = { soft: SOFT, solid: SOLID, outline: OUTLINE }[tone]
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
        tones[color],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
})
