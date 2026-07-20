import { streakCalendar, type StreakCell } from '@bingoo/core';
import { cn } from './lib/cn';

export interface StreakCalendarProps {
  /** ISO `yyyy-mm-dd` dates the learner was active. */
  activeDates: string[];
  /** How many days back to show (default 12 weeks). */
  days?: number;
  /** Reference "today" (defaults to now). */
  today?: Date;
  /** Glass/light styling for overlaying on feed or arena media. */
  onMedia?: boolean;
  label?: string;
  className?: string;
}

/** Chunk cells into weeks (columns of 7), oldest → newest. */
function toWeeks(cells: StreakCell[]): StreakCell[][] {
  const weeks: StreakCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * A streak heatmap (GitHub-style week columns) built from `@bingoo/core`'s
 * streakCalendar. Scrolls horizontally when space is tight, so it fits both
 * 16:9 dashboards and 9:16 feeds without breaking. i18n-free.
 */
export function StreakCalendar({
  activeDates,
  days = 84,
  today,
  onMedia,
  label,
  className,
}: StreakCalendarProps) {
  const weeks = toWeeks(streakCalendar(activeDates, days, today));
  return (
    <div className={cn('max-w-full overflow-x-auto', className)} role="img" aria-label={label}>
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell) => (
              <span
                key={cell.date}
                title={cell.date}
                className={cn(
                  'size-3.5 shrink-0 rounded-[4px] transition-colors',
                  cell.active
                    ? onMedia
                      ? 'bg-white'
                      : 'bg-success'
                    : onMedia
                      ? 'bg-white/20'
                      : 'bg-surface-muted',
                  cell.isToday && (onMedia ? 'ring-2 ring-white/70' : 'ring-2 ring-primary'),
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
