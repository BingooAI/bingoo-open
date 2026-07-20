// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { SrsGrade } from '@bingoo.ai/core'
import { useState, type ReactNode } from 'react'
import { Button } from './button'
import { cn } from './lib/cn'

export interface FlashcardProps {
  front: ReactNode
  back: ReactNode
  /** Controlled flip state (optional; otherwise internal). */
  flipped?: boolean
  onFlipChange?: (flipped: boolean) => void
  /** Hint shown as a small footnote on the front. */
  hint?: ReactNode
  minHeight?: number
  className?: string
}

/**
 * A 3D flip card (front ⇄ back). Pure CSS transform (no deps); under
 * `prefers-reduced-motion` it swaps without spinning. Tap/Space/Enter to flip.
 */
export function Flashcard({
  front,
  back,
  flipped,
  onFlipChange,
  hint,
  minHeight = 200,
  className,
}: FlashcardProps) {
  const [internal, setInternal] = useState(false)
  const isControlled = flipped !== undefined
  const value = isControlled ? flipped : internal

  function toggle() {
    const next = !value
    if (!isControlled) setInternal(next)
    onFlipChange?.(next)
  }

  const face =
    'absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card,2rem)] border border-border p-6 text-center [backface-visibility:hidden]'

  return (
    <div className={cn('[perspective:1200px]', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={value}
        style={{ minHeight, transform: value ? 'rotateY(180deg)' : undefined }}
        className="relative w-full transition-transform duration-500 ease-out-soft [transform-style:preserve-3d] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
      >
        <span className={cn(face, 'bg-surface')}>
          <span className="font-display text-2xl font-bold text-foreground">{front}</span>
          {hint ? <span className="text-sm text-foreground-muted">{hint}</span> : null}
        </span>
        <span className={cn(face, 'bg-primary-soft [transform:rotateY(180deg)]')}>
          <span className="text-lg font-medium text-primary-soft-foreground">{back}</span>
        </span>
      </button>
    </div>
  )
}

export interface FlashcardDeckLabels {
  again: ReactNode
  hard: ReactNode
  good: ReactNode
  easy: ReactNode
  /** Small hint on the front, e.g. "Chạm để lật". */
  flipHint?: ReactNode
}

export interface DeckCard {
  id: string
  front: ReactNode
  back: ReactNode
  hint?: ReactNode
  example?: ReactNode
}

export interface FlashcardDeckProps {
  cards: DeckCard[]
  labels: FlashcardDeckLabels
  /** Called when a card is graded (feed to `@bingoo.ai/core`'s reviewCard). */
  onGrade?: (cardId: string, grade: SrsGrade) => void
  onComplete?: () => void
  className?: string
}

const GRADES: { grade: SrsGrade; variant: 'danger' | 'secondary' | 'primary' | 'teal' }[] = [
  { grade: 'again', variant: 'danger' },
  { grade: 'hard', variant: 'secondary' },
  { grade: 'good', variant: 'primary' },
  { grade: 'easy', variant: 'teal' },
]

/** A study session over a deck: flip each card, then self-grade (drives SRS). */
export function FlashcardDeck({ cards, labels, onGrade, onComplete, className }: FlashcardDeckProps) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const card = cards[index]
  if (!card) return null

  function grade(g: SrsGrade) {
    if (!card) return
    onGrade?.(card.id, g)
    if (index >= cards.length - 1) onComplete?.()
    else {
      setIndex((i) => i + 1)
      setFlipped(false)
    }
  }

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="flex items-center justify-between text-sm font-semibold text-foreground-muted">
        <span className="tabular-nums">
          {index + 1} / {cards.length}
        </span>
      </div>
      <Flashcard
        key={card.id}
        front={card.front}
        back={
          <span className="flex flex-col gap-1">
            <span>{card.back}</span>
            {card.example ? <span className="text-sm text-foreground-muted">{card.example}</span> : null}
          </span>
        }
        hint={!flipped ? (card.hint ?? labels.flipHint) : undefined}
        flipped={flipped}
        onFlipChange={setFlipped}
      />
      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map(({ grade: gr, variant }) => (
            <Button key={gr} size="sm" variant={variant} onClick={() => grade(gr)}>
              {labels[gr]}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
