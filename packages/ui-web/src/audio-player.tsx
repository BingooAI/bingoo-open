'use client'

import { Pause, Play } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './lib/cn'

function mmss(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export interface AudioPlayerProps {
  playing: boolean
  currentTime: number
  duration: number
  onPlayPause: () => void
  onSeek: (time: number) => void
  title?: ReactNode
  leading?: ReactNode
  playLabel?: string
  pauseLabel?: string
  onMedia?: boolean
  className?: string
}

/** Audio player chrome — controlled (playback state + callbacks); the caller owns
 * the actual audio. Reusable for lessons, pronunciation, music, or feed. i18n-free. */
export function AudioPlayer({
  playing,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  title,
  leading,
  playLabel,
  pauseLabel,
  onMedia,
  className,
}: AudioPlayerProps) {
  const surface = onMedia ? 'bg-black/40 backdrop-blur-md border-white/15' : 'bg-surface border-border'
  const ink = onMedia ? 'text-white' : 'text-foreground'
  const muted = onMedia ? 'text-white/70' : 'text-foreground-muted'
  return (
    <div className={cn('flex items-center gap-3 rounded-full border p-2 pr-4', surface, className)}>
      <button
        type="button"
        onClick={onPlayPause}
        aria-label={playing ? pauseLabel : playLabel}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring"
      >
        {playing ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="size-4 translate-x-0.5 fill-current" />
        )}
      </button>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <span className={cn('truncate text-sm font-semibold', ink)}>{title}</span> : null}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-muted accent-primary"
          />
          <span className={cn('shrink-0 text-xs tabular-nums', muted)}>{mmss(currentTime)}</span>
        </div>
      </div>
    </div>
  )
}
