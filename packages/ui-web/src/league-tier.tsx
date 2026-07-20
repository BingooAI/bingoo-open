// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react'
import { cn } from './lib/cn'
import { hudSurfaceClass } from './lib/hud'
import { Progress } from './progress'

export interface LeagueTierProps {
  /** Tier medallion (emoji or icon — data). */
  icon: ReactNode
  tierLabel: ReactNode
  /** 0–1 progress toward the next tier. Omit to hide the bar. */
  progress?: number
  /** Caption under the bar, e.g. "120 → Vàng". */
  caption?: ReactNode
  onMedia?: boolean
  className?: string
}

/**
 * A league/rank tier medallion + progress toward the next tier. The tier
 * resolution (`leagueFromPoints`) lives in `@bingoo.ai/core`; this renders the
 * result. Reused on a profile, a leaderboard header, or an arena banner.
 */
export function LeagueTier({ icon, tierLabel, progress, caption, onMedia, className }: LeagueTierProps) {
  const ink = onMedia ? 'text-white' : 'text-foreground'
  const muted = onMedia ? 'text-white/70' : 'text-foreground-muted'
  return (
    <div
      className={cn('flex w-full items-center gap-3 rounded-2xl p-3', hudSurfaceClass(onMedia), className)}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-brand text-2xl shadow-pop">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn('font-display text-base font-bold', ink)}>{tierLabel}</span>
        {progress != null ? <Progress value={Math.max(0, Math.min(1, progress)) * 100} /> : null}
        {caption ? <span className={cn('text-xs', muted)}>{caption}</span> : null}
      </div>
    </div>
  )
}
