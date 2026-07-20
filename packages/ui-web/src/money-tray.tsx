'use client'

import { formatMoney, type CurrencyCode, type MoneyItem } from '@bingoo/core'
import { X } from 'lucide-react'
import { cn } from './lib/cn'
import { POP, stagger, tile } from './lib/interactive'

export interface MoneyTrayProps {
  denominations: MoneyItem[]
  /** Controlled: denomination ids picked, in order (repeats allowed). */
  picks: string[]
  onChange: (picks: string[]) => void
  currency?: CurrencyCode
  reveal?: { correct: boolean; target: number; total: number }
  disabled?: boolean
  className?: string
}

/**
 * Count money — tap coins/notes to add them to the tray and reach a target.
 * Tap a coin in the tray to remove it. Grading (sum === target) in `@bingoo/core`.
 * i18n-free (currency label is a prop).
 */
export function MoneyTray({
  denominations,
  picks,
  onChange,
  currency,
  reveal,
  disabled,
  className,
}: MoneyTrayProps) {
  const locked = !!reveal || disabled
  const byId = new Map(denominations.map((d) => [d.id, d]))
  const total = picks.reduce((s, id) => s + (byId.get(id)?.value ?? 0), 0)
  const fmt = (n: number) => formatMoney(n, currency)
  const face = (d: MoneyItem) => d.emoji ?? d.label ?? fmt(d.value)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Running total */}
      <div
        className={cn(
          tile({
            state: reveal ? (reveal.correct ? 'correct' : 'wrong') : 'quiet',
            size: 'none',
          }),
          'flex items-center justify-center gap-2 py-2 text-lg font-bold tabular-nums',
          reveal == null && 'text-foreground',
        )}
      >
        {fmt(total)}
        {reveal && !reveal.correct ? (
          <span className="text-sm font-semibold text-success">→ {fmt(reveal.target)}</span>
        ) : null}
      </div>

      {/* Tray of picked coins */}
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'flex min-h-14 flex-wrap items-center gap-2 border-dashed border-border-strong bg-surface-muted/40 p-2.5',
        )}
      >
        {picks.length === 0 ? (
          <span className="px-1 text-sm text-foreground-subtle">—</span>
        ) : (
          picks.map((id, i) => {
            const d = byId.get(id)
            if (!d) return null
            return (
              <button
                key={`${id}-${i}`}
                type="button"
                disabled={locked}
                onClick={() => onChange(picks.filter((_, idx) => idx !== i))}
                className={cn(
                  tile({ state: 'idle', size: 'none' }),
                  'inline-flex items-center gap-1 rounded-full border-accent-sunbeam bg-accent-sunbeam-soft px-2.5 py-1 text-sm font-bold text-accent-sunbeam-foreground',
                  // a coin lands in the tray — it should look like it dropped there
                  POP,
                )}
              >
                {face(d)}
                {!locked ? <X className="size-3" /> : null}
              </button>
            )
          })
        )}
      </div>

      {/* Denomination palette */}
      <div className="flex flex-wrap gap-2">
        {denominations.map((d, i) => (
          <button
            key={d.id}
            type="button"
            disabled={locked}
            onClick={() => onChange([...picks, d.id])}
            style={stagger(i)}
            className={cn(
              tile({ state: 'idle', size: 'none' }),
              'grid size-16 place-items-center rounded-full text-sm font-bold motion-safe:animate-fade-up',
            )}
          >
            <span className="text-2xl leading-none">{d.emoji ?? null}</span>
            <span className={cn(d.emoji && 'text-2xs')}>{d.label ?? fmt(d.value)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
