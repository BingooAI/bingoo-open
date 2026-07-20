'use client';

import { cn } from './lib/cn';

export interface ColorPaletteProps {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
  /** A11y label for the group (data). */
  label?: string;
  size?: 'md' | 'lg';
  className?: string;
}

/** A tappable swatch row for drawing/coloring — big targets for small hands. */
export function ColorPalette({
  colors,
  value,
  onChange,
  label,
  size = 'lg',
  className,
}: ColorPaletteProps) {
  const dot = size === 'lg' ? 'size-10' : 'size-8';
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {colors.map((color) => {
        const active = color.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              'rounded-full border-2 border-black/10 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              dot,
              active && 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background',
            )}
          />
        );
      })}
    </div>
  );
}
