'use client'

import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface OrderItem {
  id: string
  label?: ReactNode
}

export interface OrderListProps {
  /** The pool of items (any order); presentation follows `order`. */
  items: OrderItem[]
  /** Controlled sequence of item ids. */
  order: string[]
  onChange: (order: string[]) => void
  /** After checking: id → whether it sits in the correct position. */
  reveal?: Record<string, boolean>
  disabled?: boolean
  /** A11y labels for the reorder buttons (data). */
  labels?: { moveUp: string; moveDown: string }
  className?: string
}

/**
 * Reorder items into the correct sequence. Keyboard- and screen-reader-friendly
 * (each row has real up/down buttons), so it works without drag on web + mobile.
 * Controlled + i18n-free; correctness is revealed by the caller.
 */
export function OrderList({ items, order, onChange, reveal, disabled, labels, className }: OrderListProps) {
  const locked = !!reveal || disabled
  const byId = new Map(items.map((it) => [it.id, it]))

  function move(from: number, to: number) {
    if (locked || to < 0 || to >= order.length) return
    const next = order.slice()
    const [moved] = next.splice(from, 1)
    if (moved === undefined) return
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <ol className={cn('flex flex-col gap-2.5', className)}>
      {order.map((id, i) => {
        const item = byId.get(id)
        if (!item) return null
        const ok = reveal?.[id]
        return (
          <li
            key={id}
            style={stagger(i)}
            className={cn(
              // a row is ordered, never chosen — it sits back until it is graded
              tile({
                state: ok === true ? 'correct' : ok === false ? 'wrong' : 'quiet',
                size: 'none',
              }),
              'flex items-center gap-3 p-2.5 pl-3 motion-safe:animate-fade-up',
              reveal == null && 'bg-surface text-foreground',
            )}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-muted font-display text-sm font-bold text-foreground-muted">
              {i + 1}
            </span>
            <span className="flex-1 font-medium text-foreground">{item.label}</span>
            {!locked ? (
              <span className="flex flex-col">
                <button
                  type="button"
                  aria-label={labels?.moveUp}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="grid size-6 place-items-center rounded-md text-foreground-muted outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={labels?.moveDown}
                  disabled={i === order.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="grid size-6 place-items-center rounded-md text-foreground-muted outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
              </span>
            ) : (
              <GripVertical className="size-5 text-foreground-subtle" aria-hidden />
            )}
          </li>
        )
      })}
    </ol>
  )
}
