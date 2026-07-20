'use client';

import { Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface LearningGoalsProps {
  /** e.g. "We are going to…". */
  title?: ReactNode;
  /** The lesson objectives. */
  objectives: ReactNode[];
  /** Optional key-word chips (the vocabulary box). */
  keywords?: string[];
  /** Heading above the keyword chips, e.g. "Key words". */
  keywordsTitle?: ReactNode;
  className?: string;
}

/**
 * "We are going to…" — a lesson-objectives box, optionally with a key-words chip
 * cluster (the Cambridge vocabulary box). Pure presentation; reusable across every
 * unit and stage. i18n-free.
 */
export function LearningGoals({
  title,
  objectives,
  keywords,
  keywordsTitle,
  className,
}: LearningGoalsProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="overflow-hidden rounded-2xl border-2 border-accent-teal/40 bg-accent-teal-soft/25">
        {title ? (
          <div className="flex items-center gap-2 bg-accent-teal px-4 py-2 text-white">
            <Target className="size-4" />
            <h3 className="font-display text-base font-bold">{title}</h3>
          </div>
        ) : null}
        <ul className="flex flex-col gap-2 p-4">
          {objectives.map((o, i) => (
            <li key={i} className="flex items-start gap-2.5 text-foreground">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-teal" />
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </div>
      {keywords && keywords.length > 0 ? (
        <div className="rounded-2xl border-2 border-accent-sunbeam bg-accent-sunbeam-soft/40 px-4 py-3">
          {keywordsTitle ? (
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-accent-sunbeam-foreground">
              {keywordsTitle}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {keywords.map((w) => (
              <span
                key={w}
                className="rounded-full bg-surface px-3 py-1 text-sm font-semibold text-accent-sunbeam-foreground shadow-sm"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
