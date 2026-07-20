'use client';

import { MessagesSquare, Timer, Users } from 'lucide-react';
import { cn } from './lib/cn';
import { ENTER } from './lib/interactive';

export interface DiscussPromptProps {
  prompt: string;
  /** Talk partner, small group, or the whole class. */
  mode?: 'pair' | 'group' | 'class';
  /** Talking points to get them started. */
  points?: string[];
  minutes?: number;
  /** Localized wrapper copy — e.g. { pair: 'Nói với bạn bên cạnh', minutes: (n) => `${n} phút` }. */
  labels?: { pair?: string; group?: string; class?: string; minutes?: (n: number) => string };
  className?: string;
}

/**
 * "Talk to your partner" — the most frequent instruction in the whole Cambridge series
 * (600+ times). Nothing to submit: it frames a spoken activity. i18n-free (the wrapper
 * words come in through `labels`).
 */
export function DiscussPrompt({
  prompt,
  mode = 'pair',
  points,
  minutes,
  labels,
  className,
}: DiscussPromptProps) {
  const modeLabel = labels?.[mode];
  const Icon = mode === 'pair' ? MessagesSquare : Users;

  return (
    <section
      className={cn(
        'rounded-2xl border-2 border-warning/50 bg-warning-soft/40 p-4',
        ENTER,
        className,
      )}
    >
      <header className="mb-2 flex items-center gap-2">
        <Icon className="size-4 text-warning" />
        {modeLabel ? (
          <span className="text-xs font-bold uppercase tracking-wide text-warning">
            {modeLabel}
          </span>
        ) : null}
        {minutes && labels?.minutes ? (
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-foreground-muted">
            <Timer className="size-3.5" />
            {labels.minutes(minutes)}
          </span>
        ) : null}
      </header>

      <p className="font-display text-base font-bold text-foreground">{prompt}</p>

      {points?.length ? (
        <ul className="mt-2 flex flex-col gap-1">
          {points.map((p) => (
            <li key={p} className="flex gap-2 text-sm text-foreground-muted">
              <span aria-hidden className="text-warning">
                •
              </span>
              {p}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
