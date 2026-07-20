import type { ReactNode } from 'react';
import { IconChip, type IconChipColor } from './icon-chip';
import { cn } from './lib/cn';

export interface ActivityFeedItemProps {
  icon: ReactNode;
  color?: IconChipColor;
  /** e.g. "An hoàn thành bài Phân số" (pre-localized/composed). */
  title: ReactNode;
  /** Pre-formatted relative time, e.g. "2 giờ trước". */
  time?: ReactNode;
  description?: ReactNode;
  /** Trailing slot (reward chip, thumbnail…). */
  trailing?: ReactNode;
  onClick?: () => void;
  onMedia?: boolean;
  className?: string;
}

/** One activity-feed row (lesson done, badge earned, friend joined…). Reused on
 * parent/teacher dashboards and community feeds. i18n-free. */
export function ActivityFeedItem({
  icon,
  color = 'primary',
  title,
  time,
  description,
  trailing,
  onClick,
  onMedia,
  className,
}: ActivityFeedItemProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border p-3 text-left',
        onMedia
          ? 'border-white/15 bg-black/35 text-white backdrop-blur-md'
          : 'border-border bg-surface',
        onClick &&
          'transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <IconChip color={color} tone="soft" size="sm">
        {icon}
      </IconChip>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold">{title}</span>
          {time ? (
            <span className={cn('text-xs', onMedia ? 'text-white/60' : 'text-foreground-subtle')}>
              {time}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className={cn('mt-0.5 text-sm', onMedia ? 'text-white/70' : 'text-foreground-muted')}>
            {description}
          </p>
        ) : null}
      </div>
      {trailing}
    </Tag>
  );
}
