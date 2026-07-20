'use client'

import { cn } from './lib/cn'
import { stagger, tile, tileState } from './lib/interactive'

export interface WordBankProps {
  /** The token bank, in display order (may contain duplicates + distractors). */
  bank: string[]
  /** Controlled answer: ordered indexes into `bank`. */
  picks: number[]
  onChange: (picks: number[]) => void
  /** After checking: per-position correctness + the expected sequence. */
  reveal?: { positions: boolean[]; answer: string[] }
  disabled?: boolean
  className?: string
}

/** Layout only — the colour, depth and motion come from `tile()`. */
const chipBase = 'rounded-xl px-3 py-1.5 font-medium'

/**
 * Duolingo-style sentence builder: tap bank tokens to append them to the answer
 * line, tap an answer token to return it. Tracks indexes (not strings) so
 * duplicate words keep their identity. Controlled + i18n-free.
 */
export function WordBank({ bank, picks, onChange, reveal, disabled, className }: WordBankProps) {
  const locked = !!reveal || disabled
  const used = new Set(picks)

  function pick(index: number) {
    if (locked || used.has(index)) return
    onChange([...picks, index])
  }

  function unpick(position: number) {
    if (locked) return
    onChange(picks.filter((_, i) => i !== position))
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Answer line */}
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'flex min-h-14 flex-wrap items-center gap-2 border-dashed border-border-strong bg-surface-muted/40 p-2.5',
        )}
      >
        {picks.map((bankIndex, position) => {
          const ok = reveal?.positions[position]
          return (
            <button
              key={`${bankIndex}-${position}`}
              type="button"
              disabled={locked}
              onClick={() => unpick(position)}
              className={cn(
                tile({
                  state: tileState({
                    selected: true,
                    revealed: reveal != null,
                    correct: ok === true,
                  }),
                  size: 'none',
                }),
                chipBase,
                reveal == null && 'text-primary-soft-foreground',
              )}
            >
              {bank[bankIndex]}
            </button>
          )
        })}
        {/* Show the expected sequence when the learner got it wrong. */}
        {reveal && reveal.positions.some((p) => !p) ? (
          <span className="w-full text-sm font-semibold text-success">{reveal.answer.join(' ')}</span>
        ) : null}
      </div>
      {/* Bank */}
      <div className="flex flex-wrap gap-2">
        {bank.map((token, index) => {
          const consumed = used.has(index)
          return (
            <button
              key={index}
              type="button"
              disabled={locked || consumed}
              onClick={() => pick(index)}
              style={stagger(index)}
              className={cn(
                tile({ state: consumed ? 'quiet' : 'idle', size: 'none' }),
                chipBase,
                'motion-safe:animate-fade-up',
                consumed && 'border-transparent text-foreground-subtle',
              )}
            >
              {token}
            </button>
          )
        })}
      </div>
    </div>
  )
}
