// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { deriveCapabilities, type ExperienceDescriptor } from '@bingoo.ai/learning-experience'
import type { ReactNode } from 'react'
import { LearningExperienceBadge, type LearningExperienceLabels } from './learning-experience-card'
import { cn } from './lib/cn'

export interface LearningExperienceShellProps {
  descriptor: ExperienceDescriptor
  labels: LearningExperienceLabels
  title?: ReactNode
  /** Panel đồng hành (AI tutor / avatar giáo viên…). Chỉ hiện khi cần theo năng lực suy ra. */
  companionSlot?: ReactNode
  /** Bề mặt trải nghiệm thật do host cắm vào (lesson runtime, arena board, feed…). */
  children: ReactNode
  className?: string
}

/**
 * Khung host cắm bề mặt trải nghiệm. Chrome TỰ THÍCH ỨNG theo descriptor: header mang dải 5 trục;
 * cột đồng hành chỉ xuất hiện khi năng lực suy ra có `ai-tutor`/`human-presence`. Engine quyết "cần
 * gì", shell chỉ bày chỗ — host tự quyết render gì vào từng slot.
 */
export function LearningExperienceShell({
  descriptor,
  labels,
  title,
  companionSlot,
  children,
  className,
}: LearningExperienceShellProps) {
  const capabilities = deriveCapabilities(descriptor)
  const hasCompanion =
    companionSlot != null && (capabilities.includes('ai-tutor') || capabilities.includes('human-presence'))

  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-[var(--radius-card,1.5rem)] border border-border bg-surface p-4',
        className,
      )}
    >
      <header className="flex flex-col gap-2">
        {title != null ? <h3 className="font-display text-lg font-bold text-foreground">{title}</h3> : null}
        <LearningExperienceBadge descriptor={descriptor} labels={labels} />
      </header>

      <div className={cn('grid gap-4', hasCompanion && 'md:grid-cols-[1fr_16rem]')}>
        <div className="min-w-0 rounded-2xl bg-surface-muted p-4">{children}</div>
        {hasCompanion ? (
          <aside className="rounded-2xl border border-border bg-surface p-3">{companionSlot}</aside>
        ) : null}
      </div>
    </section>
  )
}
