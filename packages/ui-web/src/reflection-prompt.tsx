'use client';

import { useState } from 'react';
import { cn } from './lib/cn';
import { ENTER, stagger, tile } from './lib/interactive';

export type ConfidenceFace = 'sad' | 'ok' | 'happy';
const FACES: Array<{ id: ConfidenceFace; glyph: string }> = [
  { id: 'sad', glyph: '🙁' },
  { id: 'ok', glyph: '😐' },
  { id: 'happy', glyph: '🙂' },
];

export interface ReflectionPromptProps {
  title?: string;
  prompts: string[];
  /** Show the 3-face confidence scale the books use. */
  faces?: boolean;
  /** Controlled: prompt index → how confident the learner feels. Uncontrolled if omitted. */
  value?: Record<number, ConfidenceFace>;
  onChange?: (value: Record<number, ConfidenceFace>) => void;
  className?: string;
}

/**
 * "Look what I can do" — the reflection box that closes every Cambridge unit. The learner
 * rates their own confidence on each statement. Nothing is marked; it is metacognition.
 * i18n-free (faces are emoji, statements come from the data).
 */
export function ReflectionPrompt({
  title,
  prompts,
  faces = true,
  value,
  onChange,
  className,
}: ReflectionPromptProps) {
  const [own, setOwn] = useState<Record<number, ConfidenceFace>>({});
  const picked = value ?? own;
  const set = (i: number, f: ConfidenceFace) => {
    const next = { ...picked, [i]: f };
    if (onChange) onChange(next);
    else setOwn(next);
  };

  return (
    <section
      className={cn('rounded-2xl border-2 border-success/40 bg-success-soft/40 p-4', className)}
    >
      {title ? (
        <h4 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-success">
          {title}
        </h4>
      ) : null}
      <ul className="flex flex-col gap-2">
        {prompts.map((p, i) => (
          <li
            key={i}
            style={stagger(i)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2',
              ENTER,
            )}
          >
            <span className="text-sm text-foreground">{p}</span>
            {faces ? (
              <div className="flex shrink-0 gap-1">
                {FACES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-label={f.id}
                    onClick={() => set(i, f.id)}
                    className={cn(
                      tile({
                        state: picked[i] === f.id ? 'selected' : 'idle',
                        size: 'none',
                      }),
                      'grid size-9 place-items-center rounded-xl text-lg',
                      picked[i] === f.id
                        ? 'border-success bg-success-soft motion-safe:scale-110'
                        : 'opacity-50 hover:opacity-100',
                    )}
                  >
                    {f.glyph}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
