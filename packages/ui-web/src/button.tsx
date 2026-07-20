import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './lib/cn'

export const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full',
    'font-sans font-semibold select-none',
    'transition-[transform,background-color,box-shadow,color,filter] duration-150 ease-out',
    // Chunky "toy" depth is a pack property: filled variants read `--btn-depth`
    // (0 at base/calm → flat; >0 at playful/toy3d → 3D bottom edge). Press pushes
    // the button down by the depth.
    'active:scale-[0.98] active:translate-y-[var(--btn-depth,0px)]',
    'disabled:pointer-events-none disabled:opacity-55',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground [--btn-edge:color-mix(in_srgb,var(--color-primary),#000_32%)] shadow-[0_var(--btn-depth,0px)_0_var(--btn-edge),0_2px_8px_-2px_rgb(16_24_40/0.18)] hover:bg-primary-hover active:shadow-none',
        gradient:
          'bg-gradient-brand text-white [--btn-edge:color-mix(in_srgb,var(--color-primary),#000_40%)] shadow-[0_var(--btn-depth,0px)_0_var(--btn-edge),0_4px_14px_-4px_color-mix(in_srgb,var(--color-primary),transparent_55%)] hover:brightness-[1.06] active:shadow-none',
        secondary:
          'border border-border bg-surface text-foreground [--btn-edge:var(--color-border-strong)] shadow-[0_var(--btn-depth,0px)_0_var(--btn-edge),0_1px_3px_rgb(16_24_40/0.08)] hover:bg-surface-muted hover:border-border-strong active:shadow-none',
        soft: 'bg-primary-soft text-primary-soft-foreground hover:brightness-[0.97] dark:hover:brightness-125',
        ghost: 'text-foreground hover:bg-surface-muted',
        outline: 'border border-border-strong text-foreground hover:bg-surface-muted',
        danger:
          'bg-danger text-danger-foreground [--btn-edge:color-mix(in_srgb,var(--color-danger),#000_32%)] shadow-[0_var(--btn-depth,0px)_0_var(--btn-edge),0_2px_8px_-2px_rgb(16_24_40/0.18)] hover:brightness-95 active:shadow-none',
        coral:
          'bg-accent-coral text-accent-coral-foreground [--btn-edge:color-mix(in_srgb,var(--color-accent-coral),#000_32%)] shadow-[0_var(--btn-depth,0px)_0_var(--btn-edge),0_2px_8px_-2px_rgb(16_24_40/0.18)] hover:brightness-[1.05] active:shadow-none',
        teal: 'bg-accent-teal text-accent-teal-foreground [--btn-edge:color-mix(in_srgb,var(--color-accent-teal),#000_30%)] shadow-[0_var(--btn-depth,0px)_0_var(--btn-edge),0_2px_8px_-2px_rgb(16_24_40/0.18)] hover:brightness-[1.05] active:shadow-none',
        sunbeam:
          'bg-accent-sunbeam text-accent-sunbeam-foreground [--btn-edge:color-mix(in_srgb,var(--color-accent-sunbeam),#000_30%)] shadow-[0_var(--btn-depth,0px)_0_var(--btn-edge),0_2px_8px_-2px_rgb(16_24_40/0.18)] hover:brightness-[1.03] active:shadow-none',
        // Light buttons for placing on colored / brand-gradient surfaces.
        inverse:
          'bg-white text-primary [--btn-edge:color-mix(in_srgb,#fff,#000_14%)] shadow-[0_var(--btn-depth,0px)_0_var(--btn-edge),0_2px_10px_-2px_rgb(0_0_0/0.2)] hover:brightness-95 active:shadow-none',
        'inverse-outline': 'border border-white/45 text-white hover:bg-white/10 hover:border-white/70',
        link: 'h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 gap-1.5 px-4 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-13 px-7 text-base',
        xl: 'h-14 px-8 text-base',
        icon: 'h-11 w-11 p-0',
        'icon-sm': 'h-9 w-9 p-0',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Show a spinner and block interaction. */
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, loading, leftIcon, rightIcon, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})
