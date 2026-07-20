// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { deriveCapabilities } from '@bingoo.ai/learning-experience'
import { cn } from '@bingoo.ai/ui-web'
import type { ReactNode } from 'react'
import { ChromeBar } from './chrome-bar'
import { ArenaMode, PracticeBattle } from './modes/arena-mode'
import { ClassroomMode } from './modes/classroom-mode'
import { FeedMode } from './modes/feed-mode'
import { LessonMode } from './modes/lesson-mode'
import { ProjectMode } from './modes/project-mode'
import type { LearnExperienceProps } from './types'

/**
 * LearnExperience — CỬA DUY NHẤT: cho `input` (descriptor + content + labels) → ra `view`.
 * Trục Experience quyết bề mặt; Delivery=classroom → lớp live; các trục khác thêm chrome (live/roster).
 * Package i18n-free, content-agnostic, tái dùng engine/component THẬT của bingoo.
 */
export function LearnExperience({
  descriptor,
  format = 'lesson',
  content,
  labels,
  modeLabel,
  hud,
  renderActivity,
  companionSlot,
  onExit,
  onSelectLesson,
  className,
}: LearnExperienceProps) {
  const caps = deriveCapabilities(descriptor)
  const isClassroom = descriptor.delivery === 'classroom'
  const showCompanion =
    companionSlot != null &&
    !isClassroom &&
    descriptor.experience !== 'feed' &&
    (caps.includes('ai-tutor') || caps.includes('human-presence'))

  let body: ReactNode
  if (isClassroom) {
    body = <ClassroomMode participants={content.participants ?? []} labels={labels} onExit={onExit} />
  } else {
    switch (descriptor.experience) {
      case 'learn':
        body = (
          <LessonMode
            format={format}
            steps={content.steps ?? []}
            course={content.course}
            labels={labels}
            hud={hud}
            onExit={onExit}
            renderActivity={renderActivity}
            onSelectLesson={onSelectLesson}
          />
        )
        break
      case 'practice':
        body = <PracticeBattle quiz={content.quiz} labels={labels} config={content.arena} />
        break
      case 'arena':
        body = (
          <ArenaMode
            quiz={content.quiz}
            leaderboard={content.leaderboard}
            opponents={content.opponents}
            labels={labels}
            config={content.arena}
          />
        )
        break
      case 'feed':
        body = (
          <FeedMode
            steps={content.steps ?? []}
            topics={content.topics}
            labels={labels}
            renderActivity={renderActivity}
          />
        )
        break
      case 'project':
        body = <ProjectMode project={content.project} labels={labels} />
        break
    }
  }

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col', className)}>
      {isClassroom ? null : (
        <ChromeBar caps={caps} labels={labels} modeLabel={modeLabel} participants={content.participants} />
      )}
      <div className="min-h-0 flex-1">{body}</div>
      {showCompanion ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-10 max-w-[16rem]">
          <div className="pointer-events-auto rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
            {companionSlot}
          </div>
        </div>
      ) : null}
    </div>
  )
}
