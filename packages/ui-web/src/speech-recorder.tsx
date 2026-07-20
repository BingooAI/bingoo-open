// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { Mic, Pause, Play, RotateCcw, Square } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from './lib/cn'
import { tile } from './lib/interactive'

export interface SpeechLabels {
  readAloud?: ReactNode
  record: string
  stop: string
  rerecord: string
  play: string
  recording: string
  micDenied?: string
}

export interface SpeechRecorderProps {
  /** The passage/word to read aloud. */
  text?: ReactNode
  /** Controlled: has a recording been made (from the response)? */
  recorded: boolean
  durationMs?: number
  /** Fired when a recording finishes. */
  onRecorded: (durationMs: number) => void
  /** Fired to clear the recording (re-record). */
  onReset?: () => void
  maxSeconds?: number
  labels: SpeechLabels
  disabled?: boolean
  className?: string
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Read aloud / speaking — records the learner's voice with the browser's
 * MediaRecorder (no dependency) and offers playback + re-record. The response is
 * an open one (`@bingoo.ai/core` counts any recording); ASR grading can come later.
 * i18n-free (labels are props). Native twin captures duration via the app's engine.
 */
export function SpeechRecorder({
  text,
  recorded,
  durationMs,
  onRecorded,
  onReset,
  maxSeconds,
  labels,
  disabled,
  className,
}: SpeechRecorderProps) {
  const [status, setStatus] = useState<'idle' | 'recording'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [denied, setDenied] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<BlobPart[]>([])
  const startedAt = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  // Timer while recording (+ auto-stop at maxSeconds).
  useEffect(() => {
    if (status !== 'recording') return
    const id = window.setInterval(() => {
      const ms = Date.now() - startedAt.current
      setElapsed(ms)
      if (maxSeconds && ms >= maxSeconds * 1000) stop()
    }, 200)
    return () => window.clearInterval(id)
  }, [status, maxSeconds])

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  async function start() {
    if (disabled) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        onRecorded(Date.now() - startedAt.current)
      }
      recRef.current = rec
      startedAt.current = Date.now()
      setElapsed(0)
      setDenied(false)
      rec.start()
      setStatus('recording')
    } catch {
      setDenied(true)
    }
  }
  function stop() {
    recRef.current?.stop()
    recRef.current = null
    setStatus('idle')
  }
  function reset() {
    if (url) URL.revokeObjectURL(url)
    setUrl(null)
    setElapsed(0)
    setPlaying(false)
    onReset?.()
  }
  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (playing) el.pause()
    else void el.play()
  }

  const isRecording = status === 'recording'

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-surface p-5',
        className,
      )}
    >
      {text ? <p className="text-center text-lg font-semibold text-foreground">{text}</p> : null}
      {labels.readAloud ? <p className="text-sm text-foreground-muted">{labels.readAloud}</p> : null}

      {/* Timer / status */}
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground-muted">
        {isRecording ? <span className="size-2.5 animate-pulse rounded-full bg-danger" /> : null}
        <span className="tabular-nums">{fmt(isRecording ? elapsed : (durationMs ?? 0))}</span>
        {isRecording ? <span className="text-danger">{labels.recording}</span> : null}
      </div>

      {/* Controls */}
      {!recorded || isRecording ? (
        <button
          type="button"
          disabled={disabled}
          onClick={isRecording ? stop : start}
          className={cn(
            tile({ state: 'idle', size: 'none' }),
            'grid size-16 place-items-center rounded-full border-transparent text-white',
            'hover:border-transparent motion-safe:hover:scale-105',
            isRecording ? 'bg-danger' : 'bg-primary',
          )}
          aria-label={isRecording ? labels.stop : labels.record}
        >
          {isRecording ? <Square className="size-6 fill-current" /> : <Mic className="size-7" />}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          {url ? (
            <>
              <audio
                ref={audioRef}
                src={url}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
              <button
                type="button"
                onClick={togglePlay}
                aria-label={labels.play}
                className={cn(
                  tile({ state: 'idle', size: 'none' }),
                  'grid size-12 place-items-center rounded-full border-transparent bg-primary text-white',
                  'hover:border-transparent hover:bg-primary-hover',
                )}
              >
                {playing ? (
                  <Pause className="size-5 fill-current" />
                ) : (
                  <Play className="size-5 translate-x-0.5 fill-current" />
                )}
              </button>
            </>
          ) : null}
          {onReset ? (
            <button
              type="button"
              disabled={disabled}
              onClick={reset}
              className={cn(
                tile({ state: 'idle', size: 'none' }),
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold',
              )}
            >
              <RotateCcw className="size-4" />
              {labels.rerecord}
            </button>
          ) : null}
        </div>
      )}

      {denied ? <p className="text-xs font-medium text-danger">{labels.micDenied}</p> : null}
    </div>
  )
}
