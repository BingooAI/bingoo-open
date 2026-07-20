'use client';

import type { ChoiceReveal } from '@bingoo/core';
import { cn } from './lib/cn';
import { tile } from './lib/interactive';

export interface HighlightTextProps {
  /** The passage split into tappable tokens, in reading order. */
  tokens: string[];
  /** Controlled selection: token indexes. */
  indexes: number[];
  onChange: (indexes: number[]) => void;
  /** After checking: tokenIndex → correct/incorrect. */
  reveal?: Record<number, ChoiceReveal>;
  disabled?: boolean;
  className?: string;
}

/**
 * Tap the correct words/phrases inside a passage (reading comprehension,
 * grammar). Tokens toggle like a marker pen. Controlled + i18n-free.
 */
export function HighlightText({
  tokens,
  indexes,
  onChange,
  reveal,
  disabled,
  className,
}: HighlightTextProps) {
  const locked = !!reveal || disabled;
  const selected = new Set(indexes);

  function toggle(index: number) {
    if (locked) return;
    onChange(selected.has(index) ? indexes.filter((i) => i !== index) : [...indexes, index]);
  }

  return (
    <p className={cn('flex flex-wrap gap-x-1 gap-y-1.5 text-lg leading-relaxed', className)}>
      {tokens.map((token, i) => {
        const mark = reveal?.[i];
        const isSelected = selected.has(i);
        return (
          <button
            key={i}
            type="button"
            disabled={locked}
            aria-pressed={isSelected}
            onClick={() => toggle(i)}
            className={cn(
              tile({
                state:
                  mark === 'correct'
                    ? 'correct'
                    : mark === 'incorrect'
                      ? 'wrong'
                      : isSelected
                        ? 'selected'
                        : 'idle',
                size: 'none',
              }),
              // a marker pen, not a button — the words must stay in the flow of the passage
              'rounded-md border-0 px-1 py-0.5 shadow-none',
              mark === 'correct' && 'font-semibold',
              mark === 'incorrect' && 'line-through',
            )}
          >
            {token}
          </button>
        );
      })}
    </p>
  );
}
