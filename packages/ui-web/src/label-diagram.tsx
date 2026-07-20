'use client'

import type { DiagramHotspot, QuizItem } from '@bingoo.ai/core'
import { useQuizText } from './quiz-locale'
import { useState } from 'react'
import { cn } from './lib/cn'
import { POP, SHAKE, stagger, tile } from './lib/interactive'

export interface LabelDiagramProps {
  hotspots: DiagramHotspot[]
  labels: QuizItem[]
  /** Controlled: labelId → hotspotId. */
  assignment: Record<string, string>
  onChange: (assignment: Record<string, string>) => void
  imageSrc?: string
  /** After checking: labelId → correct. */
  reveal?: Record<string, boolean>
  disabled?: boolean
  label?: string
  className?: string
}

/**
 * Label a diagram: tap a label, then tap the spot it belongs to (plant parts,
 * body parts). Tap-based → web + mobile. The figure is an image and/or emoji
 * hotspots. Grading in `@bingoo.ai/core`. i18n-free.
 */
export function LabelDiagram({
  hotspots,
  labels,
  assignment,
  onChange,
  imageSrc,
  reveal,
  disabled,
  label,
  className,
}: LabelDiagramProps) {
  const t = useQuizText()
  const [armed, setArmed] = useState<string | null>(null)
  const locked = !!reveal || disabled
  const labelAt = (hotspotId: string) => labels.find((l) => assignment[l.id] === hotspotId)

  function tapLabel(id: string) {
    if (locked) return
    if (assignment[id]) {
      const next = { ...assignment }
      delete next[id]
      onChange(next)
      setArmed(null)
      return
    }
    setArmed((cur) => (cur === id ? null : id))
  }
  function tapHotspot(hotspotId: string) {
    if (locked || !armed) return
    const next = { ...assignment }
    // A hotspot holds one label — clear any previous occupant.
    for (const l of Object.keys(next)) if (next[l] === hotspotId) delete next[l]
    next[armed] = hotspotId
    onChange(next)
    setArmed(null)
  }

  const pool = labels.filter((l) => !(l.id in assignment))

  return (
    <div className={cn('flex flex-col gap-3', className)} aria-label={label}>
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'relative mx-auto aspect-square w-full max-w-sm overflow-hidden',
        )}
      >
        {imageSrc ? (
          <img src={imageSrc} alt="" className="absolute inset-0 size-full object-contain" />
        ) : null}
        {hotspots.map((h) => {
          const occupant = labelAt(h.id)
          const ok = occupant ? reveal?.[occupant.id] : undefined
          return (
            <button
              key={h.id}
              type="button"
              disabled={locked || !armed}
              aria-label={t(h.label)}
              onClick={() => tapHotspot(h.id)}
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <span className="flex flex-col items-center gap-1">
                {h.emoji ? <span className="text-3xl">{h.emoji}</span> : null}
                <span
                  className={cn(
                    'grid size-4 place-items-center rounded-full border-2 border-surface',
                    armed && !locked ? 'bg-primary ring-2 ring-ring' : 'bg-primary/70',
                  )}
                />
                {occupant ? (
                  <span
                    className={cn(
                      'whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-semibold',
                      ok === true && cn('border-success bg-success-soft text-success', POP),
                      ok === false && cn('border-danger bg-danger-soft text-danger', SHAKE),
                      ok === undefined && 'border-primary bg-primary-soft text-primary-soft-foreground',
                    )}
                  >
                    {t(occupant.label)}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
      {pool.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {pool.map((l, i) => (
            <button
              key={l.id}
              type="button"
              disabled={locked}
              aria-pressed={armed === l.id}
              onClick={() => tapLabel(l.id)}
              style={stagger(i)}
              className={cn(
                tile({ state: armed === l.id ? 'selected' : 'idle', size: 'none' }),
                'px-3 py-1.5 text-sm font-semibold motion-safe:animate-fade-up',
              )}
            >
              {t(l.label)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
