'use client'

import type { DrawStroke, RubricCriterion } from '@bingoo.ai/core'
import { Eraser, Undo2 } from 'lucide-react'
import { cn } from './lib/cn'
import { POP, tile } from './lib/interactive'
import { DrawingCanvas } from './drawing-canvas'
import { RubricList } from './rubric-list'

export interface DrawingLabels {
  criteria: string
  undo: string
  clear: string
  exemplar?: string
}

export interface DrawingPadProps {
  strokes: DrawStroke[]
  met: string[]
  onChange: (next: { strokes: DrawStroke[]; met: string[] }) => void
  criteria: RubricCriterion[]
  /** A picture to draw FROM (shown beside the canvas). */
  referenceImage?: string
  color?: string
  labels: DrawingLabels
  reveal?: { correct: boolean; need: number; exemplarImage?: string }
  disabled?: boolean
  className?: string
}

/**
 * Draw the answer (vẽ tự do) — the single most common workbook instruction. No machine
 * can mark a drawing, so the learner ticks the success criteria against their own work
 * (`RubricList`); grading lives in `@bingoo.ai/core`. The model drawing appears on reveal.
 */
export function DrawingPad({
  strokes,
  met,
  onChange,
  criteria,
  referenceImage,
  color = '#2e62ec',
  labels,
  reveal,
  disabled,
  className,
}: DrawingPadProps) {
  const locked = !!reveal || disabled

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <RubricList
        criteria={criteria}
        met={met}
        onChange={(next) => onChange({ strokes, met: next })}
        title={labels.criteria}
        need={reveal?.need}
        reveal={reveal ? { correct: reveal.correct } : undefined}
        disabled={disabled}
      />

      <div className="flex flex-wrap items-start justify-center gap-3">
        {referenceImage ? (
          <img
            src={referenceImage}
            alt=""
            className="size-40 rounded-2xl border-2 border-border object-cover"
          />
        ) : null}

        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              tile({
                state: reveal ? (reveal.correct ? 'correct' : 'wrong') : 'quiet',
                size: 'none',
              }),
              'overflow-hidden',
            )}
          >
            <DrawingCanvas
              strokes={strokes}
              onStrokesChange={(next) => onChange({ strokes: next, met })}
              color={color}
              disabled={locked}
              className="size-64"
            />
          </div>

          {!locked ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ strokes: strokes.slice(0, -1), met })}
                disabled={strokes.length === 0}
                className={cn(
                  tile({ size: 'none' }),
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-foreground-muted',
                )}
              >
                <Undo2 className="size-4" /> {labels.undo}
              </button>
              <button
                type="button"
                onClick={() => onChange({ strokes: [], met })}
                disabled={strokes.length === 0}
                className={cn(
                  tile({ size: 'none' }),
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-foreground-muted hover:border-danger',
                )}
              >
                <Eraser className="size-4" /> {labels.clear}
              </button>
            </div>
          ) : null}
        </div>

        {reveal?.exemplarImage ? (
          <div className="flex flex-col items-center gap-1">
            {labels.exemplar ? (
              <p className="text-xs font-bold uppercase tracking-wide text-success">{labels.exemplar}</p>
            ) : null}
            <img
              src={reveal.exemplarImage}
              alt=""
              className={cn('size-40 rounded-2xl border-2 border-success object-cover', POP)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
