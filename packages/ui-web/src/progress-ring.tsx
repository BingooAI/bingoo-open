import { type ReactNode } from 'react';
import { cn } from './lib/cn';
import { toPercent } from '@bingoo/core';

const STROKE_COLOR = {
  primary: 'stroke-primary',
  teal: 'stroke-accent-teal',
  sunbeam: 'stroke-accent-sunbeam',
  coral: 'stroke-accent-coral',
  success: 'stroke-success',
} as const;

export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: keyof typeof STROKE_COLOR;
  className?: string;
  label?: string;
  children?: ReactNode;
}

export function ProgressRing({
  value,
  max = 100,
  size = 72,
  strokeWidth = 8,
  color = 'primary',
  className,
  label,
  children,
}: ProgressRingProps) {
  const pct = toPercent(value / max);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - dash}
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-out-soft',
            STROKE_COLOR[color],
          )}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </div>
  );
}
