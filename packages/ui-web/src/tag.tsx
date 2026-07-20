import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './lib/cn'

export type TagColor = 'neutral' | 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success'

export interface TagProps {
  children: ReactNode
  color?: TagColor
  /** When set, renders a remove (×) button. */
  onRemove?: () => void
  removeAriaLabel?: string
  className?: string
}

const TAG: Record<TagColor, string> = {
  neutral: 'bg-surface-muted text-foreground-muted',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  teal: 'bg-accent-teal-soft text-accent-teal',
  sunbeam: 'bg-accent-sunbeam-soft text-accent-sunbeam',
  coral: 'bg-accent-coral-soft text-accent-coral',
  success: 'bg-success-soft text-success',
}

/** Compact, optionally-removable chip/tag. */
export function Tag({
  children,
  color = 'neutral',
  onRemove,
  removeAriaLabel = 'Remove',
  className,
}: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        TAG[color],
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeAriaLabel}
          className="-mr-1 grid size-4 place-items-center rounded-full opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  )
}
