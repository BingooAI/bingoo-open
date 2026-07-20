'use client';

import { Check, X } from 'lucide-react';
import { useRef, type PointerEvent } from 'react';
import { cn } from './lib/cn';
import { POP, SHAKE } from './lib/interactive';

export interface NumberLineInputProps {
  min: number;
  max: number;
  step?: number;
  value: number | null;
  onChange: (value: number) => void;
  /** After checking: whether correct + the expected value. */
  reveal?: { correct: boolean; answer: number };
  disabled?: boolean;
  label?: string;
  className?: string;
}

/**
 * Mark a value on a number line by tapping — snaps to the nearest step. Counting
 * and add/subtract (Cambridge "mark 13", jump lines). Grading in `@bingoo/core`.
 */
export function NumberLineInput({
  min,
  max,
  step = 1,
  value,
  onChange,
  reveal,
  disabled,
  label,
  className,
}: NumberLineInputProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const locked = !!reveal || disabled;
  const span = Math.max(1, max - min);
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(Math.round(v * 100) / 100);
  const x = (v: number) => 4 + ((v - min) / span) * 92;

  function tap(e: PointerEvent<SVGSVGElement>) {
    if (locked) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const raw = min + ((px - 4) / 92) * span;
    const snapped = Math.max(min, Math.min(max, Math.round(raw / step) * step));
    onChange(Math.round(snapped * 100) / 100);
  }

  const markColor = reveal ? (reveal.correct ? 'fill-success' : 'fill-danger') : 'fill-primary';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <svg
        ref={svgRef}
        viewBox="0 0 100 22"
        role="img"
        aria-label={label}
        onPointerDown={tap}
        className={cn('w-full touch-none', locked ? '' : 'cursor-pointer')}
      >
        <line x1={4} y1={11} x2={96} y2={11} className="stroke-border-strong" strokeWidth={0.6} />
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={x(v)}
              y1={8}
              x2={x(v)}
              y2={14}
              className="stroke-border-strong"
              strokeWidth={0.5}
            />
            <text
              x={x(v)}
              y={20}
              textAnchor="middle"
              className="fill-foreground-muted"
              style={{ fontSize: 3 }}
            >
              {v}
            </text>
          </g>
        ))}
        {/* Correct answer marker (ghost) after checking. */}
        {reveal && !reveal.correct ? (
          <polygon
            points={`${x(reveal.answer)},6 ${x(reveal.answer) - 2.2},1.5 ${x(reveal.answer) + 2.2},1.5`}
            className="fill-success"
          />
        ) : null}
        {/* Learner marker. */}
        {value != null ? (
          <g className={cn(reveal?.correct === true && POP, reveal?.correct === false && SHAKE)}>
            <polygon
              points={`${x(value)},7 ${x(value) - 2.6},2 ${x(value) + 2.6},2`}
              className={markColor}
            />
          </g>
        ) : null}
      </svg>
      {reveal ? (
        <span
          className={cn(
            'flex items-center gap-1.5 text-sm font-semibold',
            reveal.correct ? 'text-success' : 'text-danger',
          )}
        >
          {reveal.correct ? <Check className="size-4" /> : <X className="size-4" />}
          {reveal.correct ? null : reveal.answer}
        </span>
      ) : null}
    </div>
  );
}
