'use client';

import { Check, X } from 'lucide-react';
import { cn } from './lib/cn';
import { POP, SHAKE, tile } from './lib/interactive';

export interface TenFrameInputProps {
  frames?: 1 | 2;
  count: number;
  onChange: (count: number) => void;
  /** After checking: whether correct + the expected count. */
  reveal?: { correct: boolean; answer: number };
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** Show a quantity by filling ten-frame cells (tap to set). Grading in core. */
export function TenFrameInput({
  frames = 1,
  count,
  onChange,
  reveal,
  disabled,
  label,
  className,
}: TenFrameInputProps) {
  const locked = !!reveal || disabled;
  const total = frames * 10;
  const shown = reveal ? reveal.answer : count;

  function tapCell(i: number) {
    if (locked) return;
    // Tap the top filled cell to remove it; otherwise fill up to here.
    onChange(i + 1 === count ? i : i + 1);
  }

  const dotTint = reveal ? (reveal.correct ? 'bg-success' : 'bg-danger') : 'bg-primary';

  return (
    <div className={cn('flex flex-col items-center gap-2', className)} aria-label={label}>
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: frames }, (_, fi) => (
          <div
            key={fi}
            className={cn(
              tile({ state: 'quiet', size: 'none' }),
              'grid grid-cols-5 grid-rows-2 gap-0.5 rounded-lg border-border-strong p-0.5',
            )}
          >
            {Array.from({ length: 10 }, (_, ci) => {
              const idx = fi * 10 + ci;
              const filled = idx < shown;
              return (
                <button
                  key={ci}
                  type="button"
                  disabled={locked}
                  aria-label={`${idx + 1}`}
                  onClick={() => tapCell(idx)}
                  className={cn(
                    // The dot carries the verdict's colour, so the cell only ever says
                    // "empty" or "filled" — the reveal must not shake all ten of them.
                    tile({ state: filled ? 'selected' : 'idle', size: 'none' }),
                    'grid size-9 place-items-center rounded-lg',
                  )}
                >
                  {filled ? <span className={cn('size-6 rounded-full', dotTint, POP)} /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className={cn('flex items-center gap-2', reveal && (reveal.correct ? POP : SHAKE))}>
        <span className="font-display text-lg font-bold tabular-nums text-foreground">{shown}</span>
        {reveal ? (
          reveal.correct ? (
            <Check className="size-5 text-success" />
          ) : (
            <span className="flex items-center gap-1 text-danger">
              <X className="size-5" />
              <span className="font-bold tabular-nums">{reveal.answer}</span>
            </span>
          )
        ) : (
          <span className="text-sm text-foreground-muted">/ {total}</span>
        )}
      </div>
    </div>
  );
}
