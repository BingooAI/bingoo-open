'use client'

import { useRef, useState } from 'react'
import { cn } from './lib/cn'
import { POP } from './lib/interactive'

export interface SpinnerSegment {
  id: string
  label: string
  /** Any CSS colour. Falls back to a palette by index. */
  color?: string
}

export interface SpinnerWheelProps {
  segments: SpinnerSegment[]
  /** Fired with the landed segment id after the wheel stops. */
  onResult?: (id: string) => void
  spinLabel?: string
  disabled?: boolean
  className?: string
}

const PALETTE = ['#2e62ec', '#00b9b4', '#ffaf0c', '#f74c6c', '#7c5cff', '#18b862', '#ff7a45', '#22c1c3']

/** Pie-slice path for segment i of n, in a 0–100 viewBox. */
function slice(i: number, n: number, r = 46) {
  const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
  const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
  const x0 = 50 + r * Math.cos(a0)
  const y0 = 50 + r * Math.sin(a0)
  const x1 = 50 + r * Math.cos(a1)
  const y1 = 50 + r * Math.sin(a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M50,50 L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`
}
/** Mid-angle label position for segment i of n. */
function labelAt(i: number, n: number, r = 30) {
  const a = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) }
}

/**
 * Chance spinner — a segmented wheel the learner spins to run a probability
 * experiment (Stage 3 "Chance"). It's a MANIPULATIVE, not a graded question:
 * it reports the landed segment so the caller can tally results. i18n-free.
 */
export function SpinnerWheel({ segments, onResult, spinLabel, disabled, className }: SpinnerWheelProps) {
  const n = segments.length
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [landed, setLanded] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  function spin() {
    if (disabled || spinning || n === 0) return
    setSpinning(true)
    setLanded(null)
    const pick = Math.floor(Math.random() * n)
    // Land the pointer (at top) in the middle of the picked segment.
    const segMid = ((pick + 0.5) / n) * 360
    const turns = 4 + Math.floor(Math.random() * 3)
    const next = angle + turns * 360 + ((360 - segMid - (angle % 360) + 360) % 360)
    setAngle(next)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setSpinning(false)
      setLanded(segments[pick]!.id)
      onResult?.(segments[pick]!.id)
    }, 2600)
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative aspect-square w-56 max-w-full">
        {/* Pointer */}
        <div className="absolute left-1/2 top-0 z-10 size-0 -translate-x-1/2 border-x-8 border-t-[14px] border-x-transparent border-t-danger" />
        <svg
          viewBox="0 0 100 100"
          className="size-full transition-transform duration-[2500ms] ease-out"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {segments.map((s, i) => (
            <path
              key={s.id}
              d={slice(i, n)}
              fill={s.color ?? PALETTE[i % PALETTE.length]}
              stroke="white"
              strokeWidth={0.8}
            />
          ))}
          {segments.map((s, i) => {
            const p = labelAt(i, n)
            return (
              <text
                key={s.id}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-white text-[7px] font-bold"
              >
                {s.label}
              </text>
            )
          })}
          <circle cx={50} cy={50} r={5} className="fill-surface stroke-border-strong" strokeWidth={1} />
        </svg>
      </div>

      <button
        type="button"
        disabled={disabled || spinning}
        onClick={spin}
        className="rounded-xl bg-primary px-5 py-2 font-bold text-primary-foreground outline-none transition-[transform,background-color] duration-2 ease-spring hover:bg-primary-hover disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring motion-safe:active:scale-[0.97]"
      >
        {spinLabel ?? 'Spin'}
      </button>

      {landed ? (
        <span className={cn('text-lg font-bold text-foreground', POP)}>
          {segments.find((s) => s.id === landed)?.label}
        </span>
      ) : null}
    </div>
  )
}
