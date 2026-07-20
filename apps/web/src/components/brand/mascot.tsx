import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { mascotSrc, type MascotEmotion } from '@bingoo/core'

export interface MascotProps {
  emotion?: MascotEmotion
  /** Pixel size (square). */
  size?: number
  /** Gentle idle bob animation. */
  float?: boolean
  className?: string
  /** Accessible description; empty string marks it decorative. */
  alt?: string
}

/** The Bingoo buddy — renders an animated emotion SVG from the brand kit. */
export function Mascot({ emotion = 'happy', size = 120, float, className, alt = 'Bingoo' }: MascotProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mascotSrc(emotion)}
      alt={alt}
      aria-hidden={alt === '' || undefined}
      width={size}
      height={size}
      className={cn('block select-none', float && 'animate-bob', className)}
      draggable={false}
    />
  )
}

export interface MascotMessageProps {
  emotion?: MascotEmotion
  size?: number
  children: ReactNode
  className?: string
  /** Which side the mascot sits on. */
  side?: 'left' | 'right'
}

/** Mascot paired with a speech bubble — used across auth & onboarding. */
export function MascotMessage({
  emotion = 'happy',
  size = 72,
  children,
  className,
  side = 'left',
}: MascotMessageProps) {
  return (
    <div className={cn('flex items-center gap-3', side === 'right' && 'flex-row-reverse', className)}>
      <Mascot emotion={emotion} size={size} float className="shrink-0" />
      <div
        className={cn(
          'relative rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground shadow-sm',
          side === 'right' && 'rounded-bl-2xl rounded-br-sm',
        )}
      >
        {children}
      </div>
    </div>
  )
}
