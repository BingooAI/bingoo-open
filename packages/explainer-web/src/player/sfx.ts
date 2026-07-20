// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * sfx.ts — minimal WebAudio blips so cue-bound `sfx` actions are audible in v1
 * without shipping audio assets (spec §15: TTS/audio mocked in v1). Position of
 * the sound is driven by `t` crossings in usePlayer, not by a free-running loop.
 */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

const TONES: Record<string, number> = {
  pop: 660,
  whoosh: 320,
  ding: 880,
  sparkle: 1180,
}

import { sfxUrl } from '@bingoo.ai/explainer'

/** cache of preloaded <audio> per sound so repeated fires don't re-download */
const clips = new Map<string, HTMLAudioElement>()

/**
 * Play a named sound effect. A real clip from the SFX library (SFX_CATALOG,
 * hosted on R2) if the name is one of them; otherwise the synth blip — which is
 * now only a fallback for an unknown name, not the default for every lesson.
 */
export function blip(sound: string) {
  const url = sfxUrl(sound)
  if (url && typeof Audio !== 'undefined') {
    let a = clips.get(sound)
    if (!a) {
      a = new Audio(url)
      a.preload = 'auto'
      clips.set(sound, a)
    }
    a.currentTime = 0
    void a.play().catch(() => synthBlip(sound))
    return
  }
  synthBlip(sound)
}

function synthBlip(sound: string) {
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = TONES[sound] ?? 520
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
  osc.connect(gain).connect(ac.destination)
  osc.start(now)
  osc.stop(now + 0.24)
}
