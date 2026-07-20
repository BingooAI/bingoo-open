// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { Music, Play } from 'lucide-react'
import { cn } from './lib/cn'
import { ENTER, tile } from './lib/interactive'

export interface LyricLine {
  text: string
  /** Seconds into the audio. Give every line one to get karaoke highlighting. */
  at?: number
}

export interface LyricsSheetProps {
  title: string
  lines: LyricLine[]
  audioSrc?: string
  /** Play the track. The app owns playback. */
  onPlayAudio?: (src: string) => void
  /** Where playback has reached, in seconds — feed this to light up the current line. */
  audioTime?: number
  className?: string
}

/** Find the line that should be lit at `t` — the last one whose `at` has passed. */
function currentLine(lines: LyricLine[], t?: number): number {
  if (t === undefined) return -1
  let hit = -1
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i]?.at
    if (at !== undefined && at <= t) hit = i
  }
  return hit
}

/**
 * A song / chant / rhyme with its words — 176 of them across the series, and the main way
 * the early stages teach English. Karaoke highlighting turns on by itself once the lines
 * carry timings and the app feeds `audioTime`. i18n-free.
 */
export function LyricsSheet({ title, lines, audioSrc, onPlayAudio, audioTime, className }: LyricsSheetProps) {
  const active = currentLine(lines, audioTime)

  return (
    <section className={cn('rounded-2xl border-2 border-primary/40 bg-surface p-4', ENTER, className)}>
      <header className="mb-3 flex items-center gap-2">
        <Music className="size-4 text-primary" />
        <h4 className="flex-1 font-display text-base font-bold text-foreground">{title}</h4>
        {audioSrc && onPlayAudio ? (
          <button
            type="button"
            onClick={() => onPlayAudio(audioSrc)}
            aria-label={title}
            className={cn(
              tile({ state: 'idle', size: 'none' }),
              'grid size-10 place-items-center rounded-full border-transparent bg-primary text-primary-foreground',
              'hover:border-transparent motion-safe:hover:scale-105',
            )}
          >
            <Play className="size-4 fill-current" />
          </button>
        ) : null}
      </header>

      <ol className="flex flex-col gap-1">
        {lines.map((l, i) => (
          <li
            key={i}
            className={cn(
              'rounded-lg px-2 py-1 text-base transition-colors',
              i === active ? 'bg-primary-soft font-bold text-primary' : 'text-foreground',
            )}
          >
            {l.text}
          </li>
        ))}
      </ol>
    </section>
  )
}
