// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { cn } from './lib/cn'
import { ENTER, stagger } from './lib/interactive'

export interface DialogueTurn {
  speaker: string
  text: string
  emoji?: string
  avatarSrc?: string
  side?: 'left' | 'right'
}

export interface DialogueBubblesProps {
  turns: DialogueTurn[]
  /** What the learner must decide, e.g. "Who is right?". */
  question?: string
  className?: string
}

/**
 * Two characters arguing a method — how Cambridge introduces most ideas ("Zara says…,
 * Marcus says…"). Passive: it teaches by disagreement, the question underneath is what
 * the learner answers next. i18n-free.
 */
export function DialogueBubbles({ turns, question, className }: DialogueBubblesProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {turns.map((t, i) => {
        const right = t.side === 'right'
        return (
          <div
            key={`${t.speaker}-${i}`}
            style={stagger(i, 80)}
            className={cn('flex items-end gap-2', right && 'flex-row-reverse', ENTER)}
          >
            <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-border bg-surface-muted text-xl">
              {t.avatarSrc ? (
                <img src={t.avatarSrc} alt="" className="size-full object-cover" />
              ) : (
                (t.emoji ?? t.speaker.slice(0, 1))
              )}
            </div>
            <div className={cn('flex max-w-[80%] flex-col gap-0.5', right && 'items-end')}>
              <span className="px-1 text-2xs font-bold uppercase tracking-wide text-foreground-subtle">
                {t.speaker}
              </span>
              <div
                className={cn(
                  'rounded-2xl border-2 px-3 py-2 text-sm text-foreground',
                  right
                    ? 'rounded-br-sm border-warning/50 bg-warning-soft'
                    : 'rounded-bl-sm border-primary/50 bg-primary-soft',
                )}
              >
                {t.text}
              </div>
            </div>
          </div>
        )
      })}
      {question ? (
        <p className="rounded-xl border-2 border-dashed border-border-strong px-3 py-2 text-center text-sm font-bold text-foreground">
          {question}
        </p>
      ) : null}
    </div>
  )
}
