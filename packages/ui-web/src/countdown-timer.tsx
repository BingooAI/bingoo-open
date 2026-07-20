// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { countdownParts } from '@bingoo.ai/core'
import { useEffect, useRef, useState } from 'react'
import { cn } from './lib/cn'
import { hudSurfaceClass } from './lib/hud'

export interface CountdownLabels {
  days?: string
  hours?: string
  minutes?: string
  seconds?: string
}

export interface CountdownTimerProps {
  /** Target time as an epoch-ms timestamp. */
  deadline: number
  /** Unit labels under each segment (data); omit for compact d/h/m/s letters off. */
  labels?: CountdownLabels
  /** Hide the days segment (for short challenges). */
  hideDays?: boolean
  onComplete?: () => void
  onMedia?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const SIZE = {
  sm: { box: 'min-w-8 px-1.5 py-1 text-base', unit: 'text-[10px]' },
  md: { box: 'min-w-10 px-2 py-1.5 text-xl', unit: 'text-[11px]' },
  lg: { box: 'min-w-12 px-2.5 py-2 text-2xl', unit: 'text-xs' },
} as const

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * A ticking countdown (d/h/m/s) for challenges, arena rounds, or limited events.
 * Self-ticking + SSR-safe (renders after mount). Breakdown from `@bingoo.ai/core`.
 */
export function CountdownTimer({
  deadline,
  labels,
  hideDays,
  onComplete,
  onMedia,
  size = 'md',
  label,
  className,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
    const update = () => {
      const ms = Math.max(0, deadline - Date.now())
      setRemaining(ms)
      if (ms === 0 && !firedRef.current) {
        firedRef.current = true
        onComplete?.()
      }
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [deadline, onComplete])

  const p = countdownParts(remaining ?? 0)
  const sz = SIZE[size]
  const ink = onMedia ? 'text-white' : 'text-foreground'
  const muted = onMedia ? 'text-white/70' : 'text-foreground-muted'

  const segments = [
    !hideDays ? { value: p.days, unit: labels?.days } : null,
    { value: p.hours, unit: labels?.hours },
    { value: p.minutes, unit: labels?.minutes },
    { value: p.seconds, unit: labels?.seconds },
  ].filter(Boolean) as { value: number; unit?: string }[]

  return (
    <div aria-label={label} className={cn('inline-flex items-end gap-1.5', className)}>
      {segments.map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <span
            className={cn(
              'grid place-items-center rounded-xl text-center font-display font-extrabold tabular-nums',
              sz.box,
              hudSurfaceClass(onMedia),
              ink,
            )}
          >
            {pad(s.value)}
          </span>
          {s.unit ? <span className={cn('font-semibold uppercase', sz.unit, muted)}>{s.unit}</span> : null}
        </div>
      ))}
    </div>
  )
}
