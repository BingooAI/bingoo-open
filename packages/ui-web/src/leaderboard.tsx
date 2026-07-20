import type { ReactNode } from 'react';
import { Avatar } from './avatar';
import { cn } from './lib/cn';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: ReactNode;
  isYou?: boolean;
  avatarSrc?: string | null;
}

export interface LeaderboardProps {
  entries: LeaderboardEntry[];
  className?: string;
}

/** Ranked leaderboard — highlights the current user's row. */
export function Leaderboard({ entries, className }: LeaderboardProps) {
  return (
    <ol
      className={cn(
        'flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border',
        className,
      )}
    >
      {entries.map((e) => (
        <li
          key={e.rank}
          className={cn('flex items-center gap-3 px-4 py-2.5', e.isYou && 'bg-primary-soft')}
        >
          <span className="w-6 text-center font-display font-bold text-foreground-muted">
            {e.rank}
          </span>
          <Avatar name={e.name} src={e.avatarSrc} size="sm" />
          <span className="flex-1 truncate text-sm font-medium text-foreground">{e.name}</span>
          <span className="font-display text-sm font-bold tabular-nums text-foreground">
            {e.score}
          </span>
        </li>
      ))}
    </ol>
  );
}
