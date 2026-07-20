import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconChip, type IconChipColor } from './icon-chip';
import { cn } from './lib/cn';

export interface BadgeTileProps {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  color?: IconChipColor;
  locked?: boolean;
  className?: string;
}

/** Achievement badge tile — locked or unlocked. */
export function BadgeTile({
  icon,
  title,
  description,
  color = 'sunbeam',
  locked,
  className,
}: BadgeTileProps) {
  return (
    <div
      className={cn(
        'flex w-32 flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center',
        locked && 'opacity-55',
        className,
      )}
    >
      <IconChip color={locked ? 'neutral' : color} tone={locked ? 'soft' : 'gradient'}>
        {locked ? <Lock className="size-5" /> : icon}
      </IconChip>
      <span className="font-display text-sm font-bold text-foreground">{title}</span>
      {description ? <span className="text-xs text-foreground-muted">{description}</span> : null}
    </div>
  );
}
