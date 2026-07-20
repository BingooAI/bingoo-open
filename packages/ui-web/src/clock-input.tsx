'use client'

import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface ClockInputProps {
  hour: number | null
  minute: number | null
  onChange: (hour: number, minute: number) => void
  /** Minute choices to offer (default [0,15,30,45]). */
  minuteOptions?: number[]
  /** After checking: whether correct + the expected time. */
  reveal?: { correct: boolean; hour: number; minute: number }
  /** Localized labels for the minute buttons, e.g. { "0": "o'clock", "30": "half past" }. */
  minuteLabels?: Record<number, string>
  disabled?: boolean
  label?: string
  className?: string
}

const hand = (angleDeg: number, length: number) => {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: 50 + Math.cos(a) * length, y: 50 + Math.sin(a) * length }
}

/**
 * Read/set an analog clock: tap an hour (1–12) and a minute option — the hands
 * move to match. Robust (tap, no drag) and gradable. Grading in `@bingoo/core`.
 */
export function ClockInput({
  hour,
  minute,
  onChange,
  minuteOptions = [0, 15, 30, 45],
  reveal,
  minuteLabels,
  disabled,
  label,
  className,
}: ClockInputProps) {
  const locked = !!reveal || disabled
  const shownHour = reveal ? reveal.hour : hour
  const shownMinute = reveal ? reveal.minute : minute
  const minuteAngle = shownMinute != null ? shownMinute * 6 : null
  // Hour hand advances with the minutes.
  const hourAngle = shownHour != null ? (shownHour % 12) * 30 + (shownMinute ?? 0) * 0.5 : null
  const handTint = reveal ? (reveal.correct ? 'stroke-success' : 'stroke-danger') : 'stroke-primary'

  function pickHour(h: number) {
    if (locked) return
    onChange(h, minute ?? 0)
  }
  function pickMinute(m: number) {
    if (locked) return
    onChange(hour ?? 12, m)
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label} className="w-48 max-w-full">
        <circle cx={50} cy={50} r={47} className="fill-surface stroke-border-strong" strokeWidth={1.5} />
        {Array.from({ length: 12 }, (_, i) => {
          const h = i + 1
          const p = hand(h * 30, 38)
          const active = shownHour != null && shownHour % 12 === h % 12
          return (
            <g key={h} onClick={() => pickHour(h)} className={cn('group', !locked && 'cursor-pointer')}>
              <circle
                cx={p.x}
                cy={p.y}
                r={7}
                className={cn(
                  'duration-2 ease-spring motion-safe:transition-[r,fill,opacity]',
                  active ? 'fill-primary-soft' : 'fill-transparent',
                  !active && !locked && 'group-hover:fill-primary-soft/50',
                )}
              />
              <text
                x={p.x}
                y={p.y + 2.6}
                textAnchor="middle"
                className={cn('font-bold', active ? 'fill-primary' : 'fill-foreground')}
                style={{ fontSize: 7 }}
              >
                {h}
              </text>
            </g>
          )
        })}
        {minuteAngle != null ? (
          <line
            x1={50}
            y1={50}
            x2={hand(minuteAngle, 40).x}
            y2={hand(minuteAngle, 40).y}
            className={handTint}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ) : null}
        {hourAngle != null ? (
          <line
            x1={50}
            y1={50}
            x2={hand(hourAngle, 26).x}
            y2={hand(hourAngle, 26).y}
            className={handTint}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        ) : null}
        <circle
          cx={50}
          cy={50}
          r={2.4}
          className={cn(reveal ? (reveal.correct ? 'fill-success' : 'fill-danger') : 'fill-primary')}
        />
      </svg>
      <div className="flex flex-wrap justify-center gap-2">
        {minuteOptions.map((m, i) => (
          <button
            key={m}
            type="button"
            disabled={locked}
            onClick={() => pickMinute(m)}
            style={stagger(i)}
            className={cn(
              tile({ state: shownMinute === m ? 'selected' : 'idle', size: 'none' }),
              'rounded-full px-3 py-1.5 text-sm font-semibold motion-safe:animate-fade-up',
            )}
          >
            {minuteLabels?.[m] ?? `:${String(m).padStart(2, '0')}`}
          </button>
        ))}
      </div>
    </div>
  )
}
