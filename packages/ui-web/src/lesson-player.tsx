'use client'

import { BookOpen, Check, FlaskConical, Lock, PlayCircle, PencilLine, HelpCircle } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Button } from './button'
import { cn } from './lib/cn'

export type LessonSectionKind = 'read' | 'watch' | 'practice' | 'quiz' | 'experiment'

export interface LessonSection {
  id: string
  title: ReactNode
  kind?: LessonSectionKind
}

export interface LessonPlayerProps {
  sections: LessonSection[]
  /** Active section index. */
  current: number
  /** Ids of completed sections. */
  completed: string[]
  /** Jump to a section (rail click). Locked sections shouldn't call this. */
  onSelect: (index: number) => void
  onPrev?: () => void
  /** Advance to the next section (the caller marks current complete). */
  onNext: () => void
  /** Body of the active section (video, reading, quiz…). */
  children: ReactNode
  labels: {
    prev: string
    next: string
    finish: string
    /** e.g. (2, 5) => "2 of 5 done". */
    progress?: (done: number, total: number) => string
  }
  /** Gate later sections until earlier ones are complete. */
  locked?: boolean
  className?: string
}

const KIND_ICON: Record<LessonSectionKind, ComponentType<{ className?: string }>> = {
  read: BookOpen,
  watch: PlayCircle,
  practice: PencilLine,
  quiz: HelpCircle,
  experiment: FlaskConical,
}

/**
 * A lesson container: sequences heterogeneous sections (read → watch → practice →
 * quiz → experiment) with a progress rail and prev/next nav. The active section's
 * body is a slot, so the package bundles no video/quiz engine. Controlled; i18n-free.
 */
export function LessonPlayer({
  sections,
  current,
  completed,
  onSelect,
  onPrev,
  onNext,
  children,
  labels,
  locked,
  className,
}: LessonPlayerProps) {
  const done = new Set(completed)
  const total = sections.length
  const isLast = current >= total - 1
  const pct = total > 0 ? Math.round((done.size / total) * 100) : 0
  const firstIncomplete = sections.findIndex((s) => !done.has(s.id))

  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5', className)}>
      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">{sections[current]?.title}</span>
          {labels.progress ? (
            <span className="text-foreground-muted">{labels.progress(done.size, total)}</span>
          ) : null}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Section rail */}
      <ol className="flex flex-wrap gap-2">
        {sections.map((s, i) => {
          const Icon = KIND_ICON[s.kind ?? 'read']
          const isDone = done.has(s.id)
          const isActive = i === current
          // Locked = a later, not-yet-reached, not-done section (when gating on).
          const isLocked = !!locked && !isDone && !isActive && firstIncomplete >= 0 && i > firstIncomplete
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={isLocked}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onSelect(i)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring',
                  isActive && 'border-primary bg-primary-soft text-primary',
                  !isActive && isDone && 'border-success bg-success-soft text-success',
                  !isActive &&
                    !isDone &&
                    !isLocked &&
                    'border-border bg-surface text-foreground-muted hover:border-primary',
                  isLocked && 'cursor-not-allowed border-border bg-surface-muted text-foreground-subtle',
                )}
              >
                {isDone ? (
                  <Check className="size-3.5" />
                ) : isLocked ? (
                  <Lock className="size-3.5" />
                ) : (
                  <Icon className="size-3.5" />
                )}
                {s.title}
              </button>
            </li>
          )
        })}
      </ol>

      {/* Active section body */}
      <div key={current} className="motion-safe:animate-fade-up">
        {children}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onPrev} disabled={current === 0 || !onPrev}>
          {labels.prev}
        </Button>
        <Button onClick={onNext}>{isLast ? labels.finish : labels.next}</Button>
      </div>
    </div>
  )
}
