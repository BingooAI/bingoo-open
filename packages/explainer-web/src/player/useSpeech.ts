// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * useSpeech.ts — keyless voice-over fallback via the browser Web Speech API.
 *
 * The player already plays a pre-generated `audioUrl` (ElevenLabs) when present;
 * this speaks the active caption live with `speechSynthesis` when there is NO
 * audioUrl — so every lesson has a voice offline with no API key. Enable only
 * when `enabled` (i.e. no audioUrl) so the two paths never double up.
 */
'use client'
import { useEffect, useRef } from 'react'

/** locale → BCP-47 speech lang, so the browser voice matches the chosen language. */
const SPEECH_LANG: Record<string, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  fr: 'fr-FR',
  ja: 'ja-JP',
  zh: 'zh-CN',
  es: 'es-ES',
  ko: 'ko-KR',
  de: 'de-DE',
}
export function speechLang(locale: string | undefined): string {
  if (!locale) return 'vi-VN'
  return SPEECH_LANG[locale.slice(0, 2).toLowerCase()] ?? locale
}

export function useSpeech(
  text: string | null,
  opts: { playing: boolean; muted: boolean; enabled: boolean; lang?: string },
) {
  const spokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synth = window.speechSynthesis

    // paused / muted / disabled (has real audio) → stop any speech
    if (!opts.enabled || opts.muted || !opts.playing) {
      synth.cancel()
      spokenRef.current = null
      return
    }
    // speak each caption once as it becomes active
    if (!text || text === spokenRef.current) return
    spokenRef.current = text
    synth.cancel()

    const u = new SpeechSynthesisUtterance(text)
    const lang = opts.lang ?? 'vi-VN'
    u.lang = lang
    u.rate = 1
    u.pitch = 1
    const pick = synth
      .getVoices()
      .find((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
    if (pick) u.voice = pick
    synth.speak(u)
  }, [text, opts.playing, opts.muted, opts.enabled, opts.lang])

  // stop speaking on unmount
  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    [],
  )
}
