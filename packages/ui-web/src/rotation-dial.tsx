'use client';

import { cn } from './lib/cn';
import { tile, tileState } from './lib/interactive';

export interface RotationDialProps {
  /** Positions around the dial (4 = quarter turns). */
  steps: number;
  /** Starting position index (shown as a ghost). */
  start: number;
  /** Controlled: the position the learner picked. */
  position: number | null;
  onChange: (position: number) => void;
  emoji?: string;
  reveal?: { correct: boolean; answer: number };
  disabled?: boolean;
  className?: string;
}

/** Position i on a circle of `steps`, as {x,y} in 0–100 space (0 = up, clockwise). */
function at(i: number, steps: number, radius = 38) {
  const a = (i / steps) * 2 * Math.PI - Math.PI / 2;
  return { x: 50 + radius * Math.cos(a), y: 50 + radius * Math.sin(a) };
}

/**
 * Turns / rotation — a pointer on a dial. The start position is a ghost; tap where
 * the pointer lands after the described turn. Grading in `@bingoo/core`. i18n-free.
 */
export function RotationDial({
  steps,
  start,
  position,
  onChange,
  emoji,
  reveal,
  disabled,
  className,
}: RotationDialProps) {
  const locked = !!reveal || disabled;
  const mark = emoji ?? '⬆️';
  const sel = position != null ? at(position, steps) : null;

  return (
    <div className={cn('mx-auto aspect-square w-52 max-w-full', className)}>
      <div className="relative size-full">
        {/* Dial ring */}
        <div className="absolute inset-[6%] rounded-full border-2 border-dashed border-border" />
        {/* Pointer from centre to selection */}
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden
        >
          {sel ? (
            <line
              x1={50}
              y1={50}
              x2={sel.x}
              y2={sel.y}
              className={cn(
                reveal ? (reveal.correct ? 'stroke-success' : 'stroke-danger') : 'stroke-primary',
              )}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          ) : null}
          <circle cx={50} cy={50} r={3} className="fill-foreground-muted" />
        </svg>
        {/* Position buttons */}
        {Array.from({ length: steps }, (_, i) => {
          const p = at(i, steps);
          const isStart = i === start;
          const isSel = position === i;
          const isAnswer = reveal?.answer === i;
          return (
            // The seat holds the position on the circle; the tile inside is free to
            // lift and press without fighting the -50%/-50% centring transform.
            <span
              key={i}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <button
                type="button"
                disabled={locked}
                aria-label={`position ${i}`}
                aria-pressed={isSel}
                onClick={() => onChange(i)}
                className={cn(
                  tile({
                    state: tileState({
                      selected: isSel,
                      revealed: !!reveal,
                      correct: reveal?.correct,
                      missed: isAnswer,
                    }),
                    size: 'none',
                  }),
                  'grid size-9 place-items-center rounded-full text-lg leading-none',
                )}
              >
                {isSel ? mark : isStart ? <span className="opacity-30">{mark}</span> : null}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
