import type { ReactNode } from 'react'
import { IconChip, type IconChipColor } from './icon-chip'
import { cn } from './lib/cn'

export interface NotificationItemProps {
  icon: ReactNode
  color?: IconChipColor
  title: ReactNode
  description?: ReactNode
  /** Pre-formatted relative time. */
  time?: ReactNode
  unread?: boolean
  /** Action slot (e.g. an accept button). */
  action?: ReactNode
  onClick?: () => void
  className?: string
}

/** A notification row with an unread indicator. i18n-free (text via props). */
export function NotificationItem({
  icon,
  color = 'primary',
  title,
  description,
  time,
  unread,
  action,
  onClick,
  className,
}: NotificationItemProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-live={unread ? 'polite' : undefined}
      className={cn(
        'relative flex w-full items-start gap-3 rounded-2xl border p-3 pr-6 text-left',
        unread ? 'border-primary/30 bg-primary-soft/40' : 'border-border bg-surface',
        onClick &&
          'transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <IconChip color={color} tone={unread ? 'solid' : 'soft'} size="sm">
        {icon}
      </IconChip>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn('text-sm text-foreground', unread ? 'font-bold' : 'font-semibold')}>
            {title}
          </span>
          {time ? <span className="text-xs text-foreground-subtle">{time}</span> : null}
        </div>
        {description ? <p className="mt-0.5 text-sm text-foreground-muted">{description}</p> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      {unread ? (
        <span aria-hidden className="absolute right-3 top-3.5 size-2 rounded-full bg-primary" />
      ) : null}
    </Tag>
  )
}
