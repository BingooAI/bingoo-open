// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useState } from 'react'
import { cn } from './lib/cn'
import { stagger, tile, tileState } from './lib/interactive'

export interface WaffleCategory {
  id: string
  label: string
  color?: string
}

export interface WaffleGridProps {
  /** Grid is size×size (10 → 100 squares, so one square = 1%). */
  size?: number
  categories: WaffleCategory[]
  /** Controlled: cell index (as a string) → category id. */
  cells: Record<string, string>
  onChange: (cells: Record<string, string>) => void
  reveal?: {
    correct: boolean
    cells: Record<string, boolean>
    counts: Record<string, number>
    answer: Record<string, number>
  }
  disabled?: boolean
  className?: string
}

const PALETTE = ['#2e62ec', '#f74c6c', '#18b862', '#ffaf0c', '#7c5cff', '#00b9b4']

/**
 * Waffle diagram — a 10×10 grid where one square is one per cent. Pick a category,
 * then tap squares to shade them. Grading (the count per category) lives in
 * `@bingoo.ai/core`. Tap-based → web + mobile. i18n-free.
 */
export function WaffleGrid({
  size = 10,
  categories,
  cells,
  onChange,
  reveal,
  disabled,
  className,
}: WaffleGridProps) {
  const locked = !!reveal || disabled
  const [active, setActive] = useState(categories[0]?.id ?? '')
  const total = size * size
  const colorOf = (id: string) =>
    categories.find((c) => c.id === id)?.color ??
    PALETTE[categories.findIndex((c) => c.id === id) % PALETTE.length]

  const counts: Record<string, number> = {}
  for (const id of Object.values(cells)) counts[id] = (counts[id] ?? 0) + 1

  const tap = (i: number) => {
    if (locked || !active) return
    const key = String(i)
    const next = { ...cells }
    if (next[key] === active) delete next[key]
    else next[key] = active
    onChange(next)
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Category picker + running counts */}
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((c, i) => {
          const n = (reveal ? reveal.counts[c.id] : counts[c.id]) ?? 0
          const want = reveal?.answer[c.id]
          const ok = reveal ? n === want : undefined
          return (
            <button
              key={c.id}
              type="button"
              disabled={locked}
              onClick={() => setActive(c.id)}
              style={stagger(i)}
              className={cn(
                tile({
                  state: tileState({
                    selected: reveal ? true : active === c.id,
                    revealed: reveal != null,
                    correct: ok === true,
                  }),
                  size: 'none',
                }),
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold',
                'motion-safe:animate-fade-up',
              )}
            >
              <span className="size-3.5 rounded-sm" style={{ background: colorOf(c.id) }} />
              <span className="text-foreground">{c.label}</span>
              <span className="tabular-nums text-foreground-muted">{n}</span>
              {ok === false ? <span className="font-bold text-success">→ {want}</span> : null}
            </button>
          )
        })}
      </div>

      {/* The waffle */}
      <div className="grid w-fit gap-0.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, i) => {
          const key = String(i)
          const cat = cells[key]
          const ok = reveal?.cells[key]
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              aria-label={String(i)}
              onClick={() => tap(i)}
              className={cn(
                // 100 cells → no stagger; the grid should just be there.
                tile({ state: ok === false ? 'wrong' : 'idle', size: 'none' }),
                'size-5 rounded-[2px] border',
                cat ? 'border-transparent shadow-none' : 'bg-surface-muted hover:bg-primary-soft/50',
                ok === false && 'border-danger',
              )}
              style={cat ? { background: colorOf(cat) } : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
