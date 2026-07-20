'use client'

import { solveWordSearch } from '@bingoo.ai/core'
import { useState } from 'react'
import { cn } from './lib/cn'
import { tile } from './lib/interactive'

export interface WordSearchProps {
  /** Grid rows; each a string of letters, all the same length. */
  rows: string[]
  /** Words to find (any straight line, forward or backward). */
  words: string[]
  /** Controlled answer: the words found so far (uppercased). */
  found: string[]
  onChange: (found: string[]) => void
  /** After checking: the target words + which were found. */
  reveal?: { words: string[]; found: string[] }
  disabled?: boolean
  className?: string
}

type Cell = { r: number; c: number }
const key = (c: Cell) => `${c.r},${c.c}`

/** The straight line of cells from a→b (row, column or 45° diagonal), else null. */
function lineCells(a: Cell, b: Cell): Cell[] | null {
  const dr = b.r - a.r
  const dc = b.c - a.c
  const adr = Math.abs(dr)
  const adc = Math.abs(dc)
  if (!(dr === 0 || dc === 0 || adr === adc)) return null
  const steps = Math.max(adr, adc)
  const sr = Math.sign(dr)
  const sc = Math.sign(dc)
  return Array.from({ length: steps + 1 }, (_, k) => ({ r: a.r + sr * k, c: a.c + sc * k }))
}

/**
 * Word search — tap the first and last letter of a hidden word; the straight
 * line between them is read and, if it spells a target word (either direction),
 * it's marked found. Tap (not drag) → no scroll conflict on mobile. i18n-free.
 */
export function WordSearch({ rows, words, found, onChange, reveal, disabled, className }: WordSearchProps) {
  const [anchor, setAnchor] = useState<Cell | null>(null)
  const locked = !!reveal || disabled
  const grid = rows.map((row) => row.toUpperCase())
  const cols = grid[0]?.length ?? 0
  const targets = words.map((w) => w.toUpperCase())
  const foundSet = new Set(found.map((w) => w.toUpperCase()))

  // Cells occupied by each found word (green) and — when revealed — missing (amber).
  const foundCells = new Set<string>()
  for (const w of targets)
    if (foundSet.has(w)) solveWordSearch(rows, w)?.forEach((c) => foundCells.add(key(c)))
  const missCells = new Set<string>()
  if (reveal)
    for (const w of targets)
      if (!foundSet.has(w)) solveWordSearch(rows, w)?.forEach((c) => missCells.add(key(c)))

  function tap(cell: Cell) {
    if (locked) return
    if (!anchor) {
      setAnchor(cell)
      return
    }
    const cells = lineCells(anchor, cell)
    setAnchor(null)
    if (!cells) return
    const word = cells.map((c) => grid[c.r]?.[c.c] ?? '').join('')
    const rev = [...word].reverse().join('')
    const hit = targets.find((t) => (t === word || t === rev) && !foundSet.has(t))
    if (hit) onChange([...found, hit])
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div
        className="mx-auto grid w-full max-w-sm gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {grid.map((row, r) =>
          [...row].map((ch, c) => {
            const k = `${r},${c}`
            const isAnchor = anchor?.r === r && anchor?.c === c
            const inFound = foundCells.has(k)
            const inMiss = missCells.has(k)
            return (
              <button
                key={k}
                type="button"
                disabled={locked}
                onClick={() => tap({ r, c })}
                className={cn(
                  // A whole grid of letters — too many cells to stagger in.
                  tile({
                    state: isAnchor ? 'selected' : inFound ? 'correct' : inMiss ? 'quiet' : 'idle',
                    size: 'none',
                  }),
                  'grid aspect-square place-items-center rounded-lg text-sm font-bold uppercase sm:text-base',
                  isAnchor && 'border-primary bg-primary text-primary-foreground',
                  !isAnchor && inMiss && 'border-warning bg-warning-soft text-warning',
                )}
              >
                {ch}
              </button>
            )
          }),
        )}
      </div>
      {/* Word list — struck through as each is found. */}
      <div className="flex flex-wrap justify-center gap-2">
        {targets.map((w) => {
          const got = foundSet.has(w)
          return (
            <span
              key={w}
              className={cn(
                tile({ state: got ? 'correct' : 'quiet', size: 'none' }),
                'rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide',
                got && 'line-through',
                !got && reveal && 'border-warning bg-warning-soft text-warning',
              )}
            >
              {w}
            </span>
          )
        })}
      </div>
    </div>
  )
}
