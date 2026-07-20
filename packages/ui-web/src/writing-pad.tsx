'use client'

import { countWords, type RubricCriterion } from '@bingoo/core'
import { cn } from './lib/cn'
import { POP, stagger, tile } from './lib/interactive'
import { RubricList } from './rubric-list'

export interface WritingLabels {
  /** Heading over the success criteria, e.g. "Bài của em cần có:". */
  criteria: string
  /** Word counter, e.g. (n) => `${n} từ`. */
  words: (n: number) => string
  /** Heading over the model answer shown on reveal. */
  exemplar?: string
  placeholder?: string
}

export interface WritingPadProps {
  text: string
  met: string[]
  onChange: (next: { text: string; met: string[] }) => void
  criteria: RubricCriterion[]
  minWords?: number
  maxWords?: number
  /** A writing frame — sentence openers the learner can tap to insert. */
  starters?: string[]
  labels: WritingLabels
  reveal?: { correct: boolean; need: number; exemplar?: string }
  disabled?: boolean
  className?: string
}

/**
 * Write a sentence / paragraph / explanation. There is no right answer, so the learner
 * ticks the success criteria against their own work (see `RubricList`); grading lives in
 * `@bingoo/core`. A model answer is revealed only after they check. i18n-free.
 */
export function WritingPad({
  text,
  met,
  onChange,
  criteria,
  minWords,
  maxWords,
  starters,
  labels,
  reveal,
  disabled,
  className,
}: WritingPadProps) {
  const locked = !!reveal || disabled
  const n = countWords(text)
  const short = minWords !== undefined && n < minWords
  const long = maxWords !== undefined && n > maxWords

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <RubricList
        criteria={criteria}
        met={met}
        onChange={(next) => onChange({ text, met: next })}
        title={labels.criteria}
        need={reveal?.need}
        reveal={reveal ? { correct: reveal.correct } : undefined}
        disabled={disabled}
      />

      {starters?.length && !locked ? (
        <div className="flex flex-wrap gap-1.5">
          {starters.map((sT, i) => (
            <button
              key={sT}
              type="button"
              onClick={() => onChange({ text: text ? `${text.trimEnd()} ${sT}` : sT, met })}
              style={stagger(i)}
              className={cn(
                tile({ state: 'idle', size: 'none' }),
                'rounded-full border px-2.5 py-1 text-xs font-medium text-foreground-muted',
                'motion-safe:animate-fade-up hover:text-foreground',
              )}
            >
              {sT}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <textarea
          value={text}
          disabled={locked}
          onChange={(e) => onChange({ text: e.target.value, met })}
          placeholder={labels.placeholder}
          rows={5}
          className={cn(
            'w-full resize-y rounded-2xl border-2 bg-surface p-3 text-base text-foreground outline-none transition-colors placeholder:text-foreground-subtle focus:border-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70',
            reveal ? (reveal.correct ? 'border-success' : 'border-danger') : 'border-border',
          )}
        />
        <span
          className={cn(
            'absolute bottom-2 right-3 text-2xs font-semibold tabular-nums',
            short || long ? 'text-danger' : 'text-foreground-subtle',
          )}
        >
          {labels.words(n)}
        </span>
      </div>

      {reveal?.exemplar ? (
        <div className={cn('rounded-2xl border-2 border-success bg-success-soft p-3', POP)}>
          {labels.exemplar ? (
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-success">{labels.exemplar}</p>
          ) : null}
          <p className="text-sm text-foreground">{reveal.exemplar}</p>
        </div>
      ) : null}
    </div>
  )
}
