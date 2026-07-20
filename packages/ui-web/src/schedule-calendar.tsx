// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { formatSlotTime, hourTicks, layoutWeek, type ScheduleSlot } from '@bingoo.ai/core'
import type { ReactNode } from 'react'
import { cn } from './lib/cn'

export interface CalendarSlot extends ScheduleSlot {
  title: ReactNode
  /** Optional secondary line (room, subject…). */
  meta?: ReactNode
  color?: 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success'
}

export interface ScheduleCalendarProps {
  slots: CalendarSlot[]
  /** Localized day labels, Monday-first (length 7). Days without labels are hidden. */
  dayLabels: ReactNode[]
  /** Highlight column 0–6 (today). */
  todayIndex?: number
  /** Visible day count from Monday (e.g. 5 = Mon–Fri, default 7). */
  days?: number
  /** Grid height in px (default 420). */
  height?: number
  onSelectSlot?: (id: string) => void
  label?: string
  className?: string
}

const SLOT_TINT = {
  primary: 'border-primary/40 bg-primary-soft text-primary-soft-foreground',
  teal: 'border-accent-teal/40 bg-accent-teal-soft text-foreground',
  sunbeam: 'border-accent-sunbeam/40 bg-accent-sunbeam-soft text-foreground',
  coral: 'border-accent-coral/40 bg-accent-coral-soft text-foreground',
  success: 'border-success/40 bg-success-soft text-foreground',
} as const

/**
 * A weekly schedule grid (periods / study slots). Layout math lives in
 * `@bingoo.ai/core` (`layoutWeek`), so web and native position slots identically.
 * Scrolls horizontally when tight — fits 16:9 dashboards and 9:16 phones.
 */
export function ScheduleCalendar({
  slots,
  dayLabels,
  todayIndex,
  days = 7,
  height = 420,
  onSelectSlot,
  label,
  className,
}: ScheduleCalendarProps) {
  const { range, days: cols } = layoutWeek(slots)
  const ticks = hourTicks(range)
  const span = Math.max(1, range[1] - range[0])

  return (
    <div className={cn('w-full max-w-full overflow-x-auto', className)} role="grid" aria-label={label}>
      <div className="flex min-w-[560px] gap-1.5">
        {/* Hour gutter */}
        <div className="relative w-10 shrink-0" style={{ height, marginTop: 28 }}>
          {ticks.map((m) => (
            <span
              key={m}
              className="absolute right-1 -translate-y-1/2 text-2xs tabular-nums text-foreground-subtle"
              style={{ top: `${((m - range[0]) / span) * 100}%` }}
            >
              {formatSlotTime(m)}
            </span>
          ))}
        </div>
        {cols.slice(0, days).map((col, day) => (
          <div key={day} className="flex min-w-0 flex-1 flex-col gap-1">
            <div
              className={cn(
                'grid h-6 place-items-center rounded-full text-xs font-bold',
                day === todayIndex ? 'bg-primary text-primary-foreground' : 'text-foreground-muted',
              )}
            >
              {dayLabels[day]}
            </div>
            <div
              className={cn(
                'relative rounded-xl border border-border',
                day === todayIndex ? 'bg-primary-soft/40' : 'bg-surface-muted/40',
              )}
              style={{ height }}
            >
              {ticks.map((m) => (
                <span
                  key={m}
                  aria-hidden
                  className="absolute left-0 right-0 border-t border-border/60"
                  style={{ top: `${((m - range[0]) / span) * 100}%` }}
                />
              ))}
              {col.map(({ slot, top, height: h }) => {
                const Cell = onSelectSlot ? 'button' : 'div'
                return (
                  <Cell
                    key={slot.id}
                    type={onSelectSlot ? 'button' : undefined}
                    onClick={onSelectSlot ? () => onSelectSlot(slot.id) : undefined}
                    className={cn(
                      'absolute inset-x-0.5 flex flex-col overflow-hidden rounded-lg border px-1.5 py-1 text-left',
                      SLOT_TINT[slot.color ?? 'primary'],
                      onSelectSlot &&
                        'transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    style={{ top: `${top * 100}%`, height: `${h * 100}%` }}
                  >
                    <span className="truncate text-xs font-bold leading-tight">{slot.title}</span>
                    <span className="truncate text-2xs opacity-80">
                      {formatSlotTime(slot.startMin)}–{formatSlotTime(slot.endMin)}
                    </span>
                    {slot.meta ? <span className="truncate text-2xs opacity-70">{slot.meta}</span> : null}
                  </Cell>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
