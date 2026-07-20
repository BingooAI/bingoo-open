'use client';

import { useEffect, type ReactNode } from 'react';
import { IconChip, type IconChipColor } from './icon-chip';
import { cn } from './lib/cn';

export interface AchievementToastProps {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  color?: IconChipColor;
  /** Auto-dismiss delay in ms (default 4000; 0 = stay open). */
  duration?: number;
  onMedia?: boolean;
  className?: string;
}

/**
 * A rich achievement banner (badge/mascot + title) that slides in — the reusable
 * "unlocked!" nudge for lessons, games, feed, or arena. Presentational + controlled
 * (caller positions it), so it drops into any layout. i18n-free.
 */
export function AchievementToast({
  open,
  onClose,
  icon,
  title,
  description,
  color = 'sunbeam',
  duration = 4000,
  onMedia,
  className,
}: AchievementToastProps) {
  useEffect(() => {
    if (!open || !duration) return;
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [open, duration, onClose]);

  if (!open) return null;

  const surface = onMedia
    ? 'bg-black/45 text-white backdrop-blur-md border border-white/15'
    : 'bg-surface text-foreground border border-border';
  const muted = onMedia ? 'text-white/70' : 'text-foreground-muted';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex w-full max-w-sm items-center gap-3 rounded-2xl p-3 shadow-lg motion-safe:animate-[fade-up_.3s_var(--ease-spring)]',
        surface,
        className,
      )}
    >
      <IconChip color={color} tone="gradient">
        {icon}
      </IconChip>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold">{title}</p>
        {description ? <p className={cn('truncate text-xs', muted)}>{description}</p> : null}
      </div>
    </div>
  );
}
