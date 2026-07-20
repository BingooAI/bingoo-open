'use client';

import type { QuizItem } from '@bingoo/core';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from './lib/cn';
import { stagger, tile } from './lib/interactive';
import { useQuizText } from './quiz-locale';

export interface CategorizeBoardProps {
  categories: QuizItem[];
  items: QuizItem[];
  /** Controlled mapping: itemId → categoryId (unassigned items are absent). */
  assignment: Record<string, string>;
  onChange: (assignment: Record<string, string>) => void;
  /** After checking: itemId → correct. */
  reveal?: Record<string, boolean>;
  disabled?: boolean;
  className?: string;
}

/**
 * Sort items into category buckets by tapping: tap an item to arm it, tap a
 * bucket to drop it there (tap an assigned item to send it back to the pool).
 * No drag → works identically on web + mobile, a11y-friendly. i18n-free.
 */
export function CategorizeBoard({
  categories,
  items,
  assignment,
  onChange,
  reveal,
  disabled,
  className,
}: CategorizeBoardProps) {
  const [armed, setArmed] = useState<string | null>(null);
  const t = useQuizText();
  const locked = !!reveal || disabled;
  const pool = items.filter((it) => !(it.id in assignment));

  function tapItem(id: string) {
    if (locked) return;
    if (assignment[id]) {
      const next = { ...assignment };
      delete next[id];
      onChange(next);
      setArmed(null);
      return;
    }
    setArmed((cur) => (cur === id ? null : id));
  }

  function tapBucket(categoryId: string) {
    if (locked || !armed) return;
    onChange({ ...assignment, [armed]: categoryId });
    setArmed(null);
  }

  const chip = (item: QuizItem, extra?: string) => {
    const ok = reveal?.[item.id];
    return (
      <button
        key={item.id}
        type="button"
        disabled={locked}
        aria-pressed={armed === item.id}
        onClick={() => tapItem(item.id)}
        className={cn(
          tile({
            state:
              ok === true
                ? 'correct'
                : ok === false
                  ? 'wrong'
                  : armed === item.id
                    ? 'selected'
                    : 'idle',
            size: 'none',
          }),
          'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium',
          extra,
        )}
      >
        {item.emoji ? <span aria-hidden>{item.emoji}</span> : null}
        {t(item.label)}
        {ok === true ? <Check className="size-4" /> : null}
        {ok === false ? <X className="size-4" /> : null}
      </button>
    );
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Item pool */}
      {pool.length > 0 ? (
        <div className="flex flex-wrap gap-2">{pool.map((it) => chip(it))}</div>
      ) : null}
      {/* Buckets — divs with a button role (chips inside are real buttons, so a
          native <button> here would nest buttons: invalid HTML). */}
      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((cat, i) => {
          const contents = items.filter((it) => assignment[it.id] === cat.id);
          const droppable = !!armed && !locked;
          return (
            <div
              key={cat.id}
              style={stagger(i)}
              role="button"
              tabIndex={droppable ? 0 : -1}
              aria-disabled={!droppable}
              onClick={() => tapBucket(cat.id)}
              onKeyDown={(e) => {
                if (droppable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  tapBucket(cat.id);
                }
              }}
              className={cn(
                tile({ state: droppable ? 'selected' : 'quiet', size: 'none' }),
                'flex min-h-24 flex-col items-start gap-2 border-dashed p-3 text-left motion-safe:animate-fade-up',
                droppable && 'cursor-pointer',
              )}
            >
              <span className="flex items-center gap-1.5 font-display text-sm font-bold text-foreground">
                {cat.emoji ? <span aria-hidden>{cat.emoji}</span> : null}
                {t(cat.label)}
              </span>
              <span className="flex flex-wrap gap-1.5">{contents.map((it) => chip(it))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
