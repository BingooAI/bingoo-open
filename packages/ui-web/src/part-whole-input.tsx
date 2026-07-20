'use client';

import { cn } from './lib/cn';
import { tile } from './lib/interactive';

export interface PartWholeInputProps {
  whole: number | null;
  parts: (number | null)[];
  /** Value for the single blank (the null slot). */
  value: string;
  onChange: (value: string) => void;
  reveal?: { correct: boolean; answer: number };
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** A part-whole (bar model) diagram with one blank to fill. Grading in core. */
export function PartWholeInput({
  whole,
  parts,
  value,
  onChange,
  reveal,
  disabled,
  label,
  className,
}: PartWholeInputProps) {
  const locked = !!reveal || disabled;

  const box = (v: number | null, isWholeBox: boolean) => {
    if (v === null) {
      const state = tile({
        state: reveal ? (reveal.correct ? 'correct' : 'wrong') : 'selected',
        size: 'none',
      });
      return (
        <input
          value={reveal && !reveal.correct ? String(reveal.answer) : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
          inputMode="numeric"
          aria-label={label}
          className={cn(
            state,
            'w-full py-3 text-center font-display text-2xl font-extrabold',
            // the blank is typed into — keep it a clean sheet until it is graded
            reveal == null && 'bg-surface',
          )}
        />
      );
    }
    return (
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'grid w-full place-items-center py-3 font-display text-2xl font-extrabold text-foreground',
          isWholeBox && 'bg-primary-soft/40',
        )}
      >
        {v}
      </div>
    );
  };

  return (
    <div className={cn('mx-auto flex w-full max-w-xs flex-col items-center gap-2', className)}>
      <div className="w-1/2">{box(whole, true)}</div>
      <span className="text-foreground-subtle" aria-hidden>
        ▽
      </span>
      <div className="flex w-full gap-2">
        {parts.map((p, i) => (
          <div key={i} className="flex-1">
            {box(p, false)}
          </div>
        ))}
      </div>
    </div>
  );
}
