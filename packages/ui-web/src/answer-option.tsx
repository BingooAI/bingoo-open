// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { Check, X } from 'lucide-react'
import { SoundButton } from './sound-button'
import type { ReactNode } from 'react'
import { cn } from './lib/cn'
import { tile } from './lib/interactive'

export type AnswerState = 'default' | 'selected' | 'correct' | 'incorrect'

export interface AnswerOptionProps {
  label?: ReactNode
  /** Play this choice's audio (listen-and-choose). */
  audioSrc?: string
  /** A11y label for the audio button (data). */
  audioLabel?: string
  letter?: string
  /** Large emoji visual — picture choices without assets (preschool). */
  emoji?: string
  /** Resolved image URL — picture choices. */
  image?: string
  state?: AnswerState
  /** Show a checkbox-style indicator for multi-select choices. */
  multi?: boolean
  onClick?: () => void
  disabled?: boolean
  className?: string
}

/** The four answer states, spoken in the shared `tile` language (motion included). */
const STATE: Record<AnswerState, string> = {
  default: tile({ state: 'idle', size: 'none' }),
  selected: tile({ state: 'selected', size: 'none' }),
  correct: tile({ state: 'correct', size: 'none' }),
  incorrect: tile({ state: 'wrong', size: 'none' }),
}

/** Quiz answer choice with default / selected / correct / incorrect states. */
export function AnswerOption({
  label,
  audioSrc,
  audioLabel,
  letter,
  emoji,
  image,
  state = 'default',
  multi,
  onClick,
  disabled,
  className,
}: AnswerOptionProps) {
  const locked = state === 'correct' || state === 'incorrect'
  const picture = emoji || image
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || locked}
      aria-pressed={state === 'selected'}
      className={cn(
        'flex w-full items-center gap-3 p-3.5 text-left font-medium',
        picture && 'flex-col p-4 text-center',
        STATE[state],
        className,
      )}
    >
      {letter && !picture ? (
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted font-display font-bold text-foreground">
          {letter}
        </span>
      ) : null}
      {emoji ? (
        <span aria-hidden className="text-5xl leading-none">
          {emoji}
        </span>
      ) : image ? (
        <img src={image} alt="" className="size-20 rounded-xl object-cover" />
      ) : null}
      {audioSrc ? (
        <span onClick={(e) => e.stopPropagation()}>
          <SoundButton src={audioSrc} label={audioLabel ?? ''} tone="soft" size="sm" />
        </span>
      ) : null}
      {label ? (
        <span className={cn('flex-1', picture && 'flex-none')}>{label}</span>
      ) : (
        <span className="flex-1" />
      )}
      {multi && !locked ? (
        <span
          aria-hidden
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors',
            state === 'selected'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border-strong',
          )}
        >
          {state === 'selected' ? <Check className="size-3.5" /> : null}
        </span>
      ) : null}
      {state === 'correct' ? <Check className="size-5 shrink-0" /> : null}
      {state === 'incorrect' ? <X className="size-5 shrink-0" /> : null}
    </button>
  )
}
