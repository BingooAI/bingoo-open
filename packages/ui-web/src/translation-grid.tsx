'use client';

import { translateCells } from '@bingoo/core';
import { cn } from './lib/cn';
import { POP, SHAKE, tile } from './lib/interactive';

export interface TranslationGridProps {
  rows: number;
  cols: number;
  /** The original shape, as "row-col" cells. */
  cells: string[];
  /** move = shift the shape with the arrows. describe = both shapes are shown, say how far it went. */
  task?: 'move' | 'describe';
  /** describe only: where the shape ended up (the shell translates it — that IS the picture). */
  movedCells?: string[];
  /** Controlled: how far right / up the learner says (or has moved) the shape. */
  dx: number | null;
  dy: number | null;
  onChange: (next: { dx: number | null; dy: number | null }) => void;
  reveal?: { correct: boolean; dx: number; dy: number };
  disabled?: boolean;
  className?: string;
}

/**
 * Translation on a square grid — move the shape with the arrows, or describe a move that
 * has already happened. Positive dy is UP, the way the books say it. Grading lives in
 * `@bingoo/core`. Tap-based → web + mobile. i18n-free (arrows, not words).
 */
export function TranslationGrid({
  rows,
  cols,
  cells,
  task = 'move',
  movedCells,
  dx,
  dy,
  onChange,
  reveal,
  disabled,
  className,
}: TranslationGridProps) {
  const locked = !!reveal || disabled;
  const origin = new Set(cells);
  const moved = new Set(
    task === 'describe' ? (movedCells ?? []) : translateCells(cells, dx ?? 0, dy ?? 0),
  );
  const target = new Set(
    reveal && task === 'move' ? translateCells(cells, reveal.dx, reveal.dy) : [],
  );

  const bump = (ddx: number, ddy: number) => {
    if (locked) return;
    const nx = (dx ?? 0) + ddx;
    const ny = (dy ?? 0) + ddy;
    // The shape must never leave the grid.
    const off = translateCells(cells, nx, ny).some((k) => {
      const seg = k.split('-').map(Number);
      return seg[0]! < 0 || seg[0]! >= rows || seg[1]! < 0 || seg[1]! >= cols;
    });
    if (off) return;
    onChange({ dx: nx, dy: ny });
  };

  const tone = reveal ? (reveal.correct ? 'text-success' : 'text-danger') : 'text-foreground';

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'grid w-fit overflow-hidden rounded-lg border-border-strong',
        )}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const key = `${r}-${c}`;
          const isMoved = moved.has(key);
          const isTarget = target.has(key) && !isMoved;
          return (
            <div
              key={key}
              className={cn(
                'size-8 border border-border',
                origin.has(key) && !isMoved && 'bg-surface-muted',
                isMoved && (reveal ? (reveal.correct ? 'bg-success' : 'bg-danger') : 'bg-primary'),
                isTarget && 'bg-success/25 ring-2 ring-inset ring-success',
              )}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        {task === 'move' ? (
          <>
            <Arrow glyph="←" onClick={() => bump(-1, 0)} disabled={locked} />
            <Arrow glyph="↓" onClick={() => bump(0, -1)} disabled={locked} />
            <Arrow glyph="↑" onClick={() => bump(0, 1)} disabled={locked} />
            <Arrow glyph="→" onClick={() => bump(1, 0)} disabled={locked} />
          </>
        ) : (
          <>
            <Stepper
              glyph="→"
              value={dx}
              onChange={(v) => onChange({ dx: v, dy })}
              disabled={locked}
            />
            <Stepper
              glyph="↑"
              value={dy}
              onChange={(v) => onChange({ dx, dy: v })}
              disabled={locked}
            />
          </>
        )}
      </div>

      <p
        className={cn(
          'text-lg font-bold tabular-nums',
          tone,
          reveal && (reveal.correct ? POP : SHAKE),
        )}
      >
        {fmt(dx, '→', '←')}
        {'  '}
        {fmt(dy, '↑', '↓')}
      </p>

      {reveal && !reveal.correct ? (
        <p className="text-sm font-bold text-success">
          → {fmt(reveal.dx, '→', '←')} {fmt(reveal.dy, '↑', '↓')}
        </p>
      ) : null}
    </div>
  );
}

function fmt(v: number | null, pos: string, neg: string) {
  if (v == null || v === 0) return '0';
  return `${Math.abs(v)} ${v > 0 ? pos : neg}`;
}

function Arrow({
  glyph,
  onClick,
  disabled,
}: {
  glyph: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={glyph}
      className={cn(
        tile({ state: 'idle', size: 'none' }),
        'size-11 text-xl font-bold text-foreground',
      )}
    >
      {glyph}
    </button>
  );
}

function Stepper({
  glyph,
  value,
  onChange,
  disabled,
}: {
  glyph: string;
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(tile({ state: 'quiet', size: 'none' }), 'flex items-center gap-1 px-2 py-1')}
    >
      <span className="text-lg font-bold text-foreground-muted">{glyph}</span>
      <button
        type="button"
        disabled={disabled}
        aria-label={`${glyph} -1`}
        onClick={() => onChange((value ?? 0) - 1)}
        className={cn(
          tile({ state: 'idle', size: 'none' }),
          'size-8 text-lg font-bold text-foreground',
        )}
      >
        −
      </button>
      <span className="w-6 text-center text-lg font-bold tabular-nums text-foreground">
        {value ?? 0}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-label={`${glyph} +1`}
        onClick={() => onChange((value ?? 0) + 1)}
        className={cn(
          tile({ state: 'idle', size: 'none' }),
          'size-8 text-lg font-bold text-foreground',
        )}
      >
        +
      </button>
    </div>
  );
}
