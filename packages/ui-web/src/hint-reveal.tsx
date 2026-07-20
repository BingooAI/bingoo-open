// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { Assist } from '@bingoo.ai/core'
import { Lightbulb } from 'lucide-react'
import type { ReactNode } from 'react'
import { Callout } from './callout'
import { cn } from './lib/cn'
import { ENTER, stagger, tile } from './lib/interactive'
import { SoundButton } from './sound-button'

export interface HintRevealProps {
  /** Progressive hints — each is text and/or audio (`Assist` from @bingoo.ai/core). */
  hints: Assist[]
  /** How many hints are currently revealed (controlled). */
  revealed: number
  onReveal: () => void
  /** Button copy (data), e.g. "Gợi ý". */
  buttonLabel: ReactNode
  /** A11y label for a hint's audio play button (data). */
  playLabel?: string
  className?: string
}

/**
 * Progressive hints: each tap reveals the next one as a soft callout — text is
 * shown, audio gets a play button (listen instead of reading). Controlled via
 * `revealed` so the count lives in the quiz session (`@bingoo.ai/core`).
 */
export function HintReveal({
  hints,
  revealed,
  onReveal,
  buttonLabel,
  playLabel,
  className,
}: HintRevealProps) {
  if (hints.length === 0) return null
  const shown = hints.slice(0, revealed)
  const hasMore = revealed < hints.length

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {shown.map((hint, i) => (
        <div key={i} className={ENTER} style={stagger(i)}>
          <Callout variant="warning">
            <span className="flex items-center gap-2.5">
              {hint.audioSrc ? <SoundButton src={hint.audioSrc} label={playLabel ?? ''} size="sm" /> : null}
              {hint.text}
            </span>
          </Callout>
        </div>
      ))}
      {hasMore ? (
        <button
          type="button"
          onClick={onReveal}
          className={cn(
            tile({ state: 'idle', size: 'none' }),
            'inline-flex items-center gap-1.5 self-start rounded-full border px-3.5 py-1.5 text-sm font-semibold text-foreground-muted',
            'hover:border-warning hover:text-warning-foreground',
          )}
        >
          <Lightbulb className="size-4" />
          {buttonLabel}
        </button>
      ) : null}
    </div>
  )
}
