'use client';

import type { ColoringPicture } from '@bingoo/core';
import { cn } from './lib/cn';

export interface ColoringBoardProps {
  picture: ColoringPicture;
  /** Controlled fills: regionId → color. */
  fills: Record<string, string>;
  onChange: (fills: Record<string, string>) => void;
  /** The color applied on tap (from a ColorPalette). */
  activeColor: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/**
 * Coloring picture (tô màu tranh): tap a region to fill it with the active
 * color; tapping with the same color clears it. Regions/line-art come from the
 * authorable ColoringPicture schema; export via `coloringToSvg` in core.
 */
export function ColoringBoard({
  picture,
  fills,
  onChange,
  activeColor,
  disabled,
  label,
  className,
}: ColoringBoardProps) {
  function tap(regionId: string) {
    if (disabled) return;
    const same = (fills[regionId] ?? '').toLowerCase() === activeColor.toLowerCase();
    const next = { ...fills };
    if (same) delete next[regionId];
    else next[regionId] = activeColor;
    onChange(next);
  }

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={label ?? picture.title}
      className={cn(
        'aspect-square w-full touch-none rounded-2xl border-2 border-border bg-surface',
        disabled && 'opacity-60',
        className,
      )}
    >
      {picture.regions.map((r) => (
        <path
          key={r.id}
          d={r.path}
          fill={fills[r.id] ?? 'transparent'}
          role="button"
          aria-label={r.label}
          onClick={() => tap(r.id)}
          className={cn(
            'stroke-border motion-safe:transition-[r,fill,opacity] duration-2',
            !disabled && 'cursor-pointer hover:opacity-80',
          )}
          strokeWidth={0.5}
        />
      ))}
      {picture.outline ? (
        <path
          d={picture.outline}
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none stroke-foreground"
        />
      ) : null}
    </svg>
  );
}
