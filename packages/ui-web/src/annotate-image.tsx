'use client';

import { appendPoint, pointsToSvgPath, type DrawPoint, type DrawStroke } from '@bingoo/core';
import { Undo2 } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { cn } from './lib/cn';
import { tile } from './lib/interactive';

export interface AnnotateImageProps {
  imageSrc?: string;
  /** Controlled strokes (open response). */
  strokes: DrawStroke[];
  onChange: (strokes: DrawStroke[]) => void;
  color?: string;
  brushWidth?: number;
  /** Locks drawing after checking (it's an open response). */
  locked?: boolean;
  disabled?: boolean;
  undoLabel?: string;
  label?: string;
  className?: string;
}

/**
 * Draw / annotate on an image — freehand strokes over a picture (circle the odd
 * one out, mark the parts…). Open response: `@bingoo/core` counts any annotation.
 * Geometry helpers are shared with the free-draw canvas; native twin draws alike.
 */
export function AnnotateImage({
  imageSrc,
  strokes,
  onChange,
  color = '#f74c6c',
  brushWidth = 2.5,
  locked,
  disabled,
  undoLabel,
  label,
  className,
}: AnnotateImageProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<DrawPoint[] | null>(null);
  const off = !!locked || disabled;

  const toCanvas = (e: PointerEvent): DrawPoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * 100,
      ((e.clientY - rect.top) / rect.height) * 100,
    ];
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (off) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft([toCanvas(e)]);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (off || !draft) return;
    setDraft(appendPoint(draft, toCanvas(e)));
  };
  const up = () => {
    if (!draft) return;
    if (draft.length > 0) onChange([...strokes, { points: draft, color, width: brushWidth }]);
    setDraft(null);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'relative aspect-video w-full overflow-hidden',
        )}
      >
        {imageSrc ? (
          <img src={imageSrc} alt="" className="absolute inset-0 size-full object-contain" />
        ) : null}
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDraft(null)}
          className={cn('absolute inset-0 size-full touch-none', off ? '' : 'cursor-crosshair')}
        >
          {strokes.map((s, i) => (
            <path
              key={i}
              d={pointsToSvgPath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {draft ? (
            <path
              d={pointsToSvgPath(draft)}
              fill="none"
              stroke={color}
              strokeWidth={brushWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      </div>
      {!off && strokes.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange(strokes.slice(0, -1))}
          aria-label={undoLabel}
          className={cn(
            tile({ size: 'none' }),
            'inline-flex w-fit items-center gap-1.5 self-end rounded-lg px-2.5 py-1 text-xs font-semibold',
          )}
        >
          <Undo2 className="size-3.5" />
          {undoLabel}
        </button>
      ) : null}
    </div>
  );
}
