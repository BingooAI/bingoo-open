// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { ReactNode } from 'react'
import { AnswerOption, type AnswerState } from './answer-option'
import { cn } from './lib/cn'
import { stagger } from './lib/interactive'

export interface Choice {
  id: string
  label: ReactNode
  /** Large emoji visual — picture choices without assets (preschool). */
  emoji?: string
  /** Resolved image URL — picture choices. */
  image?: string
  /** Resolved audio URL — listen-and-choose choices. */
  audioSrc?: string
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export interface ChoiceListProps {
  choices: Choice[]
  /** `single` keeps one selected; `multiple` toggles a set. */
  mode?: 'single' | 'multiple'
  /** Controlled selection (ids). Single = 0–1 ids. */
  value: string[]
  onChange: (ids: string[]) => void
  /** After checking, map choiceId → correct/incorrect to reveal grading. */
  reveal?: Record<string, AnswerState>
  /** Prefix each option with A / B / C… */
  letters?: boolean
  /** A11y label for a choice's audio button (data). */
  playLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * A list of quiz choices (single- or multi-select) built on `AnswerOption`.
 * Fully controlled and i18n-free — labels are data, grading is revealed by the
 * caller (which uses `@bingoo.ai/core`'s `gradeQuestion`). Re-skins with the pack.
 */
export function ChoiceList({
  choices,
  mode = 'single',
  value,
  onChange,
  reveal,
  letters,
  playLabel,
  disabled,
  className,
}: ChoiceListProps) {
  const locked = !!reveal || disabled

  function toggle(id: string) {
    if (locked) return
    if (mode === 'single') {
      onChange([id])
    } else {
      onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
    }
  }

  // Picture choices read best as a grid (preschool-friendly tap targets).
  const pictures = choices.some((c) => c.emoji || c.image)
  const audioLabel = playLabel

  return (
    <div
      role={mode === 'single' ? 'radiogroup' : 'group'}
      className={cn(
        pictures ? 'grid grid-cols-2 gap-2.5 sm:grid-cols-3' : 'flex flex-col gap-2.5',
        className,
      )}
    >
      {choices.map((c, i) => {
        const selected = value.includes(c.id)
        const state: AnswerState = reveal?.[c.id] ?? (selected ? 'selected' : 'default')
        return (
          // Wrapped so the options can be staggered in without AnswerOption growing a `style` prop.
          <div key={c.id} className="motion-safe:animate-fade-up" style={stagger(i)}>
            <AnswerOption
              label={c.label}
              audioSrc={c.audioSrc}
              audioLabel={audioLabel}
              letter={letters ? LETTERS[i] : undefined}
              emoji={c.emoji}
              image={c.image}
              multi={mode === 'multiple'}
              state={state}
              disabled={locked}
              onClick={() => toggle(c.id)}
              className="h-full"
            />
          </div>
        )
      })}
    </div>
  )
}

export interface TrueFalseProps {
  trueLabel: ReactNode
  falseLabel: ReactNode
  value: boolean | null
  onChange: (value: boolean) => void
  /** After checking: the actual answer + whether the user was right. */
  reveal?: { answer: boolean }
  disabled?: boolean
  className?: string
}

/** A two-option true/false control, laid out side by side. Labels are data. */
export function TrueFalse({
  trueLabel,
  falseLabel,
  value,
  onChange,
  reveal,
  disabled,
  className,
}: TrueFalseProps) {
  const locked = !!reveal || disabled

  function stateFor(optionValue: boolean): AnswerState {
    if (reveal) {
      if (optionValue === reveal.answer) return 'correct'
      if (optionValue === value) return 'incorrect'
      return 'default'
    }
    return value === optionValue ? 'selected' : 'default'
  }

  return (
    <div className={cn('grid grid-cols-2 gap-2.5', className)}>
      <AnswerOption
        label={trueLabel}
        state={stateFor(true)}
        disabled={locked}
        onClick={() => !locked && onChange(true)}
      />
      <AnswerOption
        label={falseLabel}
        state={stateFor(false)}
        disabled={locked}
        onClick={() => !locked && onChange(false)}
      />
    </div>
  )
}
