'use client';

import { comboMultiplier } from '@bingoo/core';
import { Flame } from 'lucide-react';
import { cn } from './lib/cn';
import { hudSurfaceClass } from './lib/hud';

export interface ComboMeterProps {
  /** Run of consecutive correct answers. */
  streak: number;
  /** Override the multiplier (defaults to `comboMultiplier(streak)` from core). */
  multiplier?: number;
  /** Max flames to show. */
  maxFlames?: number;
  onMedia?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const SIZE = {
  sm: 'h-7 gap-1 px-2.5 text-sm [&_svg]:size-3.5',
  md: 'h-9 gap-1.5 px-3 text-base [&_svg]:size-4',
  lg: 'h-11 gap-2 px-4 text-lg [&_svg]:size-5',
} as const;

/**
 * A combo/multiplier meter (flames + ×N) for streak feedback — reused in games,
 * arena, or a quiz run. The multiplier math lives in `@bingoo/core`. i18n-free.
 */
export function ComboMeter({
  streak,
  multiplier,
  maxFlames = 5,
  onMedia,
  size = 'md',
  label,
  className,
}: ComboMeterProps) {
  const mult = multiplier ?? comboMultiplier(streak);
  const lit = Math.max(0, Math.min(maxFlames, streak));
  const active = streak > 0;
  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex items-center rounded-full font-display font-bold tabular-nums',
        SIZE[size],
        hudSurfaceClass(onMedia),
        className,
      )}
    >
      <span className="flex items-center" aria-hidden>
        {Array.from({ length: maxFlames }, (_, i) => (
          <Flame
            key={i}
            className={cn(
              '-mr-0.5',
              i < lit
                ? 'fill-accent-coral text-accent-coral'
                : onMedia
                  ? 'text-white/30'
                  : 'text-border-strong',
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          'ml-1',
          active
            ? 'text-accent-coral motion-safe:animate-[count-pop_.4s_var(--ease-spring)]'
            : onMedia
              ? 'text-white/70'
              : 'text-foreground-muted',
        )}
        // Re-run the pop each time the multiplier changes.
        key={mult}
      >
        ×{mult % 1 === 0 ? mult : mult.toFixed(1)}
      </span>
    </span>
  );
}
