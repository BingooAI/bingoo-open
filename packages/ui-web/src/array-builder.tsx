'use client';

import { cn } from './lib/cn';
import { tile, tileState } from './lib/interactive';

export interface ArrayBuilderProps {
  maxRows: number;
  maxCols: number;
  emoji?: string;
  /** Controlled selection (0 = none). */
  rows: number;
  cols: number;
  onChange: (rows: number, cols: number) => void;
  reveal?: { correct: boolean; rows: number; cols: number };
  disabled?: boolean;
  className?: string;
}

/**
 * Build a multiplication array — tap a dot to select the r×c rectangle up to it;
 * the label shows rows × cols = product. Grading in `@bingoo/core`. Tap-based →
 * web + mobile. i18n-free.
 */
export function ArrayBuilder({
  maxRows,
  maxCols,
  emoji,
  rows,
  cols,
  onChange,
  reveal,
  disabled,
  className,
}: ArrayBuilderProps) {
  const locked = !!reveal || disabled;
  const dot = emoji ?? '⬤';
  const tone = reveal ? (reveal.correct ? 'text-success' : 'text-danger') : 'text-primary';

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className="grid w-fit gap-1"
        style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: maxRows }, (_, r) =>
          Array.from({ length: maxCols }, (_, c) => {
            const on = r < rows && c < cols;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={locked}
                aria-label={`${r + 1} × ${c + 1}`}
                onClick={() => onChange(r + 1, c + 1)}
                className={cn(
                  // The dot grid can run to 100 cells, so no entrance stagger here.
                  tile({
                    state: tileState({
                      selected: on,
                      revealed: !!reveal,
                      correct: reveal?.correct,
                    }),
                    size: 'none',
                  }),
                  'grid size-7 place-items-center rounded-md text-lg leading-none',
                  on ? tone : 'text-foreground-subtle/30',
                )}
              >
                {on ? dot : '·'}
              </button>
            );
          }),
        )}
      </div>
      <span className={cn('text-lg font-bold tabular-nums', reveal ? tone : 'text-foreground')}>
        {rows > 0 && cols > 0 ? `${rows} × ${cols} = ${rows * cols}` : '—'}
        {reveal && !reveal.correct ? (
          <span className="ml-2 text-sm font-semibold text-success">
            → {reveal.rows} × {reveal.cols}
          </span>
        ) : null}
      </span>
    </div>
  );
}
