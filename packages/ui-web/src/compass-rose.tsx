// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { COMPASS_DIRECTIONS, type CompassDirection } from '@bingoo.ai/core'
import { cn } from './lib/cn'
import { stagger, tile, tileState } from './lib/interactive'

export interface CompassPlace {
  id: string
  label: string
  x: number
  y: number
  emoji?: string
}

export interface CompassRoseProps {
  maxX: number
  maxY: number
  places: CompassPlace[]
  /** Where you start (drawn ringed) and where you are going (drawn with a route). */
  from: string
  to: string
  value: CompassDirection | null
  onChange: (dir: CompassDirection) => void
  reveal?: { correct: boolean; answer: CompassDirection | null }
  disabled?: boolean
  className?: string
}

const A: Record<CompassDirection, number> = {
  N: 90,
  NE: 45,
  E: 0,
  SE: -45,
  S: -90,
  SW: -135,
  W: 180,
  NW: 135,
}

/**
 * 8-point compass — read a small map, then name the direction from one place to another.
 * The answer is derived from the map's geometry in `@bingoo.ai/core`, so it cannot drift.
 * i18n-free: the rose is labelled with the standard N/NE/E… abbreviations.
 */
export function CompassRose({
  maxX,
  maxY,
  places,
  from,
  to,
  value,
  onChange,
  reveal,
  disabled,
  className,
}: CompassRoseProps) {
  const locked = !!reveal || disabled
  const start = places.find((p) => p.id === from)
  const end = places.find((p) => p.id === to)

  const S = 100
  const pad = 8
  const gx = (x: number) => pad + (x / maxX) * (S - 2 * pad)
  const gy = (y: number) => S - pad - (y / maxY) * (S - 2 * pad)

  return (
    <div className={cn('flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8', className)}>
      {/* the map */}
      <svg
        viewBox="0 0 100 100"
        className="w-full max-w-[280px] rounded-xl border-2 border-border bg-surface-muted"
      >
        {Array.from({ length: maxX + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={gx(i)}
            y1={gy(0)}
            x2={gx(i)}
            y2={gy(maxY)}
            className="stroke-border"
            strokeWidth={0.3}
          />
        ))}
        {Array.from({ length: maxY + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={gx(0)}
            y1={gy(i)}
            x2={gx(maxX)}
            y2={gy(i)}
            className="stroke-border"
            strokeWidth={0.3}
          />
        ))}

        {start && end ? (
          <line
            x1={gx(start.x)}
            y1={gy(start.y)}
            x2={gx(end.x)}
            y2={gy(end.y)}
            className="stroke-primary"
            strokeWidth={0.8}
            strokeDasharray="2 1.5"
          />
        ) : null}

        {places.map((p) => {
          const isStart = p.id === from
          const isEnd = p.id === to
          return (
            <g key={p.id}>
              <circle
                cx={gx(p.x)}
                cy={gy(p.y)}
                r={isStart || isEnd ? 3 : 2}
                className={cn(
                  isStart && 'fill-primary',
                  isEnd && 'fill-warning',
                  !isStart && !isEnd && 'fill-foreground-subtle',
                )}
              />
              {p.emoji ? (
                <text x={gx(p.x)} y={gy(p.y) + 1.6} textAnchor="middle" className="text-[4px]">
                  {p.emoji}
                </text>
              ) : null}
              <text
                x={gx(p.x)}
                y={gy(p.y) - 4}
                textAnchor="middle"
                className={cn(
                  'text-[3.4px] font-bold',
                  isStart || isEnd ? 'fill-foreground' : 'fill-foreground-muted',
                )}
              >
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* the rose */}
      <div className="relative size-[190px] shrink-0">
        <div className="absolute inset-[30%] rounded-full border-2 border-border-strong bg-surface" />
        {COMPASS_DIRECTIONS.map((d, i) => {
          const rad = (A[d] * Math.PI) / 180
          return (
            // The centring translate sits on a wrapper so the tile's hover lift
            // (a transform too) cannot knock the point off its bearing.
            <div
              key={d}
              style={{
                left: `${50 + 39 * Math.cos(rad)}%`,
                top: `${50 - 39 * Math.sin(rad)}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <button
                type="button"
                disabled={locked}
                onClick={() => onChange(d)}
                style={stagger(i)}
                className={cn(
                  tile({
                    state: tileState({
                      selected: value === d,
                      revealed: !!reveal,
                      correct: reveal?.correct,
                      missed: reveal?.answer === d,
                    }),
                    size: 'none',
                  }),
                  'size-11 rounded-full text-xs font-bold motion-safe:animate-fade-up',
                )}
              >
                {d}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
