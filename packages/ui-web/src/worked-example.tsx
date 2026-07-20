'use client'

import { Lightbulb, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './lib/cn'
import { ENTER, POP, stagger } from './lib/interactive'

export interface WorkedExampleProps {
  /** Badge copy, e.g. "Worked example" / "Ví dụ mẫu". */
  label: string
  /** The problem being modelled. */
  prompt: ReactNode
  /** The solution, one node per step (rendered as a numbered list). */
  steps: ReactNode[]
  /** The final answer, highlighted. */
  answer: ReactNode
  /** Label before the answer, e.g. "Answer". */
  answerLabel?: string
  /** Optional tip shown under the answer. */
  note?: ReactNode
  className?: string
}

/**
 * "One done for you" — a fully worked example that precedes a practice set
 * (the worked-example effect). Numbered solution steps + a highlighted answer,
 * visually distinct from interactive tasks so it reads as a model. i18n-free.
 */
export function WorkedExample({
  label,
  prompt,
  steps,
  answer,
  answerLabel,
  note,
  className,
}: WorkedExampleProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-soft/25 p-5',
        ENTER,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-primary-foreground">
          <Sparkles className="size-3" />
          {label}
        </span>
      </div>

      <p className="font-semibold text-foreground">{prompt}</p>

      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={i} className={cn('flex items-start gap-3', ENTER)} style={stagger(i)}>
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
              {i + 1}
            </span>
            <span className="text-foreground">{step}</span>
          </li>
        ))}
      </ol>

      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border-2 border-success bg-success-soft px-3 py-2',
          POP,
        )}
      >
        {answerLabel ? (
          <span className="text-xs font-bold uppercase tracking-wide text-success">{answerLabel}</span>
        ) : null}
        <span className="font-bold text-success">{answer}</span>
      </div>

      {note ? (
        <p className="flex items-start gap-2 text-sm text-foreground-muted">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
          {note}
        </p>
      ) : null}
    </div>
  )
}
