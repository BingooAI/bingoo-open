import type { ReactNode } from 'react'
import { cn } from './lib/cn'

export interface MascotMessageProps {
  /** The mascot visual — caller supplies (e.g. <Mascot emotion="happy" />). */
  mascot?: ReactNode
  message: ReactNode
  /** Optional speaker name above the message. */
  name?: ReactNode
  /** Which side the mascot sits on. */
  side?: 'left' | 'right'
  onMedia?: boolean
  className?: string
}

/**
 * The mascot speaking — a mascot + a speech bubble with a little tail. The mascot
 * is a slot (brand asset stays out of the package), so it's reused for tips,
 * praise, onboarding, or feed narration across every screen. i18n-free.
 */
export function MascotMessage({
  mascot,
  message,
  name,
  side = 'left',
  onMedia,
  className,
}: MascotMessageProps) {
  const bubble = onMedia
    ? 'bg-black/40 text-white backdrop-blur-md'
    : 'bg-surface text-foreground border border-border'
  const tail = onMedia ? 'bg-black/40' : 'bg-surface border-b border-l border-border'
  return (
    <div className={cn('flex items-end gap-2', side === 'right' && 'flex-row-reverse', className)}>
      {mascot ? <div className="shrink-0">{mascot}</div> : null}
      <div className="relative min-w-0 flex-1">
        <div className={cn('rounded-2xl px-4 py-3 shadow-sm', bubble)}>
          {name ? (
            <p
              className={cn(
                'mb-0.5 font-display text-xs font-bold',
                onMedia ? 'text-white/80' : 'text-primary',
              )}
            >
              {name}
            </p>
          ) : null}
          <div className="text-sm leading-relaxed">{message}</div>
        </div>
        {/* Tail pointing at the mascot. */}
        <span
          aria-hidden
          className={cn(
            'absolute bottom-3 size-3 rotate-45',
            tail,
            side === 'right' ? '-right-1' : '-left-1',
          )}
        />
      </div>
    </div>
  )
}
