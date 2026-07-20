'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from './lib/cn'

export interface PaginationProps {
  page: number
  total: number
  onChange: (page: number) => void
  /** Pages shown either side of the current page. */
  siblingCount?: number
  ariaLabel?: string
  prevLabel?: string
  nextLabel?: string
}

function pageList(page: number, total: number, siblings: number): (number | 'gap')[] {
  const out: (number | 'gap')[] = []
  const push = (n: number | 'gap') => out.push(n)
  const start = Math.max(2, page - siblings)
  const end = Math.min(total - 1, page + siblings)
  push(1)
  if (start > 2) push('gap')
  for (let i = start; i <= end; i += 1) push(i)
  if (end < total - 1) push('gap')
  if (total > 1) push(total)
  return out
}

/** Accessible pager — prev/next + numbered pages with ellipsis. */
export function Pagination({
  page,
  total,
  onChange,
  siblingCount = 1,
  ariaLabel = 'Pagination',
  prevLabel = 'Previous',
  nextLabel = 'Next',
}: PaginationProps) {
  const cell =
    'grid size-9 place-items-center rounded-xl text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-default'
  return (
    <nav aria-label={ariaLabel}>
      <ul className="flex items-center gap-1">
        <li>
          <button
            type="button"
            aria-label={prevLabel}
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className={cn(cell, 'text-foreground hover:bg-surface-muted')}
          >
            <ChevronLeft className="size-4" />
          </button>
        </li>
        {pageList(page, total, siblingCount).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} className="grid size-9 place-items-center text-foreground-subtle">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                aria-label={String(p)}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onChange(p)}
                className={cn(
                  cell,
                  p === page
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-surface-muted',
                )}
              >
                {p}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            aria-label={nextLabel}
            disabled={page >= total}
            onClick={() => onChange(page + 1)}
            className={cn(cell, 'text-foreground hover:bg-surface-muted')}
          >
            <ChevronRight className="size-4" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
