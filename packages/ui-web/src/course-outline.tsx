import type { CourseChapter, CourseLesson, LessonStatus } from '@bingoo/core'
import { CheckCircle2, Circle, Lock, Play } from 'lucide-react'
import type { ReactNode } from 'react'
import { Accordion } from './accordion'
import { cn } from './lib/cn'

export interface CourseOutlineProps {
  /** Chapters from a Course (authored content). */
  chapters: CourseChapter[]
  /** Per-user progress: lessonId → status (runtime state, not authored). */
  status?: Record<string, LessonStatus>
  onSelectLesson?: (lessonId: string) => void
  /** Localized labels for the node kinds. */
  kindLabels?: Partial<Record<CourseLesson['kind'], string>>
  /** Render estimated minutes, e.g. `(m) => \`${m} phút\``. */
  durationLabel?: (min: number) => ReactNode
  /** Which chapter ids start expanded. */
  defaultOpen?: string[]
  className?: string
}

const STATUS_ICON: Record<LessonStatus, ReactNode> = {
  done: <CheckCircle2 className="size-5 text-success" />,
  current: <Play className="size-5 fill-primary text-primary" />,
  locked: <Lock className="size-4 text-foreground-subtle" />,
  available: <Circle className="size-5 text-foreground-muted" />,
}

/** A course/curriculum outline (chapters → lesson nodes) with per-user status.
 * Reuses Accordion. Authored structure + runtime status kept separate. i18n-free. */
export function CourseOutline({
  chapters,
  status,
  onSelectLesson,
  kindLabels,
  durationLabel,
  defaultOpen,
  className,
}: CourseOutlineProps) {
  return (
    <div className={className}>
      <Accordion
        defaultOpen={defaultOpen ?? (chapters[0] ? [chapters[0].id] : [])}
        items={chapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          content: (
            <ul className="flex flex-col gap-1">
              {ch.lessons.map((lesson) => {
                const st = status?.[lesson.id] ?? 'available'
                const locked = st === 'locked'
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      disabled={locked || !onSelectLesson}
                      onClick={() => onSelectLesson?.(lesson.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                        !locked && onSelectLesson && 'hover:bg-surface-muted',
                        locked && 'opacity-55',
                        st === 'current' && 'bg-primary-soft',
                      )}
                    >
                      <span className="grid size-6 shrink-0 place-items-center">{STATUS_ICON[st]}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {lesson.title}
                      </span>
                      {kindLabels?.[lesson.kind] ? (
                        <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-2xs font-semibold text-foreground-muted">
                          {kindLabels[lesson.kind]}
                        </span>
                      ) : null}
                      {lesson.durationMin && durationLabel ? (
                        <span className="shrink-0 text-xs text-foreground-muted">
                          {durationLabel(lesson.durationMin)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ),
        }))}
      />
    </div>
  )
}
