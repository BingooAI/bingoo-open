import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from './lib/cn'

export type IconChipColor = 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success' | 'neutral'

const SOFT: Record<IconChipColor, string> = {
  primary: 'bg-primary-soft text-primary',
  teal: 'bg-accent-teal-soft text-accent-teal',
  sunbeam: 'bg-accent-sunbeam-soft text-accent-sunbeam',
  coral: 'bg-accent-coral-soft text-accent-coral',
  success: 'bg-success-soft text-success',
  neutral: 'bg-surface-muted text-foreground-muted',
}

const SOLID: Record<IconChipColor, string> = {
  primary: 'bg-primary text-primary-foreground',
  teal: 'bg-accent-teal text-accent-teal-foreground',
  sunbeam: 'bg-accent-sunbeam text-accent-sunbeam-foreground',
  coral: 'bg-accent-coral text-accent-coral-foreground',
  success: 'bg-success text-success-foreground',
  neutral: 'bg-foreground text-background',
}

// Per-color gradient (lighter top-left → base). Vibrant, on-brand, theme-aware.
const GRADIENT: Record<IconChipColor, string> = {
  primary:
    'text-primary-foreground bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-primary),#fff_22%),var(--color-primary))]',
  teal: 'text-accent-teal-foreground bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-accent-teal),#fff_22%),var(--color-accent-teal))]',
  sunbeam:
    'text-accent-sunbeam-foreground bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-accent-sunbeam),#fff_22%),var(--color-accent-sunbeam))]',
  coral:
    'text-accent-coral-foreground bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-accent-coral),#fff_22%),var(--color-accent-coral))]',
  success:
    'text-success-foreground bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-success),#fff_22%),var(--color-success))]',
  neutral:
    'text-background bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-foreground),#fff_22%),var(--color-foreground))]',
}

const SIZES = {
  sm: 'size-8 rounded-lg [&_svg]:size-4',
  md: 'size-11 rounded-xl [&_svg]:size-5',
  lg: 'size-14 rounded-2xl [&_svg]:size-7',
} as const

export interface IconChipProps extends HTMLAttributes<HTMLSpanElement> {
  color?: IconChipColor
  tone?: 'soft' | 'solid' | 'gradient'
  size?: keyof typeof SIZES
  children: ReactNode
}

/** A colored, rounded container for an icon — the brand's signature accent shape. */
export const IconChip = forwardRef<HTMLSpanElement, IconChipProps>(function IconChip(
  { className, color = 'primary', tone = 'soft', size = 'md', children, ...props },
  ref,
) {
  const tint = tone === 'gradient' ? GRADIENT[color] : tone === 'solid' ? SOLID[color] : SOFT[color]
  return (
    <span
      ref={ref}
      className={cn(
        'grid shrink-0 place-items-center',
        SIZES[size],
        tint,
        tone === 'gradient' && 'shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
})
