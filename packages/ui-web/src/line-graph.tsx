// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { cn } from './lib/cn'
import { POP, SHAKE } from './lib/interactive'

export interface LineGraphProps {
  /** line = join the points. dot = a dot plot (same data, no joining line). */
  style?: 'line' | 'dot'
  xLabels: string[]
  maxY: number
  /** Gridline interval on the y-axis (display only — any whole value can be plotted). */
  stepY?: number
  /** Controlled: the y value plotted for each x (null = not plotted yet). */
  values: Array<number | null>
  onChange: (values: Array<number | null>) => void
  xTitle?: string
  yTitle?: string
  reveal?: { correct: boolean; marks: boolean[]; answer: number[] }
  disabled?: boolean
  className?: string
}

/**
 * Line graph / dot plot — tap a height in each column to plot that x's value; the
 * points join into a line (or stay as dots). Values may sit BETWEEN gridlines, as
 * they do in the books. Grading in `@bingoo.ai/core`. Tap-based → web + mobile.
 */
export function LineGraph({
  style = 'line',
  xLabels,
  maxY,
  stepY = 1,
  values,
  onChange,
  xTitle,
  yTitle,
  reveal,
  disabled,
  className,
}: LineGraphProps) {
  const locked = !!reveal || disabled
  const L = 16 // left padding for the y labels
  const B = 14 // bottom padding for the x labels
  const px = (i: number) => L + ((i + 0.5) / xLabels.length) * (100 - L - 4)
  const py = (v: number) => 100 - B - (v / maxY) * (100 - B - 6)

  const set = (i: number, v: number) => {
    if (locked) return
    const next = [...values]
    while (next.length < xLabels.length) next.push(null)
    next[i] = next[i] === v ? null : v
    onChange(next)
  }

  const gridlines = Array.from({ length: Math.floor(maxY / stepY) + 1 }, (_, k) => k * stepY)
  const plotted = xLabels.map((_, i) => values[i])
  const polyline = plotted
    .map((v, i) => (v == null ? null : `${px(i)},${py(v)}`))
    .filter((s): s is string => s !== null)
    .join(' ')

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {yTitle ? (
        <span className="self-start text-2xs font-semibold uppercase text-foreground-subtle">{yTitle}</span>
      ) : null}
      <svg viewBox="0 0 100 100" className="w-full max-w-md">
        {/* gridlines + y labels */}
        {gridlines.map((v) => (
          <g key={v}>
            <line x1={L} y1={py(v)} x2={98} y2={py(v)} className="stroke-border" strokeWidth={0.3} />
            <text x={L - 2} y={py(v) + 1.2} textAnchor="end" className="fill-foreground-muted text-[3.2px]">
              {v}
            </text>
          </g>
        ))}
        {/* axes */}
        <line x1={L} y1={py(0)} x2={98} y2={py(0)} className="stroke-foreground" strokeWidth={0.7} />
        <line x1={L} y1={py(0)} x2={L} y2={py(maxY) - 3} className="stroke-foreground" strokeWidth={0.7} />

        {/* tap targets: every whole value in every column */}
        {!locked
          ? xLabels.map((_, i) =>
              Array.from({ length: maxY + 1 }, (_, v) => (
                <circle
                  key={`t${i}-${v}`}
                  cx={px(i)}
                  cy={py(v)}
                  r={2.4}
                  fill="transparent"
                  className="cursor-pointer hover:fill-primary/25 motion-safe:transition-[r,fill,opacity] duration-2"
                  onClick={() => set(i, v)}
                />
              )),
            )
          : null}

        {/* the joining line */}
        {style === 'line' && polyline.split(' ').length > 1 ? (
          <polyline
            points={polyline}
            fill="none"
            className={cn(reveal ? (reveal.correct ? 'stroke-success' : 'stroke-danger') : 'stroke-primary')}
            strokeWidth={1}
          />
        ) : null}

        {/* plotted points */}
        {xLabels.map((_, i) => {
          const v = plotted[i]
          const ok = reveal?.marks[i]
          if (v == null) {
            // when revealed, show where it should have been
            return reveal ? (
              <circle
                key={`a${i}`}
                cx={px(i)}
                cy={py(reveal.answer[i]!)}
                r={1.6}
                className="fill-none stroke-success"
                strokeWidth={0.6}
                strokeDasharray="1 0.8"
              />
            ) : null
          }
          return (
            <g key={`p${i}`} className={cn(ok === true && POP, ok === false && SHAKE)}>
              <circle
                cx={px(i)}
                cy={py(v)}
                r={1.8}
                className={cn(ok === undefined ? 'fill-primary' : ok ? 'fill-success' : 'fill-danger')}
              />
              {reveal && ok === false ? (
                <circle
                  cx={px(i)}
                  cy={py(reveal.answer[i]!)}
                  r={1.6}
                  className="fill-none stroke-success"
                  strokeWidth={0.6}
                  strokeDasharray="1 0.8"
                />
              ) : null}
            </g>
          )
        })}

        {/* x labels */}
        {xLabels.map((lb, i) => (
          <text
            key={lb + i}
            x={px(i)}
            y={py(0) + 5}
            textAnchor="middle"
            className="fill-foreground-muted text-[3px]"
          >
            {lb}
          </text>
        ))}
      </svg>
      {xTitle ? (
        <span className="text-2xs font-semibold uppercase text-foreground-subtle">{xTitle}</span>
      ) : null}
    </div>
  )
}
