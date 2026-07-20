import { AnswerOption, Button, Card, cn, IconChip, type IconChipColor } from '@bingoo/ui-web'
import { useRef, useState, type ReactNode } from 'react'
import type { ExperienceLabels, LearnQuizItem } from './types'

export function ScrollArea({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">{children}</div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-surface-muted p-10 text-center text-sm text-foreground-muted">{children}</p>
  )
}

export function CompletedCard({
  title,
  restart,
  onRestart,
  emoji = '🎉',
  accent = 'success',
}: {
  title: ReactNode
  restart: ReactNode
  onRestart: () => void
  emoji?: string
  accent?: IconChipColor
}) {
  return (
    <Card className="flex flex-col items-center gap-4 p-10 text-center">
      <IconChip color={accent} tone="gradient" size="lg">
        <span className="text-2xl">{emoji}</span>
      </IconChip>
      <p className="font-display text-xl font-bold text-foreground">{title}</p>
      <Button variant="secondary" onClick={onRestart}>
        {restart}
      </Button>
    </Card>
  )
}

/**
 * Drill — một câu hỏi trắc nghiệm chấm ngay. Không tự giữ điểm/máu: nó BÁO LÊN
 * `onResolved(correct, timeMs)` để MÁY (arena engine) quyết. Đo thời gian trả lời thật (cho thưởng tốc độ).
 */
export function Drill({
  question,
  index,
  total,
  labels,
  accent = 'primary',
  onResolved,
  onNext,
}: {
  question: LearnQuizItem
  index: number
  total: number
  labels: ExperienceLabels
  accent?: IconChipColor
  onResolved: (correct: boolean, timeMs: number) => void
  onNext: () => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const shownAt = useRef<number>(Date.now())
  const revealed = picked != null
  const correct = picked === question.answerId

  function pick(id: string) {
    if (revealed) return
    setPicked(id)
    onResolved(id === question.answerId, Date.now() - shownAt.current)
  }

  function next() {
    setPicked(null)
    shownAt.current = Date.now()
    onNext()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground-muted">
        <IconChip color={accent} size="sm" tone="soft">
          {index + 1}
        </IconChip>
        <span>
          {index + 1} / {total}
        </span>
      </div>
      <p className="font-display text-lg font-bold text-foreground">{question.prompt}</p>
      <div className="flex flex-col gap-2">
        {question.choices.map((c, i) => {
          const state = !revealed
            ? 'default'
            : c.id === question.answerId
              ? 'correct'
              : picked === c.id
                ? 'incorrect'
                : 'default'
          return (
            <AnswerOption
              key={c.id}
              letter={String.fromCharCode(65 + i)}
              label={c.label}
              state={state}
              disabled={revealed}
              onClick={() => pick(c.id)}
            />
          )
        })}
      </div>
      {revealed ? (
        <div className="flex items-center justify-between gap-3">
          <span className={cn('text-sm font-bold', correct ? 'text-success' : 'text-danger')}>
            {correct ? labels.action.correct : labels.action.incorrect}
          </span>
          <Button className="min-w-28" onClick={next}>
            {labels.action.next}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
