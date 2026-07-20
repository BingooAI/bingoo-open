'use client'

import type { AngleKind } from '@bingoo.ai/core'
import { Minus, Plus } from 'lucide-react'
import { useRef, type PointerEvent } from 'react'
import { cn } from './lib/cn'
import { POP, SHAKE, stagger, tile, tileState } from './lib/interactive'

export interface AngleLabels {
  acute: string
  right: string
  obtuse: string
  reflex?: string
  straight?: string
  /** e.g. "degrees" */
  unit?: string
}

export interface AngleToolProps {
  task: 'set' | 'estimate' | 'classify'
  /** The angle to MAKE (set) or the angle SHOWN (estimate / classify). */
  angle: number
  /** Controlled response. */
  degrees: number | null
  kind: AngleKind | null
  onChange: (next: { degrees: number | null; kind: AngleKind | null }) => void
  showProtractor?: boolean
  labels: AngleLabels
  reveal?: { correct: boolean; answer: number; kind: AngleKind }
  disabled?: boolean
  className?: string
}

const VX = 50 // vertex
const VY = 78
const R = 46

const pt = (deg: number, r = R) => ({
  x: VX + r * Math.cos((deg * Math.PI) / 180),
  y: VY - r * Math.sin((deg * Math.PI) / 180),
})

/**
 * The "angle maker" / protractor — drag the arm to MAKE an angle, ESTIMATE the
 * size of one that's shown, or NAME it (acute / right / obtuse). Grading (with a
 * degrees tolerance) and `classifyAngle` live in `@bingoo.ai/core`. i18n-free.
 */
export function AngleTool({
  task,
  angle,
  degrees,
  kind,
  onChange,
  showProtractor = true,
  labels,
  reveal,
  disabled,
  className,
}: AngleToolProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const locked = !!reveal || disabled
  const draggable = task === 'set' && !locked

  // Which angle the arm draws: the learner's for 'set', the given one otherwise.
  const armDeg = task === 'set' ? (degrees ?? 0) : angle
  const shown = task === 'set' ? (degrees ?? 0) : task === 'estimate' ? (degrees ?? 0) : angle

  const arm = pt(armDeg)
  const base = pt(0)
  const tone = reveal ? (reveal.correct ? 'stroke-success' : 'stroke-danger') : 'stroke-primary'

  function fromPointer(e: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * 100
    const py = ((e.clientY - rect.top) / rect.height) * 100
    const d = (Math.atan2(VY - py, px - VX) * 180) / Math.PI
    return Math.max(0, Math.min(180, Math.round(d)))
  }
  const drag = (e: PointerEvent<SVGSVGElement>) => {
    if (!draggable || e.buttons === 0) return
    onChange({ degrees: fromPointer(e), kind: null })
  }

  const bump = (d: number) =>
    !locked && onChange({ degrees: Math.max(0, Math.min(359, (degrees ?? 0) + d)), kind: null })

  const KINDS: AngleKind[] = ['acute', 'right', 'obtuse', 'reflex']
  const kindLabel = (k: AngleKind) =>
    k === 'acute'
      ? labels.acute
      : k === 'right'
        ? labels.right
        : k === 'obtuse'
          ? labels.obtuse
          : (labels.reflex ?? k)

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className={cn('w-full max-w-xs', draggable && 'cursor-grab touch-none active:cursor-grabbing')}
        onPointerDown={(e) => {
          if (!draggable) return
          e.currentTarget.setPointerCapture(e.pointerId)
          onChange({ degrees: fromPointer(e), kind: null })
        }}
        onPointerMove={drag}
      >
        {/* protractor scale */}
        {showProtractor ? (
          <>
            <path
              d={`M ${pt(0).x},${pt(0).y} A ${R},${R} 0 0 1 ${pt(180).x},${pt(180).y}`}
              fill="none"
              className="stroke-border-strong"
              strokeWidth={0.6}
            />
            {Array.from({ length: 19 }, (_, i) => i * 10).map((d) => {
              const a = pt(d, R)
              const b = pt(d, d % 30 === 0 ? R - 5 : R - 2.5)
              return (
                <line
                  key={d}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="stroke-border-strong"
                  strokeWidth={0.4}
                />
              )
            })}
            {[0, 30, 60, 90, 120, 150, 180].map((d) => {
              const p = pt(d, R - 9)
              return (
                <text
                  key={d}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground-muted text-[3.5px]"
                >
                  {d}
                </text>
              )
            })}
          </>
        ) : null}

        {/* the angle arc */}
        <path
          d={`M ${pt(0, 14).x},${pt(0, 14).y} A 14,14 0 ${armDeg > 180 ? 1 : 0} 0 ${pt(armDeg, 14).x},${pt(armDeg, 14).y}`}
          fill="none"
          className={tone}
          strokeWidth={1}
        />

        {/* rays */}
        <line
          x1={VX}
          y1={VY}
          x2={base.x}
          y2={base.y}
          className="stroke-foreground"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <line
          x1={VX}
          y1={VY}
          x2={arm.x}
          y2={arm.y}
          className={tone}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <circle cx={VX} cy={VY} r={2} className="fill-foreground" />
        {draggable ? (
          <circle
            cx={arm.x}
            cy={arm.y}
            r={3}
            className="cursor-grab fill-primary motion-safe:transition-[r,fill,opacity] duration-2"
          />
        ) : null}
      </svg>

      {/* readout / inputs */}
      {task === 'classify' ? (
        <div className="flex flex-wrap justify-center gap-2">
          {KINDS.map((k, i) => (
            <button
              key={k}
              type="button"
              disabled={locked}
              onClick={() => onChange({ degrees: null, kind: k })}
              style={stagger(i)}
              className={cn(
                tile({
                  state: tileState({
                    selected: kind === k,
                    revealed: !!reveal,
                    correct: reveal?.correct,
                    missed: reveal?.kind === k,
                  }),
                  size: 'none',
                }),
                'rounded-xl px-4 py-2 font-semibold motion-safe:animate-fade-up',
              )}
            >
              {kindLabel(k)}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {task === 'estimate' && !locked ? (
            <button
              type="button"
              onClick={() => bump(-5)}
              className={cn(tile({ size: 'none' }), 'grid size-9 place-items-center rounded-xl')}
            >
              <Minus className="size-4" />
            </button>
          ) : null}
          <span
            className={cn(
              'inline-block text-2xl font-bold tabular-nums',
              reveal
                ? reveal.correct
                  ? cn('text-success', POP)
                  : cn('text-danger', SHAKE)
                : 'text-foreground',
            )}
          >
            {shown}°
            {labels.unit ? (
              <span className="ml-1 text-sm font-semibold text-foreground-muted">{labels.unit}</span>
            ) : null}
          </span>
          {task === 'estimate' && !locked ? (
            <button
              type="button"
              onClick={() => bump(5)}
              className={cn(tile({ size: 'none' }), 'grid size-9 place-items-center rounded-xl')}
            >
              <Plus className="size-4" />
            </button>
          ) : null}
        </div>
      )}

      {reveal && !reveal.correct ? (
        <span className="text-sm font-semibold text-success">
          → {reveal.answer}° ({kindLabel(reveal.kind)})
        </span>
      ) : null}
    </div>
  )
}
