// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconChip, type IconChipColor } from './icon-chip'
import { cn } from './lib/cn'
import { Progress } from './progress'

export interface SubjectCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'title' | 'color' | 'name'
> {
  icon: ReactNode
  name: ReactNode
  color?: IconChipColor
  /** 0–100; hidden when undefined. */
  progress?: number
}

/** Tappable subject tile — colored icon + name + optional progress. */
export function SubjectCard({
  icon,
  name,
  color = 'primary',
  progress,
  className,
  ...props
}: SubjectCardProps) {
  return (
    <button
      type="button"
      className={cn(
        'group flex w-40 flex-col gap-2.5 rounded-[var(--radius-card,2rem)] border border-border bg-surface p-4 text-left shadow-sm outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <IconChip color={color} tone="gradient">
        {icon}
      </IconChip>
      <span className="font-display text-sm font-bold text-foreground">{name}</span>
      {progress != null ? <Progress value={progress} /> : null}
    </button>
  )
}
