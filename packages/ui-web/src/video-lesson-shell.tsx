'use client';

import { Pause, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './lib/cn';

function mmss(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export interface VideoLessonShellProps {
  /** The actual media element (caller owns it, e.g. <video ref>). */
  media?: ReactNode;
  poster?: string;
  playing: boolean;
  /** Seconds. */
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  title?: ReactNode;
  playLabel?: string;
  pauseLabel?: string;
  className?: string;
}

/**
 * Player chrome for a video lesson — controlled (playback state + callbacks) with
 * the media as a slot, so the package bundles no video library. 16:9 and fluid;
 * works web + native (native twin uses expo-video in the slot). i18n-free.
 */
export function VideoLessonShell({
  media,
  poster,
  playing,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  title,
  playLabel,
  pauseLabel,
  className,
}: VideoLessonShellProps) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-surface', className)}>
      <div className="relative aspect-video bg-black">
        {media ?? (poster ? <img src={poster} alt="" className="size-full object-cover" /> : null)}
        <button
          type="button"
          onClick={onPlayPause}
          aria-label={playing ? pauseLabel : playLabel}
          className="absolute inset-0 grid place-items-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {!playing ? (
            <span className="grid size-16 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition-transform hover:scale-105">
              <Play className="size-7 translate-x-0.5 fill-white" />
            </span>
          ) : null}
        </button>
      </div>
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onPlayPause}
          aria-label={playing ? pauseLabel : playLabel}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring"
        >
          {playing ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 translate-x-0.5 fill-current" />
          )}
        </button>
        {title ? (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {title}
          </span>
        ) : null}
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => onSeek(Number(e.target.value))}
          className={cn(
            'h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-muted accent-primary',
            !title && 'order-none',
          )}
        />
        <span className="shrink-0 text-xs tabular-nums text-foreground-muted">
          {mmss(currentTime)} / {mmss(duration)}
        </span>
      </div>
    </div>
  );
}
