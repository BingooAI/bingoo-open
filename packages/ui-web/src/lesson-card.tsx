// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react'
import { Button } from './button'
import { Card } from './card'
import { IconChip, type IconChipColor } from './icon-chip'
import { cn } from './lib/cn'
import { Progress } from './progress'

export interface LessonCardProps {
  icon: ReactNode
  title: ReactNode
  meta?: ReactNode
  color?: IconChipColor
  progress?: number
  cta: ReactNode
  onStart?: () => void
  className?: string
}

/** "Continue learning" card — subject icon, title/meta, progress, CTA. */
export function LessonCard({
  icon,
  title,
  meta,
  color = 'primary',
  progress,
  cta,
  onStart,
  className,
}: LessonCardProps) {
  return (
    <Card className={cn('flex items-center gap-3 p-4', className)}>
      <IconChip color={color} tone="gradient">
        {icon}
      </IconChip>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold text-foreground">{title}</p>
        {meta ? <p className="truncate text-xs text-foreground-muted">{meta}</p> : null}
        {progress != null ? <Progress value={progress} className="mt-2" /> : null}
      </div>
      <Button onClick={onStart}>{cta}</Button>
    </Card>
  )
}
