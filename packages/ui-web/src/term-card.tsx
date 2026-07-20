// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from './lib/cn'

export interface TermCardProps {
  term: ReactNode
  definition: ReactNode
  example?: ReactNode
  defaultRevealed?: boolean
  /** A11y label for the reveal toggle. */
  revealLabel?: string
  className?: string
}

/** A glossary term card — tap to reveal the definition. Reusable in lessons,
 * a glossary list, or a feed card. i18n-free. */
export function TermCard({
  term,
  definition,
  example,
  defaultRevealed,
  revealLabel,
  className,
}: TermCardProps) {
  const [open, setOpen] = useState(!!defaultRevealed)
  return (
    <div className={cn('rounded-2xl border border-border bg-surface', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={revealLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className="font-display text-lg font-bold text-foreground">{term}</span>
        <ChevronDown
          className={cn('size-5 shrink-0 text-foreground-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-1.5 px-4 pb-4 motion-safe:animate-fade-up">
          <p className="text-foreground">{definition}</p>
          {example ? <p className="text-sm italic text-foreground-muted">{example}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
