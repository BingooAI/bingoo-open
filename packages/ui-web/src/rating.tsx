// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from './lib/cn'

export interface RatingProps {
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  max?: number
  readOnly?: boolean
  /** Accessible group label. */
  label?: string
}

/** Star rating — keyboard + screen-reader accessible (radiogroup semantics). */
export function Rating({
  value,
  defaultValue = 0,
  onChange,
  max = 5,
  readOnly,
  label = 'Rating',
}: RatingProps) {
  const [internal, setInternal] = useState(defaultValue)
  const [hover, setHover] = useState<number | null>(null)
  const current = value ?? internal
  const shown = hover ?? current

  function set(n: number) {
    if (readOnly) return
    if (value === undefined) setInternal(n)
    onChange?.(n)
  }

  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={current === n}
          aria-label={String(n)}
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => !readOnly && setHover(n)}
          onBlur={() => setHover(null)}
          onClick={() => set(n)}
          className="rounded outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring enabled:hover:scale-110 disabled:cursor-default"
        >
          <Star
            className={cn(
              'size-6 transition-colors',
              n <= shown ? 'fill-accent-sunbeam text-accent-sunbeam' : 'fill-transparent text-border-strong',
            )}
          />
        </button>
      ))}
    </div>
  )
}
