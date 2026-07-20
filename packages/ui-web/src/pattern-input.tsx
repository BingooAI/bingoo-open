// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { QuizItem } from '@bingoo.ai/core'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'
import { useQuizText } from './quiz-locale'

export interface PatternInputProps {
  /** The shown lead-in of the pattern. */
  sequence: QuizItem[]
  /** How many trailing slots to fill. */
  blanks: number
  /** Tappable choices. */
  palette: QuizItem[]
  /** Controlled fills: palette item ids, in slot order. */
  picks: string[]
  onChange: (picks: string[]) => void
  /** After checking: per-slot correctness + the expected ids. */
  reveal?: { positions: boolean[]; answer: string[] }
  disabled?: boolean
  className?: string
}

const face = (item: QuizItem | undefined, t: ReturnType<typeof useQuizText>) =>
  item?.emoji ? (
    <span className="text-2xl">{item.emoji}</span>
  ) : (
    <span className="font-bold">{t(item?.label)}</span>
  )

/** Continue a repeating pattern: tap palette items to fill the trailing blanks. */
export function PatternInput({
  sequence,
  blanks,
  palette,
  picks,
  onChange,
  reveal,
  disabled,
  className,
}: PatternInputProps) {
  const t = useQuizText()
  const locked = !!reveal || disabled
  const byId = new Map(palette.map((p) => [p.id, p]))

  function tapPalette(id: string) {
    if (locked || picks.length >= blanks) return
    onChange([...picks, id])
  }
  function clearSlot(i: number) {
    if (locked) return
    onChange(picks.filter((_, idx) => idx !== i))
  }

  const cell = 'grid size-14 shrink-0 place-items-center'

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {sequence.map((it, i) => (
          <span key={`s${i}`} className={cn(tile({ state: 'quiet', size: 'none' }), cell)}>
            {face(it, t)}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => {
          const id = picks[i]
          const item = id ? byId.get(id) : undefined
          const ok = reveal?.positions[i]
          const revealItem = reveal && !ok ? byId.get(reveal.answer[i]!) : undefined
          return (
            <button
              key={`b${i}`}
              type="button"
              disabled={locked || !item}
              onClick={() => clearSlot(i)}
              className={cn(
                tile({
                  state: ok === true ? 'correct' : ok === false ? 'wrong' : item ? 'selected' : 'idle',
                  size: 'none',
                }),
                cell,
                // an empty slot is a hole waiting to be filled
                reveal == null && !item && 'border-dashed border-border-strong',
              )}
            >
              {item ? (
                face(item, t)
              ) : reveal ? (
                <span className="opacity-70">{face(revealItem, t)}</span>
              ) : (
                <span className="text-foreground-subtle">?</span>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {palette.map((p, i) => (
          <button
            key={p.id}
            type="button"
            disabled={locked || picks.length >= blanks}
            onClick={() => tapPalette(p.id)}
            style={stagger(i)}
            className={cn(
              tile({ state: 'idle', size: 'none' }),
              cell,
              'motion-safe:animate-fade-up disabled:opacity-40',
            )}
          >
            {face(p, t)}
          </button>
        ))}
      </div>
    </div>
  )
}
