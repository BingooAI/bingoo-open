import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from './lib/cn'

const SIZES = {
  xs: 'size-7 text-2xs',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-20 text-xl',
} as const

const STATUS = {
  online: 'bg-success',
  busy: 'bg-danger',
  away: 'bg-warning',
} as const

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string | null
  name: string
  size?: keyof typeof SIZES
  ring?: boolean
  status?: keyof typeof STATUS
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '').toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { className, src, name, size = 'md', ring, status, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-visible rounded-full',
        ring && 'ring-2 ring-primary/25 ring-offset-2 ring-offset-background',
        className,
      )}
      {...props}
    >
      {src ? (
        // Portable web component — plain <img> (no next/image coupling).
        <img src={src} alt={name} className={cn('rounded-full object-cover', SIZES[size])} />
      ) : (
        <span
          aria-label={name}
          className={cn(
            'grid place-items-center rounded-full bg-primary-soft font-display font-semibold text-primary-soft-foreground',
            SIZES[size],
          )}
        >
          {initials(name)}
        </span>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-surface',
            STATUS[status],
          )}
          aria-hidden
        />
      )}
    </span>
  )
})
