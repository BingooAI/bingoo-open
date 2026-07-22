// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Arena audio. Game events map to sound-effect ids; clips overlap by cloning the node. The
 * background music is synthesised with WebAudio and can be switched off. Client-only, and a
 * no-op where `Audio`/`AudioContext` are missing or a clip fails to load — sound never blocks
 * play.
 *
 * No audio ships with this repository (see `packages/explainer/src/sfx-catalog.ts` for why), so
 * effects are silent until a deployment points `NEXT_PUBLIC_SFX_BASE_URL` at a pack it has the
 * right to distribute. The synthesised music still plays: it is generated, not sampled.
 */

export type Sfx = 'correct' | 'wrong' | 'hit' | 'win' | 'lose' | 'special' | 'combo' | 'round' | 'tap'

/**
 * Where this deployment serves `<id>.mp3` from. Unset — the default — means no effects, which
 * is why every player below tolerates a null clip rather than assuming one exists.
 */
export const SFX_BASE: string | undefined = process.env.NEXT_PUBLIC_SFX_BASE_URL || undefined

/** Game event → sound-effect id. */
const EVENT_SFX: Record<Sfx, string> = {
  correct: 'correct',
  wrong: 'incorrect',
  hit: 'coin',
  win: 'level_up',
  lose: 'error_soft',
  special: 'achievement',
  combo: 'streak',
  round: 'whoosh_move',
  tap: 'click_soft',
}

const cache = new Map<string, HTMLAudioElement>()

function base(id: string): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined' || !SFX_BASE) return null
  let a = cache.get(id)
  if (!a) {
    a = new Audio(`${SFX_BASE.replace(/\/$/, '')}/${id}.mp3`)
    a.preload = 'auto'
    cache.set(id, a)
  }
  return a
}

export function playSfx(kind: Sfx): void {
  const a = base(EVENT_SFX[kind])
  if (!a) return
  try {
    // clone để phát chồng lấn (nhiều đòn liên tiếp không cắt tiếng nhau)
    const node = a.cloneNode() as HTMLAudioElement
    node.volume = 0.6
    void node.play().catch(() => undefined)
  } catch {
    /* im lặng */
  }
}

/** Nạp trước vài SFX hay dùng để phát tức thì (gọi khi vào trận). */
export function primeSfx(): void {
  ;(['correct', 'wrong', 'hit', 'combo', 'round'] as Sfx[]).forEach((k) => base(EVENT_SFX[k])?.load())
}

/* ── BGM: vòng arpeggio nhẹ (WebAudio), tắt được ── */
let bgmTimer: ReturnType<typeof setInterval> | null = null
let ctx: AudioContext | null = null
let step = 0
const SEQ = [262, 330, 392, 494, 392, 330]

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function bgmTone(c: AudioContext, f: number, dur: number, peak: number): void {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(f, c.currentTime)
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.exponentialRampToValueAtTime(peak, c.currentTime + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
  o.connect(g).connect(c.destination)
  o.start()
  o.stop(c.currentTime + dur + 0.02)
}

export function startBgm(): void {
  const c = ac()
  if (!c || bgmTimer) return
  step = 0
  const beat = () => {
    const f = SEQ[step % SEQ.length]!
    bgmTone(c, f, 0.22, 0.04)
    bgmTone(c, f / 2, 0.3, 0.028)
    step++
  }
  beat()
  bgmTimer = setInterval(beat, 420)
}

export function stopBgm(): void {
  if (bgmTimer) {
    clearInterval(bgmTimer)
    bgmTimer = null
  }
}
