'use client'

import { cn } from './lib/cn'
import { tile, tileState } from './lib/interactive'

export interface ScaleReaderProps {
  shape?: 'thermometer' | 'dial'
  min: number
  max: number
  step?: number
  /** Controlled reading. */
  value: number | null
  onChange: (value: number) => void
  unitLabel?: string
  reveal?: { correct: boolean; answer: number }
  disabled?: boolean
  className?: string
}

function ticks(min: number, max: number, step: number) {
  const out: number[] = []
  for (let v = min; v <= max; v += step) out.push(v)
  return out
}
/** Position on a 270° gauge arc (bottom-left → bottom-right), in 0–100 space. */
function dialAt(v: number, min: number, max: number, radius = 38) {
  const frac = (v - min) / (max - min || 1)
  const a = (-135 + frac * 270) * (Math.PI / 180) - Math.PI / 2
  return { x: 50 + radius * Math.cos(a), y: 50 + radius * Math.sin(a) }
}

/**
 * Read a graduated scale — a thermometer (vertical) or a dial gauge. Tap a tick to
 * set the reading. Grading (value === answer) in `@bingoo/core`. i18n-free.
 */
export function ScaleReader({
  shape = 'thermometer',
  min,
  max,
  step = 1,
  value,
  onChange,
  unitLabel,
  reveal,
  disabled,
  className,
}: ScaleReaderProps) {
  const locked = !!reveal || disabled
  const vals = ticks(min, max, step)
  const tone = reveal ? (reveal.correct ? 'text-success' : 'text-danger') : 'text-primary'
  const fillClass = reveal ? (reveal.correct ? 'bg-success' : 'bg-danger') : 'bg-accent-coral'

  if (shape === 'dial') {
    const sel = value != null ? dialAt(value, min, max) : null
    return (
      <div className={cn('mx-auto aspect-square w-56 max-w-full', className)}>
        <div className="relative size-full">
          <div className="absolute inset-[8%] rounded-full border-2 border-border" />
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            {sel ? (
              <line
                x1={50}
                y1={50}
                x2={sel.x}
                y2={sel.y}
                className={cn(
                  reveal ? (reveal.correct ? 'stroke-success' : 'stroke-danger') : 'stroke-primary',
                )}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ) : null}
            <circle cx={50} cy={50} r={3.5} className="fill-foreground-muted" />
          </svg>
          {vals.map((v) => {
            const p = dialAt(v, min, max)
            const on = value === v
            const isAns = reveal?.answer === v
            return (
              // The seat holds the tick's place on the arc; the tile inside is then free to
              // lift and press without fighting the -50%/-50% centring transform.
              <span
                key={v}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onChange(v)}
                  className={cn(
                    tile({
                      state: tileState({
                        selected: on,
                        revealed: !!reveal,
                        correct: reveal?.correct,
                        missed: isAns,
                      }),
                      size: 'none',
                    }),
                    'grid size-8 place-items-center rounded-full text-2xs font-bold tabular-nums',
                  )}
                >
                  {v}
                </button>
              </span>
            )
          })}
          {unitLabel ? (
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs font-semibold text-foreground-muted">
              {unitLabel}
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  // Thermometer
  const pct = value != null ? ((value - min) / (max - min || 1)) * 100 : 0
  return (
    <div className={cn('flex items-end justify-center gap-4', className)}>
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'relative flex h-56 w-8 flex-col justify-end rounded-full border-border-strong p-1',
        )}
      >
        <div
          className={cn('w-full rounded-full transition-[height] duration-500', fillClass)}
          style={{ height: `${pct}%` }}
        />
        <div
          className={cn(
            'absolute -bottom-1 left-1/2 size-7 -translate-x-1/2 rounded-full border-2 border-border-strong',
            fillClass,
          )}
        />
      </div>
      <div className="flex h-56 flex-col-reverse justify-between py-1">
        {vals.map((v) => {
          const on = value === v
          const isAns = reveal?.answer === v
          return (
            <button
              key={v}
              type="button"
              disabled={locked}
              onClick={() => onChange(v)}
              className={cn(
                tile({
                  state: tileState({
                    selected: on,
                    revealed: !!reveal,
                    correct: reveal?.correct,
                    missed: isAns,
                  }),
                  size: 'none',
                }),
                'flex items-center gap-1.5 rounded-md px-1.5 text-xs font-bold tabular-nums',
              )}
            >
              <span className="h-0.5 w-2 bg-border-strong" />
              {v}
              {unitLabel && v === max ? (
                <span className="text-2xs font-normal text-foreground-muted">{unitLabel}</span>
              ) : null}
            </button>
          )
        })}
      </div>
      {value != null ? (
        <span className={cn('self-center text-lg font-bold tabular-nums', tone)}>
          {value}
          {unitLabel}
        </span>
      ) : null}
    </div>
  )
}
