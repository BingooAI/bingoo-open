'use client'

import { appendPoint, pointsToSvgPath, type DrawPoint, type DrawStroke } from '@bingoo.ai/core'
import { useRef, useState, type PointerEvent } from 'react'
import { cn } from './lib/cn'

export interface DrawingCanvasProps {
  /** Committed strokes (controlled — undo/clear by slicing this array). */
  strokes: DrawStroke[]
  onStrokesChange: (strokes: DrawStroke[]) => void
  /** Paint for the next stroke. */
  color: string
  /** Brush width in viewBox units (0–100 space). */
  brushWidth?: number
  disabled?: boolean
  /** A11y label (data). */
  label?: string
  className?: string
}

/**
 * Free-drawing canvas (vẽ tự do): pointer strokes over a 0–100 SVG viewBox.
 * Geometry/smoothing/export live in `@bingoo.ai/core` (`strokesToSvg`), so the
 * native twin draws identically. Controlled: undo = drop the last stroke.
 */
export function DrawingCanvas({
  strokes,
  onStrokesChange,
  color,
  brushWidth = 3.5,
  disabled,
  label,
  className,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [draft, setDraft] = useState<DrawPoint[] | null>(null)

  function toCanvas(e: PointerEvent): DrawPoint {
    const rect = svgRef.current!.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100]
  }

  function down(e: PointerEvent<SVGSVGElement>) {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraft([toCanvas(e)])
  }

  function move(e: PointerEvent<SVGSVGElement>) {
    if (disabled || !draft) return
    setDraft(appendPoint(draft, toCanvas(e)))
  }

  function up() {
    if (!draft) return
    if (draft.length > 0) onStrokesChange([...strokes, { points: draft, color, width: brushWidth }])
    setDraft(null)
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDraft(null)}
      className={cn(
        'aspect-square w-full touch-none rounded-2xl border-2 border-border bg-surface',
        disabled ? 'opacity-60' : 'cursor-crosshair',
        className,
      )}
    >
      {strokes.map((s, i) => (
        <path
          key={i}
          d={pointsToSvgPath(s.points)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {draft ? (
        <path
          d={pointsToSvgPath(draft)}
          fill="none"
          stroke={color}
          strokeWidth={brushWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  )
}
