// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react'
import { BadgeTile } from './badge-tile'
import type { IconChipColor } from './icon-chip'
import { cn } from './lib/cn'

export interface BadgeGridItem {
  id: string
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  color?: IconChipColor
  locked?: boolean
}

export interface BadgeGridProps {
  badges: BadgeGridItem[]
  className?: string
}

/** A collection wall of achievement badges (earned + locked). Reuses BadgeTile. */
export function BadgeGrid({ badges, className }: BadgeGridProps) {
  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {badges.map((b) => (
        <BadgeTile
          key={b.id}
          icon={b.icon}
          title={b.title}
          description={b.description}
          color={b.color}
          locked={b.locked}
        />
      ))}
    </div>
  )
}
