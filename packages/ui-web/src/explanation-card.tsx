// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { ReactNode } from 'react'
import { Callout, type CalloutVariant } from './callout'
import { cn } from './lib/cn'
import { ENTER, POP, SHAKE } from './lib/interactive'

export interface ExplanationCardProps {
  title?: ReactNode
  children: ReactNode
  /** Tie the tone to the result: success when right, danger when wrong. */
  variant?: CalloutVariant
  className?: string
}

/** The "why" shown after a question is checked. Animates in; re-skins with pack. */
export function ExplanationCard({ title, children, variant = 'info', className }: ExplanationCardProps) {
  // The card carries the verdict, so it enters the way the verdict feels.
  const entrance = variant === 'success' ? POP : variant === 'danger' ? SHAKE : ENTER
  return (
    <div className={cn(entrance, className)}>
      <Callout variant={variant} title={title}>
        {children}
      </Callout>
    </div>
  )
}
