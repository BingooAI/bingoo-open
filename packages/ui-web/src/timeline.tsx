// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react'
import { cn } from './lib/cn'

export interface TimelineItemData {
  id: string
  title: ReactNode
  time?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  color?: 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success'
}

const DOT = {
  primary: 'bg-primary',
  teal: 'bg-accent-teal',
  sunbeam: 'bg-accent-sunbeam',
  coral: 'bg-accent-coral',
  success: 'bg-success',
} as const

export interface TimelineProps {
  items: TimelineItemData[]
  className?: string
}

/** Vertical timeline / activity feed. */
export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <li key={it.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-white',
                  DOT[it.color ?? 'primary'],
                )}
              >
                {it.icon}
              </span>
              {!last ? <span className="w-px flex-1 bg-border" /> : null}
            </div>
            <div className={cn('flex flex-col gap-0.5', last ? 'pb-0' : 'pb-6')}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-bold text-foreground">{it.title}</p>
                {it.time ? <span className="text-xs text-foreground-subtle">{it.time}</span> : null}
              </div>
              {it.description ? <p className="text-sm text-foreground-muted">{it.description}</p> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
