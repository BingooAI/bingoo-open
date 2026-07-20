'use client'

import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface RouteGridProps {
  rows: number
  cols: number
  start: string
  target: string
  blocked?: string[]
  startEmoji?: string
  targetEmoji?: string
  /** Controlled path of cells "r-c" (includes start). */
  path: string[]
  onChange: (path: string[]) => void
  reveal?: { correct: boolean; target: string; solution: string[] }
  disabled?: boolean
  className?: string
}

const rc = (k: string): [number, number] => {
  const s = k.split('-')
  return [Number(s[0]), Number(s[1])]
}
const adjacent = (a: string, b: string) => {
  const [ar, ac] = rc(a)
  const [br, bc] = rc(b)
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1
}

/**
 * Draw a route through a grid maze — tap cells next to the path to extend it from
 * start to target; tap a path cell to backtrack. Grading (a valid contiguous path)
 * in `@bingoo/core`. Tap-based → web + mobile. i18n-free.
 */
export function RouteGrid({
  rows,
  cols,
  start,
  target,
  blocked = [],
  startEmoji,
  targetEmoji,
  path,
  onChange,
  reveal,
  disabled,
  className,
}: RouteGridProps) {
  const locked = !!reveal || disabled
  const eff = path.length ? path : [start]
  const blockedSet = new Set(blocked)
  const idxIn = (k: string) => eff.indexOf(k)
  const solution = new Set(reveal && !reveal.correct ? reveal.solution : [])
  // A big maze should just be there; only a small one is worth walking in cell by cell.
  const staggered = rows * cols <= 40

  function tap(k: string) {
    if (locked || blockedSet.has(k)) return
    const i = idxIn(k)
    if (i >= 0) {
      onChange(eff.slice(0, Math.max(1, i + 1))) // backtrack (keep start)
      return
    }
    const last = eff[eff.length - 1]!
    if (adjacent(last, k)) onChange([...eff, k])
  }

  return (
    <div className={cn('flex justify-center', className)}>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const k = `${r}-${c}`
            const isStart = k === start
            const isTarget = k === target
            const onPath = idxIn(k) >= 0
            const isBlocked = blockedSet.has(k)
            const inSol = solution.has(k)
            const state = isBlocked
              ? 'quiet'
              : onPath
                ? reveal
                  ? reveal.correct
                    ? 'correct'
                    : 'wrong'
                  : 'selected'
                : inSol
                  ? 'ghost'
                  : 'idle'
            return (
              <button
                key={k}
                type="button"
                disabled={locked || isBlocked}
                aria-label={k}
                onClick={() => tap(k)}
                style={staggered ? stagger(r * cols + c) : undefined}
                className={cn(
                  tile({ state, size: 'none' }),
                  'grid size-10 place-items-center rounded-md text-lg leading-none',
                  // A wall stays a wall — muted is not dark enough to read as impassable.
                  isBlocked && 'border-border-strong bg-foreground-subtle/30',
                  // The entrance steps aside once the reveal has its own pop/shake to play.
                  staggered && !reveal && 'motion-safe:animate-fade-up',
                )}
              >
                {isStart ? (startEmoji ?? '🐢') : isTarget ? (targetEmoji ?? '🏁') : null}
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}
