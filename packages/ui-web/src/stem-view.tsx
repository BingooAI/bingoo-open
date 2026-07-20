// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { RichBlock } from '@bingoo.ai/core'
import { cn } from './lib/cn'
import { SoundButton } from './sound-button'

export interface StemViewProps {
  /** The question body — an ordered mix of text, images, audio and video. */
  body: RichBlock[]
  /** A11y label for audio play buttons (data). */
  playLabel?: string
  className?: string
}

/**
 * Renders a question's rich body (its stem): paragraphs, pictures, sound clips and video
 * in the order the author placed them. This is what lets any primitive — not just
 * multiple-choice — be a "listen and …" or "look at this and …" task. i18n-free: every
 * string arrives in the data.
 */
export function StemView({ body, playLabel, className }: StemViewProps) {
  if (!body.length) return null
  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {body.map((b, i) => {
        switch (b.type) {
          case 'text':
            return (
              <p
                key={i}
                className={cn(
                  'text-foreground',
                  b.emphasis === 'lead' && 'text-lg font-semibold',
                  b.emphasis === 'quote' && 'border-l-4 border-primary/40 pl-3 italic text-foreground-muted',
                )}
              >
                {b.text}
              </p>
            )
          case 'image':
            return b.src ? (
              <img
                key={i}
                src={b.src}
                alt={b.alt ?? ''}
                className="max-h-64 w-full rounded-2xl object-contain"
              />
            ) : null
          case 'video':
            return b.src ? (
              <figure key={i} className="flex flex-col gap-1">
                <video src={b.src} controls className="max-h-72 w-full rounded-2xl bg-black object-contain" />
                {b.caption ? (
                  <figcaption className="text-xs text-foreground-muted">{b.caption}</figcaption>
                ) : null}
              </figure>
            ) : null
          case 'audio':
            return b.src ? (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface-muted p-3"
              >
                <SoundButton src={b.src} label={playLabel ?? ''} tone="solid" size="lg" />
                {b.caption || b.alt ? (
                  <span className="text-sm text-foreground-muted">{b.caption ?? b.alt}</span>
                ) : null}
              </div>
            ) : null
          case 'list':
            return b.ordered ? (
              <ol key={i} className="list-decimal pl-6 text-foreground marker:text-foreground-muted">
                {b.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="list-disc pl-6 text-foreground marker:text-foreground-muted">
                {b.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            )
        }
      })}
    </div>
  )
}
