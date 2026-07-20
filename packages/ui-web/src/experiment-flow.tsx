// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { Check, Eye, FlaskConical, Lightbulb, Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from './button'
import { cn } from './lib/cn'
import { POP, SHAKE, stagger, tile } from './lib/interactive'

export interface ExperimentHypothesis {
  question: ReactNode
  options: { id: string; label: ReactNode; emoji?: string }[]
  /** The option that matches what actually happens. */
  correctId: string
}

export interface ExperimentFlowProps {
  title?: ReactNode
  /** The four stage names, in order. */
  stageLabels: { predict: string; experiment: string; observe: string; conclude: string }
  hypothesis: ExperimentHypothesis
  /** The procedure — each step is checked off before moving on. */
  procedure: { id: string; label: ReactNode }[]
  /** What is revealed at the Observe stage (text, emoji, image slot…). */
  observation: ReactNode
  /** The takeaway shown at the Conclude stage. */
  conclusion: ReactNode
  labels: {
    next: string
    back: string
    finish: string
    yourGuess: string
    correct: string
    incorrect: string
  }
  onComplete?: (result: { prediction: string | null; correct: boolean }) => void
  className?: string
}

const STAGE_ICONS = [Lightbulb, FlaskConical, Eye, Sparkles]

/**
 * The scientific method as an interactive flow: Predict → Experiment → Observe →
 * Conclude. The learner commits a hypothesis, checks off each procedure step,
 * sees the result, then compares it to their guess. Self-contained; i18n-free.
 */
export function ExperimentFlow({
  title,
  stageLabels,
  hypothesis,
  procedure,
  observation,
  conclusion,
  labels,
  onComplete,
  className,
}: ExperimentFlowProps) {
  const stages = [stageLabels.predict, stageLabels.experiment, stageLabels.observe, stageLabels.conclude]
  const [stage, setStage] = useState(0)
  const [prediction, setPrediction] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const allChecked = procedure.every((s) => checked.has(s.id))
  const canNext = stage === 0 ? prediction != null : stage === 1 ? allChecked : true
  const isLast = stage === stages.length - 1
  const correct = prediction === hypothesis.correctId
  const guessLabel = hypothesis.options.find((o) => o.id === prediction)

  function toggleStep(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function advance() {
    if (isLast) {
      onComplete?.({ prediction, correct })
      return
    }
    setStage((s) => s + 1)
  }

  return (
    <div className={cn('flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5', className)}>
      {title ? <h3 className="font-display text-lg font-bold text-foreground">{title}</h3> : null}

      {/* Stage tracker */}
      <ol className="flex items-center gap-1.5">
        {stages.map((name, i) => {
          const Icon = STAGE_ICONS[i]!
          const done = i < stage
          const active = i === stage
          return (
            <li key={name} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded',
                    i === 0 ? 'opacity-0' : done || active ? 'bg-primary' : 'bg-border',
                  )}
                />
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors',
                    done && 'border-primary bg-primary text-primary-foreground',
                    active && 'border-primary bg-primary-soft text-primary',
                    !done && !active && 'border-border bg-surface text-foreground-subtle',
                  )}
                >
                  {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded',
                    i === stages.length - 1 ? 'opacity-0' : done ? 'bg-primary' : 'bg-border',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-center text-2xs font-semibold uppercase tracking-wide',
                  active ? 'text-primary' : 'text-foreground-subtle',
                )}
              >
                {name}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Stage body */}
      <div key={stage} className="min-h-24 motion-safe:animate-fade-up">
        {stage === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="font-medium text-foreground">{hypothesis.question}</p>
            <div className="flex flex-wrap gap-2">
              {hypothesis.options.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={prediction === o.id}
                  onClick={() => setPrediction(o.id)}
                  style={stagger(i)}
                  className={cn(
                    tile({
                      state: prediction === o.id ? 'selected' : 'idle',
                      size: 'none',
                    }),
                    'inline-flex items-center gap-2 rounded-xl px-3 py-2 font-semibold',
                    'motion-safe:animate-fade-up',
                    prediction === o.id && 'text-primary-soft-foreground',
                  )}
                >
                  {o.emoji ? <span aria-hidden>{o.emoji}</span> : null}
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {stage === 1 ? (
          <ul className="flex flex-col gap-2">
            {procedure.map((s, i) => {
              const on = checked.has(s.id)
              return (
                <li key={s.id} className="motion-safe:animate-fade-up" style={stagger(i)}>
                  <button
                    type="button"
                    onClick={() => toggleStep(s.id)}
                    className={cn(
                      // A ticked step is a small win — it lands with the same pop as a correct answer.
                      tile({ state: on ? 'correct' : 'idle', size: 'none' }),
                      'flex w-full items-center gap-3 rounded-xl p-3 text-left',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-md border-2',
                        on ? 'border-success bg-success text-white' : 'border-border-strong',
                      )}
                    >
                      {on ? (
                        <Check className="size-4" />
                      ) : (
                        <span className="text-xs font-bold text-foreground-subtle">{i + 1}</span>
                      )}
                    </span>
                    <span className={cn('font-medium', on ? 'text-success' : 'text-foreground')}>
                      {s.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        {stage === 2 ? (
          <div className="rounded-xl border-2 border-accent-teal/40 bg-accent-teal-soft/40 p-4 text-foreground">
            {observation}
          </div>
        ) : null}

        {stage === 3 ? (
          <div className="flex flex-col gap-3">
            {prediction ? (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold',
                  correct
                    ? cn('border-success bg-success-soft text-success', POP)
                    : cn('border-warning bg-warning-soft text-warning', SHAKE),
                )}
              >
                {correct ? <Check className="size-4" /> : null}
                <span>
                  {labels.yourGuess} {guessLabel?.emoji} {guessLabel?.label} —{' '}
                  {correct ? labels.correct : labels.incorrect}
                </span>
              </div>
            ) : null}
            <div className="rounded-xl border-2 border-primary/30 bg-primary-soft/40 p-4 text-foreground">
              {conclusion}
            </div>
          </div>
        ) : null}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStage((s) => s - 1)} disabled={stage === 0}>
          {labels.back}
        </Button>
        <Button onClick={advance} disabled={!canNext}>
          {isLast ? labels.finish : labels.next}
        </Button>
      </div>
    </div>
  )
}
