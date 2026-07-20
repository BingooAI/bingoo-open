'use client'

import type { QuizMedia } from '@bingoo/core'
import { cn } from './lib/cn'
import { SoundButton } from './sound-button'

export interface QuestionMediaProps {
  media: QuizMedia
  /** A11y label for the audio play button (data). */
  playLabel?: string
  className?: string
}

/**
 * Renders a question's attached media: an image (picture questions, preschool)
 * or an audio stinger (listening questions). Only renders when `src` has been
 * resolved (the server resolves library `assetId`s to URLs before delivery).
 */
export function QuestionMedia({ media, playLabel, className }: QuestionMediaProps) {
  if (!media.src) return null
  if (media.kind === 'image') {
    return (
      <img
        src={media.src}
        alt={media.alt ?? ''}
        className={cn('max-h-56 w-full rounded-2xl object-contain', className)}
      />
    )
  }
  if (media.kind === 'video') {
    return (
      <video
        src={media.src}
        controls
        className={cn('max-h-64 w-full rounded-2xl bg-black object-contain', className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-border bg-surface-muted p-3',
        className,
      )}
    >
      <SoundButton src={media.src} label={playLabel ?? ''} tone="solid" size="lg" />
      {media.alt ? <span className="text-sm text-foreground-muted">{media.alt}</span> : null}
    </div>
  )
}
