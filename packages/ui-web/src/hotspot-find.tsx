// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { ChoiceReveal, DiagramHotspot } from '@bingoo.ai/core'
import { Check, X } from 'lucide-react'
import { cn } from './lib/cn'
import { POP, SHAKE, tile } from './lib/interactive'

export interface HotspotFindProps {
  hotspots: DiagramHotspot[]
  /** Controlled selection: hotspot ids. */
  selected: string[]
  onChange: (selected: string[]) => void
  imageSrc?: string
  /** After checking: hotspotId → correct/incorrect. */
  reveal?: Record<string, ChoiceReveal>
  disabled?: boolean
  label?: string
  className?: string
}

/**
 * Tap the correct spots in a scene ("find all the animals that fly"). With an
 * audio prompt (question `media`) this is listen-and-point. Scene = image and/or
 * emoji hotspots. Grading in `@bingoo.ai/core`. i18n-free.
 */
export function HotspotFind({
  hotspots,
  selected,
  onChange,
  imageSrc,
  reveal,
  disabled,
  label,
  className,
}: HotspotFindProps) {
  const locked = !!reveal || disabled
  const picked = new Set(selected)

  function toggle(id: string) {
    if (locked) return
    onChange(picked.has(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div
      className={cn(
        tile({ state: 'quiet', size: 'none' }),
        'relative mx-auto aspect-square w-full max-w-sm overflow-hidden',
        className,
      )}
      aria-label={label}
    >
      {imageSrc ? <img src={imageSrc} alt="" className="absolute inset-0 size-full object-contain" /> : null}
      {hotspots.map((h) => {
        const mark = reveal?.[h.id]
        const on = picked.has(h.id)
        return (
          <button
            key={h.id}
            type="button"
            disabled={locked}
            aria-label={h.label}
            aria-pressed={on}
            onClick={() => toggle(h.id)}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            className={cn(
              'absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring',
              // the hotspot is held in place by a transform, so the motion lives on its badge
              'motion-safe:active:scale-[0.97]',
              h.emoji ? 'size-14 text-3xl' : 'size-8',
              reveal == null && on && 'ring-4 ring-primary',
              reveal == null && !on && 'ring-2 ring-transparent hover:ring-border-strong',
              mark === 'correct' && 'ring-4 ring-success',
              mark === 'incorrect' && 'ring-4 ring-danger',
              !h.emoji && (on || mark ? 'bg-primary' : 'bg-primary/40'),
            )}
          >
            {h.emoji ?? null}
            {mark === 'correct' ? (
              <Check
                className={cn(
                  'absolute -right-1 -top-1 size-4 rounded-full bg-success p-0.5 text-white',
                  POP,
                )}
              />
            ) : null}
            {mark === 'incorrect' ? (
              <X
                className={cn(
                  'absolute -right-1 -top-1 size-4 rounded-full bg-danger p-0.5 text-white',
                  SHAKE,
                )}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
