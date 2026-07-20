import type { ReactNode } from 'react';
import { Avatar } from './avatar';
import { cn } from './lib/cn';
import { StreakBadge } from './streak-badge';
import { XPBar } from './xp-bar';

export interface ChildCardProps {
  name: string;
  avatarSrc?: string | null;
  /** e.g. "Lớp 3" — pass localized text. */
  meta?: ReactNode;
  level: number;
  xp: number;
  nextXp: number;
  levelPrefix?: string;
  streakDays?: number;
  streakLabel?: ReactNode;
  /** Subject chips (already-localized short names). */
  subjects?: ReactNode[];
  /** CTA slot (e.g. a Button). */
  action?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * A parent-dashboard card for one child: identity, level/XP, streak, subjects.
 * Reuses Avatar + XPBar + StreakBadge; fluid width. i18n-free (data via props).
 */
export function ChildCard({
  name,
  avatarSrc,
  meta,
  level,
  xp,
  nextXp,
  levelPrefix,
  streakDays,
  streakLabel,
  subjects,
  action,
  onClick,
  className,
}: ChildCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-4 rounded-[var(--radius-card,2rem)] border border-border bg-surface p-5 text-left shadow-sm',
        onClick &&
          'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar name={name} src={avatarSrc} size="lg" ring />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-foreground">{name}</p>
          {meta ? <p className="truncate text-sm text-foreground-muted">{meta}</p> : null}
        </div>
        {streakDays != null ? <StreakBadge days={streakDays} label={streakLabel} /> : null}
      </div>
      <XPBar level={level} xp={xp} nextXp={nextXp} levelPrefix={levelPrefix} />
      {subjects && subjects.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s, i) => (
            <span
              key={i}
              className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-foreground-muted"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}
      {action}
    </Tag>
  );
}
