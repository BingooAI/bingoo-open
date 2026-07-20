'use client';

import type { CoordPoint } from '@bingoo/core';
import { Minus, Plus } from 'lucide-react';
import { cn } from './lib/cn';
import { POP, stagger, tile } from './lib/interactive';

export type CoordValue = { x: number; y: number } | null;

export interface CoordinateGridProps {
  maxX: number;
  maxY: number;
  task: 'plot' | 'read';
  /** For task=read: the points already marked on the grid. */
  coords: CoordPoint[];
  /** Controlled answer: plotted points (plot) or the coordinates typed per point (read). */
  value: CoordValue[];
  onChange: (value: CoordValue[]) => void;
  reveal?: { correct: boolean; marks: boolean[]; answer: CoordPoint[] };
  disabled?: boolean;
  className?: string;
}

/**
 * Coordinate grid (first quadrant) — tap the intersections to PLOT the given
 * coordinates, or READ the coordinates of the marked points. Grading in
 * `@bingoo/core`, which treats (3,5) and (5,3) as different — the classic mistake.
 * i18n-free.
 */
export function CoordinateGrid({
  maxX,
  maxY,
  task,
  coords,
  value,
  onChange,
  reveal,
  disabled,
  className,
}: CoordinateGridProps) {
  const locked = !!reveal || disabled;
  // viewBox padding for the axis labels
  const PAD = 12;
  const W = 100;
  const H = 100;
  const sx = (x: number) => PAD + (x / maxX) * (W - PAD - 6);
  const sy = (y: number) => H - PAD - (y / maxY) * (H - PAD - 6);

  const placed = value.filter((p): p is { x: number; y: number } => p !== null);
  const has = (x: number, y: number) => placed.some((p) => p.x === x && p.y === y);

  const tapCell = (x: number, y: number) => {
    if (locked || task !== 'plot') return;
    if (has(x, y)) onChange(value.filter((p) => !(p && p.x === x && p.y === y)));
    else onChange([...value, { x, y }]);
  };

  const setRead = (i: number, axis: 'x' | 'y', d: number) => {
    if (locked) return;
    const next = [...value];
    const cur = next[i] ?? { x: 0, y: 0 };
    const max = axis === 'x' ? maxX : maxY;
    const v = Math.max(0, Math.min(max, (axis === 'x' ? cur.x : cur.y) + d));
    next[i] = axis === 'x' ? { ...cur, x: v } : { ...cur, y: v };
    onChange(next);
  };

  // What to draw as crosses on the grid.
  const marksOnGrid: Array<{ p: CoordPoint; ok?: boolean; ghost?: boolean }> =
    task === 'read'
      ? coords.map((p) => ({ p }))
      : reveal
        ? [
            ...placed.map((p) => ({ p, ok: coords.some((t) => t.x === p.x && t.y === p.y) })),
            // the ones they missed
            ...coords
              .filter((t) => !placed.some((p) => p.x === t.x && p.y === t.y))
              .map((p) => ({ p, ghost: true })),
          ]
        : placed.map((p) => ({ p }));

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <svg viewBox="0 0 100 100" className="w-full max-w-sm">
        {/* grid lines */}
        {Array.from({ length: maxX + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={sx(i)}
            y1={sy(0)}
            x2={sx(i)}
            y2={sy(maxY)}
            className="stroke-border"
            strokeWidth={0.3}
          />
        ))}
        {Array.from({ length: maxY + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={sx(0)}
            y1={sy(i)}
            x2={sx(maxX)}
            y2={sy(i)}
            className="stroke-border"
            strokeWidth={0.3}
          />
        ))}
        {/* axes */}
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(maxX) + 4}
          y2={sy(0)}
          className="stroke-foreground"
          strokeWidth={0.8}
          markerEnd=""
        />
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(0)}
          y2={sy(maxY) - 4}
          className="stroke-foreground"
          strokeWidth={0.8}
        />
        {/* axis numbers */}
        {Array.from({ length: maxX + 1 }, (_, i) => (
          <text
            key={`xl${i}`}
            x={sx(i)}
            y={sy(0) + 6}
            textAnchor="middle"
            className="fill-foreground-muted text-[3.5px]"
          >
            {i}
          </text>
        ))}
        {Array.from({ length: maxY + 1 }, (_, i) => (
          <text
            key={`yl${i}`}
            x={sx(0) - 3}
            y={sy(i) + 1.2}
            textAnchor="end"
            className="fill-foreground-muted text-[3.5px]"
          >
            {i}
          </text>
        ))}

        {/* tap targets (plot only) */}
        {task === 'plot' && !locked
          ? Array.from({ length: maxX + 1 }, (_, x) =>
              Array.from({ length: maxY + 1 }, (_, y) => (
                <circle
                  key={`t${x}-${y}`}
                  cx={sx(x)}
                  cy={sy(y)}
                  r={3}
                  fill="transparent"
                  className="cursor-pointer duration-2 ease-spring hover:fill-primary/20 motion-safe:transition-[r,fill,opacity]"
                  onClick={() => tapCell(x, y)}
                />
              )),
            )
          : null}

        {/* crosses */}
        {marksOnGrid.map(({ p, ok, ghost }, i) => {
          const c = ghost
            ? 'stroke-success'
            : ok === undefined
              ? 'stroke-primary'
              : ok
                ? 'stroke-success'
                : 'stroke-danger';
          return (
            <g key={`m${i}`} className={cn(c, ok === true && POP)}>
              <line
                x1={sx(p.x) - 2}
                y1={sy(p.y) - 2}
                x2={sx(p.x) + 2}
                y2={sy(p.y) + 2}
                strokeWidth={1}
                strokeDasharray={ghost ? '1 1' : undefined}
              />
              <line
                x1={sx(p.x) - 2}
                y1={sy(p.y) + 2}
                x2={sx(p.x) + 2}
                y2={sy(p.y) - 2}
                strokeWidth={1}
                strokeDasharray={ghost ? '1 1' : undefined}
              />
              {p.label ? (
                <text
                  x={sx(p.x) + 3}
                  y={sy(p.y) - 2}
                  className="fill-foreground text-[4px] font-bold"
                >
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* read task: type the coordinates of each marked point */}
      {task === 'read' ? (
        <div className="flex flex-col gap-2">
          {coords.map((p, i) => {
            const v = value[i] ?? { x: 0, y: 0 };
            const ok = reveal?.marks[i];
            return (
              <div
                key={p.label ?? i}
                style={stagger(i)}
                className={cn(
                  tile({
                    state: ok === true ? 'correct' : ok === false ? 'wrong' : 'quiet',
                    size: 'none',
                  }),
                  'flex items-center gap-2 rounded-xl px-3 py-1.5 motion-safe:animate-fade-up',
                )}
              >
                <span className="w-5 font-bold text-foreground">{p.label}</span>
                <span className="text-foreground">(</span>
                {(['x', 'y'] as const).map((ax, k) => (
                  <span key={ax} className="flex items-center gap-1">
                    {k === 1 ? <span className="text-foreground">,</span> : null}
                    {!locked ? (
                      <button
                        type="button"
                        onClick={() => setRead(i, ax, -1)}
                        className={cn(
                          tile({ size: 'none' }),
                          'grid size-6 place-items-center rounded-md',
                        )}
                      >
                        <Minus className="size-3" />
                      </button>
                    ) : null}
                    <span className="w-4 text-center font-bold tabular-nums text-foreground">
                      {ax === 'x' ? v.x : v.y}
                    </span>
                    {!locked ? (
                      <button
                        type="button"
                        onClick={() => setRead(i, ax, 1)}
                        className={cn(
                          tile({ size: 'none' }),
                          'grid size-6 place-items-center rounded-md',
                        )}
                      >
                        <Plus className="size-3" />
                      </button>
                    ) : null}
                  </span>
                ))}
                <span className="text-foreground">)</span>
                {ok === false ? (
                  <span className="ml-1 text-sm font-bold text-success">
                    → ({p.x}, {p.y})
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
