import { Download, FileText } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconChip, type IconChipColor } from './icon-chip'
import { cn } from './lib/cn'

export interface ResourceCardProps {
  title: ReactNode
  /** e.g. "PDF · 1.2 MB". */
  meta?: ReactNode
  icon?: ReactNode
  color?: IconChipColor
  /** A download link… */
  href?: string
  /** …or a custom handler. */
  onDownload?: () => void
  downloadLabel?: string
  className?: string
}

/** A downloadable resource (PDF, worksheet, file). Link or handler; reusable in
 * lessons, a resources tab, or a feed. i18n-free. */
export function ResourceCard({
  title,
  meta,
  icon,
  color = 'coral',
  href,
  onDownload,
  downloadLabel,
  className,
}: ResourceCardProps) {
  return (
    <div
      className={cn('flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5', className)}
    >
      <IconChip color={color} tone="soft">
        {icon ?? <FileText className="size-5" />}
      </IconChip>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold text-foreground">{title}</p>
        {meta ? <p className="truncate text-xs text-foreground-muted">{meta}</p> : null}
      </div>
      <a
        href={href}
        onClick={onDownload}
        download={href ? '' : undefined}
        aria-label={downloadLabel}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary outline-none transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Download className="size-4" />
      </a>
    </div>
  )
}
