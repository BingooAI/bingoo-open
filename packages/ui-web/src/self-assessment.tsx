'use client';

import type { ReactNode } from 'react';
import { cn } from './lib/cn';
import { stagger, tile } from './lib/interactive';

export interface SelfAssessmentLevel {
  emoji: string;
  /** A11y label for this rating, e.g. "not yet" / "confident". */
  label?: string;
}

export interface SelfAssessmentProps {
  title?: ReactNode;
  /** The "I can…" statements. */
  items: { id: string; label: ReactNode }[];
  /** Controlled: statement id → chosen level index. */
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
  /** Rating faces, low → high. Defaults to 😐 / 😊. */
  levels?: SelfAssessmentLevel[];
  disabled?: boolean;
  className?: string;
}

const DEFAULT_LEVELS: SelfAssessmentLevel[] = [{ emoji: '😐' }, { emoji: '😊' }];

/**
 * "Look what I can do!" — the Cambridge self-assessment strip. Each objective gets
 * a face rating (😐 not yet → 😊 confident). Controlled; reusable across every unit
 * and stage. i18n-free (statements + a11y labels are props).
 */
export function SelfAssessment({
  title,
  items,
  value,
  onChange,
  levels = DEFAULT_LEVELS,
  disabled,
  className,
}: SelfAssessmentProps) {
  const pick = (id: string, level: number) => {
    if (disabled) return;
    onChange({ ...value, [id]: level });
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border-2 border-accent-teal/40 bg-accent-teal-soft/25',
        className,
      )}
    >
      {title ? (
        <h3 className="bg-accent-teal px-4 py-2 font-display text-base font-bold text-white">
          {title}
        </h3>
      ) : null}
      <div className="flex flex-col">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 pb-1 pt-3">
          <span className="flex-1" />
          {levels.map((lv, i) => (
            <span key={i} className="w-9 text-center text-xl leading-none" aria-hidden>
              {lv.emoji}
            </span>
          ))}
        </div>
        {items.map((it, row) => (
          <div
            key={it.id}
            style={stagger(row)}
            className="flex items-center gap-3 border-t border-accent-teal/20 px-4 py-2.5 motion-safe:animate-fade-up"
          >
            <span className="flex-1 text-sm text-foreground">{it.label}</span>
            {levels.map((lv, i) => {
              const on = value[it.id] === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  role="radio"
                  aria-checked={on}
                  aria-label={lv.label}
                  onClick={() => pick(it.id, i)}
                  className={cn(
                    tile({ state: on ? 'selected' : 'idle', size: 'none' }),
                    'grid size-9 place-items-center rounded-full text-lg leading-none',
                  )}
                >
                  <span className={cn(on ? 'opacity-100' : 'opacity-0')}>{lv.emoji}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
