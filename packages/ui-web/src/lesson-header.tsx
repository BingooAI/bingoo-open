import type { ReactNode } from 'react';
import { IconChip, type IconChipColor } from './icon-chip';
import { cn } from './lib/cn';
import { Progress } from './progress';

export interface LessonHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  color?: IconChipColor;
  /** 0–100 completion of the lesson. */
  progress?: number;
  /** Right-aligned meta, e.g. "còn 6 phút". */
  meta?: ReactNode;
  className?: string;
}

/** Lesson header: title + optional icon, progress bar, and time/meta. Reuses
 * Progress + IconChip; fluid across surfaces. i18n-free. */
export function LessonHeader({
  title,
  subtitle,
  icon,
  color = 'primary',
  progress,
  meta,
  className,
}: LessonHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-3">
        {icon ? (
          <IconChip color={color} tone="gradient">
            {icon}
          </IconChip>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-bold text-foreground">{title}</h2>
          {subtitle ? <p className="truncate text-sm text-foreground-muted">{subtitle}</p> : null}
        </div>
        {meta ? (
          <span className="shrink-0 text-sm font-semibold text-foreground-muted">{meta}</span>
        ) : null}
      </div>
      {progress != null ? <Progress value={progress} /> : null}
    </div>
  );
}
