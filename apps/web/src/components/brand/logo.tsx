import { cn } from '@/lib/cn'

export interface LogoProps {
  /** `wordmark` = full logo (icon + text), `mark` = icon only. */
  variant?: 'wordmark' | 'mark'
  /** Pixel height; width scales automatically. */
  height?: number
  className?: string
}

/**
 * Theme-aware Bingoo logo. Uses the official brand vectors:
 * full-color wordmark on light, white wordmark on dark (swapped via CSS so it's
 * flash-free and needs no JS). Wrap with a <Link> for navigation.
 */
export function Logo({ variant = 'wordmark', height = 32, className }: LogoProps) {
  if (variant === 'mark') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/logo/icon.svg"
        alt="Bingoo"
        height={height}
        style={{ height, width: 'auto' }}
        className={cn('block select-none', className)}
      />
    )
  }

  return (
    <span className={cn('inline-flex select-none', className)} aria-label="Bingoo" role="img">
      {/* Full-color wordmark. The mark has real cut-outs (evenodd), so it sits
          cleanly on any background — light or dark — no white variant needed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo/logo.svg" alt="" style={{ height, width: 'auto' }} className="block" />
    </span>
  )
}
