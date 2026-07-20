'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from './lib/cn'
import { tile } from './lib/interactive'

export interface DigitalClockProps {
  mode?: '12h' | '24h'
  /** Controlled. */
  hour: number | null
  minute: number | null
  onChange: (hour: number, minute: number) => void
  /** Minute increment for the ± buttons (default 5). */
  minuteStep?: number
  reveal?: { correct: boolean; hour: number; minute: number }
  disabled?: boolean
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Set a digital clock (HH:MM) with ▲▼ steppers. 12h wraps 1–12, 24h wraps 0–23.
 * Grading (hour & minute) in `@bingoo/core`. i18n-free.
 */
export function DigitalClock({
  mode = '12h',
  hour,
  minute,
  onChange,
  minuteStep = 5,
  reveal,
  disabled,
  className,
}: DigitalClockProps) {
  const locked = !!reveal || disabled
  const h = hour ?? (mode === '12h' ? 12 : 0)
  const m = minute ?? 0
  const hMin = mode === '12h' ? 1 : 0
  const hMax = mode === '12h' ? 12 : 23
  const span = hMax - hMin + 1

  const bumpH = (d: number) => !locked && onChange(((h - hMin + d + span) % span) + hMin, m)
  const bumpM = (d: number) => !locked && onChange(h, (m + d * minuteStep + 60) % 60)

  const tone = reveal ? (reveal.correct ? 'text-success' : 'text-danger') : 'text-foreground'
  const key = cn(tile({ size: 'none' }), 'grid size-8 place-items-center rounded-lg text-foreground-muted')

  const stepper = (label: string, val: number, onUp: () => void, onDown: () => void) => (
    <div className="flex flex-col items-center gap-1">
      <button type="button" disabled={locked} aria-label={`${label} +`} onClick={onUp} className={key}>
        <ChevronUp className="size-5" />
      </button>
      <span className={cn('w-14 text-center font-mono text-4xl font-bold tabular-nums', tone)}>
        {pad(val)}
      </span>
      <button type="button" disabled={locked} aria-label={`${label} −`} onClick={onDown} className={key}>
        <ChevronDown className="size-5" />
      </button>
    </div>
  )

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className={cn(
          tile({
            state: reveal ? (reveal.correct ? 'correct' : 'wrong') : 'quiet',
            size: 'none',
          }),
          'flex items-center gap-1 px-4 py-3',
        )}
      >
        {stepper(
          'hour',
          hour == null ? h : h,
          () => bumpH(1),
          () => bumpH(-1),
        )}
        <span className={cn('pb-1 font-mono text-4xl font-bold', tone)}>:</span>
        {stepper(
          'minute',
          minute == null ? m : m,
          () => bumpM(1),
          () => bumpM(-1),
        )}
      </div>
      {reveal && !reveal.correct ? (
        <span className="text-sm font-semibold text-success">
          → {pad(reveal.hour)}:{pad(reveal.minute)}
        </span>
      ) : null}
    </div>
  )
}
