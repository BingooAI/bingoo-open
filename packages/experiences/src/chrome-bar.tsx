import { AvatarGroup } from '@bingoo/ui-web'
import { Radio } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Capability } from '@bingoo/learning-experience'
import type { ExperienceLabels, Participant } from './types'

/** Thanh chrome phản ánh companion/scale/time/delivery qua năng lực suy ra (live/scheduled/roster). */
export function ChromeBar({
  caps,
  labels,
  modeLabel,
  participants,
}: {
  caps: readonly Capability[]
  labels: ExperienceLabels
  modeLabel?: ReactNode
  participants?: Participant[]
}) {
  const live = caps.includes('realtime')
  const scheduled = caps.includes('scheduling')
  const roster = caps.includes('social-chat') && participants != null && participants.length > 0
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
      {modeLabel ? (
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">
          {modeLabel}
        </span>
      ) : null}
      {live ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-bold text-danger">
          <Radio className="size-3 motion-safe:animate-pulse" /> {labels.chrome.live}
        </span>
      ) : null}
      {scheduled ? (
        <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-foreground-muted">
          {labels.chrome.scheduled}
        </span>
      ) : null}
      <span className="grow" />
      {roster && participants ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-xs text-foreground-muted">
            {participants.length} {labels.chrome.participants}
          </span>
          <AvatarGroup avatars={participants} max={4} />
        </span>
      ) : null}
    </div>
  )
}
