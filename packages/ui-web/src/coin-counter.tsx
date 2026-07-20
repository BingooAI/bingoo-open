'use client';

import { Coins } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './lib/cn';
import { hudSurfaceClass } from './lib/hud';

export interface CoinCounterProps {
  value: number;
  /** Custom icon (defaults to a coin). Pass null to hide. */
  icon?: ReactNode;
  /** Count-up duration in ms (default 700). */
  duration?: number;
  /** Glass/light styling for overlaying on feed or arena media. */
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
 * A coin/gem balance pill that tweens to its new value — reused as a lesson
 * reward, a feed HUD, or an arena scoreboard. Respects reduced motion (snaps).
 */
export function CoinCounter({
  value,
  icon,
  duration = 700,
  onMedia,
  size = 'md',
  label,
  className,
}: CoinCounterProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = fromRef.current;
    const to = value;
    if (reduce || from === to || duration <= 0) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

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
      {icon === undefined ? <Coins className="text-accent-sunbeam" /> : icon}
      {display.toLocaleString()}
    </span>
  );
}
