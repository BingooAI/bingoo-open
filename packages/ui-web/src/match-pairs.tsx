'use client'

import { Check, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface MatchItem {
  id: string
  label?: ReactNode
}

export interface MatchPairsProps {
  left: MatchItem[]
  right: MatchItem[]
  /** Controlled pairing: leftId → rightId. */
  pairs: Record<string, string>
  onChange: (pairs: Record<string, string>) => void
  /** After checking: leftId → whether the pair is correct. */
  reveal?: Record<string, boolean>
  disabled?: boolean
  className?: string
}

// Categorical pair colors from semantic accent tokens (cycled). Each connected
// pair shares a hue on both sides so the link is readable without a drawn line.
const TINTS = [
  { dot: 'bg-primary', ring: 'border-primary ring-primary/25' },
  { dot: 'bg-accent-teal', ring: 'border-accent-teal ring-accent-teal/25' },
  { dot: 'bg-accent-sunbeam', ring: 'border-accent-sunbeam ring-accent-sunbeam/25' },
  { dot: 'bg-accent-coral', ring: 'border-accent-coral ring-accent-coral/25' },
  { dot: 'bg-success', ring: 'border-success ring-success/25' },
] as const

/**
 * Match items across two columns by tapping: tap a left item to arm it, then tap
 * a right item to connect. Tap a connected item to release it. Each pair gets a
 * shared color so links read at a glance — no drag, so it works on web + mobile.
 */
export function MatchPairs({ left, right, pairs, onChange, reveal, disabled, className }: MatchPairsProps) {
  const [armed, setArmed] = useState<string | null>(null)
  const locked = !!reveal || disabled

  const colorOfLeft = (id: string) => TINTS[left.findIndex((l) => l.id === id) % TINTS.length]!
  const leftForRight = (rightId: string) => Object.keys(pairs).find((l) => pairs[l] === rightId)

  function tapLeft(id: string) {
    if (locked) return
    if (pairs[id]) {
      const next = { ...pairs }
      delete next[id]
      onChange(next)
      setArmed(null)
      return
    }
    setArmed((cur) => (cur === id ? null : id))
  }

  function tapRight(rightId: string) {
    if (locked || !armed) return
    const next = { ...pairs }
    for (const l of Object.keys(next)) if (next[l] === rightId) delete next[l]
    next[armed] = rightId
    onChange(next)
    setArmed(null)
  }

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      <ul className="flex flex-col gap-2.5">
        {left.map((item, i) => {
          const paired = pairs[item.id]
          const tint = colorOfLeft(item.id)
          const ok = reveal?.[item.id]
          const isArmed = armed === item.id
          return (
            <li key={item.id} className="motion-safe:animate-fade-up" style={stagger(i)}>
              <button
                type="button"
                disabled={locked}
                aria-pressed={isArmed || !!paired}
                onClick={() => tapLeft(item.id)}
                className={cn(
                  tile({
                    state: ok === true ? 'correct' : ok === false ? 'wrong' : isArmed ? 'selected' : 'idle',
                    size: 'none',
                  }),
                  'flex w-full items-center gap-2.5 p-3 text-left font-medium',
                  isArmed && 'ring-2 ring-ring',
                  paired && !isArmed && reveal == null && cn('ring-2', tint.ring),
                )}
              >
                <span
                  className={cn(
                    'size-3 shrink-0 rounded-full transition-colors',
                    paired ? tint.dot : 'bg-surface-muted',
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {ok === true ? <Check className="size-4 shrink-0 text-success" /> : null}
                {ok === false ? <X className="size-4 shrink-0 text-danger" /> : null}
              </button>
            </li>
          )
        })}
      </ul>
      <ul className="flex flex-col gap-2.5">
        {right.map((item, i) => {
          const ownerLeft = leftForRight(item.id)
          const tint = ownerLeft ? colorOfLeft(ownerLeft) : null
          return (
            <li key={item.id} className="motion-safe:animate-fade-up" style={stagger(i)}>
              <button
                type="button"
                disabled={locked || !armed}
                onClick={() => tapRight(item.id)}
                className={cn(
                  tile({ state: 'idle', size: 'none' }),
                  'flex w-full items-center gap-2.5 p-3 text-left font-medium',
                  tint && cn('ring-2', tint.ring),
                  armed && !locked && 'border-primary/60',
                )}
              >
                <span
                  className={cn(
                    'size-3 shrink-0 rounded-full transition-colors',
                    tint ? tint.dot : 'bg-surface-muted',
                  )}
                />
                <span className="flex-1">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
