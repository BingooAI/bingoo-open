'use client';

import type { FillSegment } from '@bingoo/core';
import { Check, X } from 'lucide-react';
import { cn } from './lib/cn';
import { tile } from './lib/interactive';

export interface FillBlankProps {
  /** Interleaved text + blank segments (from `@bingoo/core`). */
  segments: FillSegment[];
  /** Controlled value per blank. */
  values: string[];
  onChange: (values: string[]) => void;
  /** After checking: per-blank correctness (index-aligned with blanks). */
  reveal?: boolean[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Fill-in-the-blank prompt: literal text flows inline with auto-sized inputs.
 * Controlled + i18n-free; checked correctness is revealed by the caller.
 */
export function FillBlank({
  segments,
  values,
  onChange,
  reveal,
  disabled,
  placeholder,
  className,
}: FillBlankProps) {
  const locked = !!reveal || disabled;
  let blankIndex = -1;

  function setBlank(i: number, next: string) {
    const copy = values.slice();
    copy[i] = next;
    onChange(copy);
  }

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-1.5 gap-y-2.5 text-lg leading-relaxed text-foreground',
        className,
      )}
    >
      {segments.map((seg, i) => {
        if ('text' in seg) {
          return <span key={i}>{seg.text}</span>;
        }
        blankIndex += 1;
        const bi = blankIndex;
        const value = values[bi] ?? '';
        const ok = reveal?.[bi];
        const width = Math.max(4, value.length + 1);
        return (
          <span key={i} className="inline-flex items-center gap-1 align-middle">
            <input
              type="text"
              value={value}
              disabled={locked}
              placeholder={placeholder}
              aria-label={placeholder}
              autoComplete="off"
              spellCheck={false}
              style={{ width: `${width}ch` }}
              onChange={(e) => setBlank(bi, e.target.value)}
              className={cn(
                tile({
                  state: ok === true ? 'correct' : ok === false ? 'wrong' : 'idle',
                  size: 'none',
                }),
                'min-w-16 px-2 py-1 text-center font-semibold',
                'placeholder:font-normal placeholder:text-foreground-subtle',
              )}
            />
            {ok === true ? <Check className="size-4 text-success" /> : null}
            {ok === false ? <X className="size-4 text-danger" /> : null}
          </span>
        );
      })}
    </p>
  );
}
