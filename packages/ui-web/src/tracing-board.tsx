// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import {
  appendPoint,
  pointsToSvgPath,
  scoreTracedStroke,
  type DrawPoint,
  type StrokeScore,
  type TracingGlyph,
} from '@bingoo.ai/core'
import { useRef, useState, type PointerEvent } from 'react'
import { cn } from './lib/cn'
import { POP, SHAKE } from './lib/interactive'

export interface TracingBoardProps {
  glyph: TracingGlyph
  /** Ink color for accepted strokes. */
  inkColor?: string
  /** Coverage tolerance in viewBox units (bigger = more forgiving; preschool ≈ 8–10). */
  tolerance?: number
  onStrokeResult?: (strokeIndex: number, score: StrokeScore) => void
  /** Fired once when every stroke is traced. */
  onComplete?: (scores: StrokeScore[]) => void
  disabled?: boolean
  label?: string
  className?: string
}

/**
 * Letter/shape tracing (tô chữ): the glyph's guide strokes show as dashed paths;
 * the child traces the highlighted stroke from the start dot. Scoring
 * (`scoreTracedStroke`) lives in `@bingoo.ai/core` — a failed attempt shakes and
 * clears, a passed one is inked and the next stroke lights up.
 */
export function TracingBoard({
  glyph,
  inkColor = '#2e62ec',
  tolerance = 8,
  onStrokeResult,
  onComplete,
  disabled,
  label,
  className,
}: TracingBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [current, setCurrent] = useState(0)
  const [accepted, setAccepted] = useState<DrawPoint[][]>([])
  const [scores, setScores] = useState<StrokeScore[]>([])
  const [attempt, setAttempt] = useState<DrawPoint[] | null>(null)
  const [wrong, setWrong] = useState(false)
  const done = current >= glyph.strokes.length

  function toCanvas(e: PointerEvent): DrawPoint {
    const rect = svgRef.current!.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100]
  }

  function down(e: PointerEvent<SVGSVGElement>) {
    if (disabled || done) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setWrong(false)
    setAttempt([toCanvas(e)])
  }

  function move(e: PointerEvent<SVGSVGElement>) {
    if (!attempt) return
    setAttempt(appendPoint(attempt, toCanvas(e)))
  }

  function up() {
    if (!attempt) return
    const guide = glyph.strokes[current]!.points as DrawPoint[]
    const score = scoreTracedStroke(guide, attempt, tolerance)
    onStrokeResult?.(current, score)
    if (score.passed) {
      const nextAccepted = [...accepted, attempt]
      const nextScores = [...scores, score]
      setAccepted(nextAccepted)
      setScores(nextScores)
      const next = current + 1
      setCurrent(next)
      if (next >= glyph.strokes.length) onComplete?.(nextScores)
    } else {
      setWrong(true)
    }
    setAttempt(null)
  }

  const activeGuide = !done ? (glyph.strokes[current]!.points as DrawPoint[]) : null
  const startDot = activeGuide?.[0]
  const endDot = activeGuide?.[activeGuide.length - 1]

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label ?? glyph.label}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setAttempt(null)}
      className={cn(
        'aspect-square w-full touch-none rounded-2xl border-2 border-border bg-surface',
        wrong && SHAKE,
        disabled && 'opacity-60',
        className,
      )}
    >
      {/* All guide strokes, faint. */}
      {glyph.strokes.map((s, i) => (
        <path
          key={`g${i}`}
          d={pointsToSvgPath(s.points as DrawPoint[])}
          fill="none"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0.1 11"
          className="stroke-border-strong"
        />
      ))}
      {/* Active guide stroke, highlighted. */}
      {activeGuide ? (
        <path
          d={pointsToSvgPath(activeGuide)}
          fill="none"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0.1 9"
          className="stroke-primary"
        />
      ) : null}
      {/* Accepted ink. */}
      {accepted.map((points, i) => (
        <path
          key={`a${i}`}
          d={pointsToSvgPath(points)}
          fill="none"
          stroke={inkColor}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/* In-progress attempt. */}
      {attempt ? (
        <path
          d={pointsToSvgPath(attempt)}
          fill="none"
          stroke={inkColor}
          strokeOpacity={0.75}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {/* Start (pulsing) + end dots for the active stroke. */}
      {startDot ? (
        <circle cx={startDot[0]} cy={startDot[1]} r={4} className="fill-primary motion-safe:animate-pulse" />
      ) : null}
      {endDot ? <circle cx={endDot[0]} cy={endDot[1]} r={2.5} className="fill-primary/50" /> : null}
      {/* The finished stamp lands with a pop — the one moment worth celebrating. */}
      {done ? <circle cx={92} cy={8} r={6} className={cn('fill-success', POP)} /> : null}
    </svg>
  )
}
