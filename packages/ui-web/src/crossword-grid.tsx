'use client'

import { crosswordCells, type CrosswordEntry } from '@bingoo.ai/core'
import { cn } from './lib/cn'
import { tile } from './lib/interactive'

export interface CrosswordGridProps {
  rows: number
  cols: number
  entries: CrosswordEntry[]
  /** Controlled: cellKey "r-c" → letter. */
  letters: Record<string, string>
  onChange: (letters: Record<string, string>) => void
  reveal?: { cells: Record<string, { expected: string; ok: boolean }> }
  disabled?: boolean
  /** Localized headings for the clue lists. */
  acrossLabel?: string
  downLabel?: string
  className?: string
}

/**
 * Crossword — type letters into the open cells from the across/down clues. Grading
 * (each cell matches) in `@bingoo.ai/core`, which also validates letter crossings when
 * the puzzle is authored. i18n-free (clue-list headings are props).
 */
export function CrosswordGrid({
  rows,
  cols,
  entries,
  letters,
  onChange,
  reveal,
  disabled,
  acrossLabel,
  downLabel,
  className,
}: CrosswordGridProps) {
  const locked = !!reveal || disabled
  const { expected, numbers } = crosswordCells({ entries })

  const set = (k: string, ch: string) => {
    if (locked) return
    onChange({ ...letters, [k]: ch.slice(-1).toUpperCase() })
  }

  const across = entries.filter((e) => e.dir === 'across').sort((a, b) => a.number - b.number)
  const down = entries.filter((e) => e.dir === 'down').sort((a, b) => a.number - b.number)

  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start', className)}>
      <div
        className="grid w-fit shrink-0 gap-0.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const k = `${r}-${c}`
            const open = k in expected
            if (!open) return <div key={k} className="size-9 rounded-sm bg-foreground-subtle/15" />
            const mark = reveal?.cells[k]
            return (
              <div key={k} className="relative">
                {numbers[k] ? (
                  <span className="pointer-events-none absolute left-0.5 top-0 z-10 text-[0.55rem] font-bold text-foreground-muted">
                    {numbers[k]}
                  </span>
                ) : null}
                <input
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  disabled={locked}
                  aria-label={k}
                  value={letters[k] ?? ''}
                  onChange={(e) => set(k, e.target.value)}
                  className={cn(
                    // A full grid of letter cells: no entrance stagger, it should just appear.
                    tile({
                      state: mark?.ok === true ? 'correct' : mark?.ok === false ? 'wrong' : 'idle',
                      size: 'none',
                    }),
                    'size-9 rounded-sm text-center text-lg font-bold uppercase focus:border-primary',
                  )}
                />
              </div>
            )
          }),
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 text-sm">
        {across.length ? (
          <div>
            <h4 className="mb-1 font-bold text-foreground">{acrossLabel ?? 'Across'}</h4>
            <ul className="flex flex-col gap-0.5 text-foreground-muted">
              {across.map((e) => (
                <li key={`a${e.number}`}>
                  <span className="font-semibold text-foreground">{e.number}.</span> {e.clue}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {down.length ? (
          <div>
            <h4 className="mb-1 font-bold text-foreground">{downLabel ?? 'Down'}</h4>
            <ul className="flex flex-col gap-0.5 text-foreground-muted">
              {down.map((e) => (
                <li key={`d${e.number}`}>
                  <span className="font-semibold text-foreground">{e.number}.</span> {e.clue}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
