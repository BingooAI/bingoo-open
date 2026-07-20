import { Loader2 } from 'lucide-react'
import { cn } from './lib/cn'

export interface SpinnerProps {
  size?: number
  className?: string
  /** Accessible status label. */
  label?: string
}

/** Indeterminate loading spinner. */
export function Spinner({ size = 20, className, label = 'Loading' }: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={cn('animate-spin text-primary', className)}
      style={{ width: size, height: size }}
    />
  )
}
