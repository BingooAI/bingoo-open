import type { ReactNode } from 'react';
import { AvatarGroup, type AvatarGroupProps } from './avatar-group';
import { cn } from './lib/cn';
import { Progress } from './progress';

export interface ClassCardProps {
  name: ReactNode;
  /** e.g. "28 học sinh · Toán" — pass localized text. */
  meta?: ReactNode;
  students?: AvatarGroupProps['avatars'];
  /** 0–100 average class progress. */
  progress?: number;
  /** Caption under the bar, e.g. "Tiến độ trung bình 72%". */
  progressLabel?: ReactNode;
  /** Trailing slot (badge, menu…). */
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/** A teacher's class summary card: name, roster stack, average progress.
 * Reuses AvatarGroup + Progress. i18n-free. */
export function ClassCard({
  name,
  meta,
  students,
  progress,
  progressLabel,
  trailing,
  onClick,
  className,
}: ClassCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-3 rounded-[var(--radius-card,2rem)] border border-border bg-surface p-5 text-left shadow-sm',
        onClick &&
          'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-foreground">{name}</p>
          {meta ? <p className="truncate text-sm text-foreground-muted">{meta}</p> : null}
        </div>
        {trailing}
      </div>
      {students && students.length > 0 ? <AvatarGroup avatars={students} max={5} /> : null}
      {progress != null ? (
        <div className="flex flex-col gap-1">
          <Progress value={progress} />
          {progressLabel ? (
            <span className="text-xs text-foreground-muted">{progressLabel}</span>
          ) : null}
        </div>
      ) : null}
    </Tag>
  );
}
