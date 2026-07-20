import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from './lib/cn'

// Card radius follows the active style-pack (`--radius-card`, base = 2rem);
// switch via `data-pack` on any ancestor. Falls back to 2rem if unset.
const cardVariants = cva('rounded-[var(--radius-card,2rem)] transition-all', {
  variants: {
    variant: {
      default: 'border border-border bg-surface shadow-sm',
      raised: 'border border-border/60 bg-surface-raised shadow-md',
      muted: 'bg-surface-muted',
      outline: 'border border-border',
      ghost: '',
      gradient: 'border-0 bg-gradient-brand text-white shadow-pop',
    },
    interactive: {
      true: 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
    },
  },
  defaultVariants: { variant: 'default' },
})

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant, interactive, ...props },
  ref,
) {
  return <div ref={ref} className={cn(cardVariants({ variant, interactive }), className)} {...props} />
})

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-6', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-lg font-bold text-foreground', className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-foreground-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 p-6 pt-0', className)} {...props} />
}
