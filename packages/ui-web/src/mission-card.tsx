// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { missionProgress } from '@bingoo.ai/core'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconChip, type IconChipColor } from './icon-chip'
import { cn } from './lib/cn'
import { Progress } from './progress'

export interface MissionCardProps {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  current: number
  goal: number
  color?: IconChipColor
  /** Reward chip (e.g. "+50 XP") shown on the right. */
  reward?: ReactNode
  /** Progress readout, e.g. "3/5"; defaults to `current/goal`. */
  progressText?: ReactNode
  label?: string
  className?: string
}

/**
 * A daily/weekly mission (quest) card: icon, title, progress + reward. Fluid
 * width so it flows in a lesson list, a game hub, a feed card, or an arena panel.
 * Progress math from `@bingoo.ai/core`. i18n-free.
 */
export function MissionCard({
  icon,
  title,
  description,
  current,
  goal,
  color = 'primary',
  reward,
  progressText,
  label,
  className,
}: MissionCardProps) {
  const p = missionProgress(current, goal)
  return (
    <div
      aria-label={label}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3.5',
        p.complete && 'border-success/50 bg-success-soft',
        className,
      )}
    >
      <IconChip color={p.complete ? 'success' : color} tone={p.complete ? 'solid' : 'soft'}>
        {p.complete ? <Check className="size-5" /> : icon}
      </IconChip>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-display text-sm font-bold text-foreground">{title}</span>
          {reward ? (
            <span className="shrink-0 rounded-full bg-accent-sunbeam-soft px-2 py-0.5 text-xs font-bold text-accent-sunbeam">
              {reward}
            </span>
          ) : null}
        </div>
        {description ? <span className="truncate text-xs text-foreground-muted">{description}</span> : null}
        <div className="flex items-center gap-2">
          <Progress value={p.ratio * 100} className="flex-1" />
          <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground-muted">
            {progressText ?? `${current}/${goal}`}
          </span>
        </div>
      </div>
    </div>
  )
}
