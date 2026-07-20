// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import {
  Button,
  Card,
  ContentBlocks,
  LearningPath,
  LessonCard,
  PageHeader,
  Progress,
  QuizProgress,
  StreakBadge,
  XPBar,
  type InteractiveBlock,
} from '@bingoo.ai/ui-web'
import { Sparkles, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CompletedCard, EmptyState, ScrollArea } from '../shared'
import type { ExperienceLabels, LearnCourseData, LearnFormat, LearnHud, LearnStep } from '../types'

export function LessonMode({
  format,
  steps,
  course,
  labels,
  hud,
  onExit,
  renderActivity,
  onSelectLesson,
}: {
  format: LearnFormat
  steps: LearnStep[]
  course?: LearnCourseData
  labels: ExperienceLabels
  hud?: LearnHud
  onExit?: () => void
  renderActivity?: (b: InteractiveBlock) => ReactNode
  onSelectLesson?: (id: string) => void
}) {
  if (format === 'course')
    return (
      <ScrollArea>
        <CourseView course={course} labels={labels} onSelectLesson={onSelectLesson} />
      </ScrollArea>
    )
  if (format === 'infinite')
    return (
      <ScrollArea>
        <InfiniteView steps={steps} labels={labels} renderActivity={renderActivity} />
      </ScrollArea>
    )
  return (
    <LessonView steps={steps} labels={labels} hud={hud} onExit={onExit} renderActivity={renderActivity} />
  )
}

function LessonView({
  steps,
  labels,
  hud,
  onExit,
  renderActivity,
}: {
  steps: LearnStep[]
  labels: ExperienceLabels
  hud?: LearnHud
  onExit?: () => void
  renderActivity?: (b: InteractiveBlock) => ReactNode
}) {
  const [current, setCurrent] = useState(0)
  const [done, setDone] = useState(false)
  if (steps.length === 0) return <EmptyState>{labels.empty}</EmptyState>
  const isLast = current >= steps.length - 1
  const step = steps[current]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            aria-label={labels.exit}
            className="grid size-9 shrink-0 place-items-center rounded-full text-foreground-muted outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-[18px]" />
          </button>
        ) : null}
        <QuizProgress
          total={steps.length}
          index={done ? steps.length - 1 : current}
          lives={hud?.hearts}
          className="min-w-0 flex-1"
        />
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {hud?.xp != null ? (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-accent-sunbeam">
              <Sparkles className="size-4" /> {hud.xp}
            </span>
          ) : null}
          {hud?.streak != null ? <StreakBadge days={hud.streak} /> : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-10">
          {done ? (
            <CompletedCard
              title={labels.completed}
              restart={labels.restart}
              onRestart={() => {
                setCurrent(0)
                setDone(false)
              }}
            />
          ) : (
            <div key={current} className="flex flex-col gap-4 motion-safe:animate-fade-up">
              {step?.eyebrow ? (
                <span className="font-display text-xs font-bold uppercase tracking-wide text-primary">
                  {step.eyebrow}
                </span>
              ) : null}
              {step ? (
                <ContentBlocks
                  blocks={step.blocks}
                  discussLabels={labels.discuss}
                  renderActivity={renderActivity}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      {!done ? (
        <footer className="shrink-0 border-t border-border bg-surface px-4 py-4">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}>
              {labels.prev}
            </Button>
            <Button className="min-w-32" onClick={() => (isLast ? setDone(true) : setCurrent((c) => c + 1))}>
              {isLast ? labels.finish : labels.next}
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  )
}

export function InfiniteView({
  steps,
  labels,
  renderActivity,
}: {
  steps: LearnStep[]
  labels: ExperienceLabels
  renderActivity?: (b: InteractiveBlock) => ReactNode
}) {
  const [count, setCount] = useState(Math.min(3, steps.length))
  if (steps.length === 0) return <EmptyState>{labels.empty}</EmptyState>
  const shown = Array.from({ length: count }, (_, i) => ({
    key: i,
    step: steps[i % steps.length],
  }))
  return (
    <div className="flex flex-col gap-4">
      {shown.map(({ key, step }) =>
        step ? (
          <Card key={key} className="flex flex-col gap-2 p-5 motion-safe:animate-fade-up">
            {step.eyebrow ? (
              <span className="font-display text-xs font-bold uppercase tracking-wide text-primary">
                {step.eyebrow}
              </span>
            ) : null}
            <ContentBlocks
              blocks={step.blocks}
              discussLabels={labels.discuss}
              renderActivity={renderActivity}
            />
          </Card>
        ) : null,
      )}
      <Button variant="secondary" className="self-center" onClick={() => setCount((c) => c + 3)}>
        {labels.loadMore}
      </Button>
    </div>
  )
}

function CourseView({
  course,
  labels,
  onSelectLesson,
}: {
  course?: LearnCourseData
  labels: ExperienceLabels
  onSelectLesson?: (id: string) => void
}) {
  if (!course) return <EmptyState>{labels.empty}</EmptyState>
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={course.title}
        description={course.subtitle}
        actions={
          course.xp ? (
            <div className="w-48">
              <XPBar level={course.xp.level} xp={course.xp.xp} nextXp={course.xp.nextXp} />
            </div>
          ) : undefined
        }
      />
      {course.progress != null ? <Progress value={course.progress} /> : null}
      {course.path && course.path.length > 0 ? (
        <div className="overflow-x-auto pb-1">
          <LearningPath nodes={course.path} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {course.lessons.map((l) => (
          <LessonCard
            key={l.id}
            icon={l.icon ?? <span className="text-lg">📘</span>}
            title={l.title}
            meta={l.meta}
            color={l.color}
            progress={l.progress}
            cta={labels.start}
            onStart={onSelectLesson ? () => onSelectLesson(l.id) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
