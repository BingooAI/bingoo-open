/**
 * usePlayer.ts — React binding around the engine runtime (spec §3, §11).
 *
 * Holds the single source of playback truth: global `t`, play/pause, and the
 * gate state machine (PLAYING → PAUSED_AT_GATE → resume). Rendering downstream
 * is a pure function of `t` — this hook never draws anything.
 */
'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { ExplainerDoc, LocaleBundle, Aspect } from '@bingoo.ai/explainer'
import {
  buildProgram,
  createPlayController,
  sceneAt,
  type SceneSlot,
  type PlayController,
} from '@bingoo.ai/explainer'
import { blip } from './sfx'

export type GateState = 'playing' | 'at-gate' | 'ended'

export type PlayerApi = {
  program: ReturnType<typeof buildProgram>
  t: number
  playing: boolean
  state: GateState
  gateSlot: SceneSlot | null
  maxSeek: number // can't scrub past the next unpassed gate
  play(): void
  pause(): void
  toggle(): void
  seek(t: number): void
  jumpToGate(t: number): void // click a checkpoint → go exactly there & open it
  restart(): void
  passGate(): void // gate solved → resume
  muted: boolean
  setMuted(m: boolean): void
  speed: number // playback rate (0.5 / 0.75 / 1)
  setSpeed(s: number): void
}

export function usePlayer(
  doc: ExplainerDoc,
  bundle: LocaleBundle,
  aspect: Aspect,
  clockRef?: MutableRefObject<(() => number | null) | null>,
): PlayerApi {
  const program = useMemo(() => buildProgram(doc, bundle, aspect), [doc, bundle, aspect])

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [state, setState] = useState<GateState>('playing')
  const [gateStart, setGateStart] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)

  const passedRef = useRef<Set<number>>(new Set())
  const ctrlRef = useRef<PlayController | null>(null)
  const lastTRef = useRef(0)
  const mutedRef = useRef(false)
  mutedRef.current = muted
  const speedRef = useRef(1)
  speedRef.current = speed

  // global SFX schedule (scene-local → global time)
  const sfx = useMemo(() => {
    const list: { t: number; sound: string }[] = []
    for (const slot of program.slots)
      for (const ev of slot.timeline.sfxEvents) list.push({ t: slot.start + ev.t, sound: ev.sound })
    return list.sort((a, b) => a.t - b.t)
  }, [program])

  const nextLock = useCallback(() => {
    let best = Infinity
    for (const g of program.gateStarts) if (!passedRef.current.has(g) && g < best) best = g
    return best
  }, [program])

  const maxSeek = Math.min(program.duration, nextLock() === Infinity ? program.duration : nextLock())

  // (re)build the controller when the program changes
  useEffect(() => {
    passedRef.current = new Set()
    const ctrl = createPlayController({
      duration: program.duration,
      gateStarts: program.gateStarts,
      now: () => performance.now(),
      raf: (cb) => requestAnimationFrame(cb),
      cancel: (id) => cancelAnimationFrame(id),
      rate: () => speedRef.current,
      clock: () => clockRef?.current?.() ?? null,
      onSeek: (nt) => {
        // fire SFX crossed during forward playback
        if (!mutedRef.current) {
          const prev = lastTRef.current
          if (nt > prev) for (const e of sfx) if (e.t > prev && e.t <= nt) blip(e.sound)
        }
        lastTRef.current = nt
        setT(nt)
      },
      onReachGate: (gt) => {
        // REACHING a gate only PAUSES at it — it is NOT "passed" yet. Marking it
        // passed here (as it used to) unlocked scrubbing past a question the
        // learner never answered, defeating the whole gate. A gate becomes passed
        // only in `passGate` (answered or skipped). The controller keeps its OWN
        // passed-set so resuming doesn't re-stop here; this set is only the
        // scrub-lock's, and the scrub lock must hold until the answer.
        setGateStart(gt)
        setState('at-gate')
        setPlaying(false)
      },
      onEnd: () => {
        setState('ended')
        setPlaying(false)
      },
    })
    ctrlRef.current = ctrl
    setT(0)
    lastTRef.current = 0
    setState('playing')
    setPlaying(false)
    setGateStart(null)
    return () => ctrl.dispose()
  }, [program, sfx])

  const play = useCallback(() => {
    if (state === 'ended') return
    setPlaying(true)
    setState('playing')
    ctrlRef.current?.play()
  }, [state])

  const pause = useCallback(() => {
    setPlaying(false)
    ctrlRef.current?.pause()
  }, [])

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, play, pause])

  const seek = useCallback(
    (nt: number) => {
      const clamped = Math.max(0, Math.min(nt, maxSeek))
      lastTRef.current = clamped // don't retrigger SFX on scrub
      ctrlRef.current?.seek(clamped)
      // scrubbing/clicking onto a pending gate opens it AND stops playback
      // (the controller keeps its own `playing` flag, so pause it explicitly).
      const lock = nextLock()
      if (lock !== Infinity && clamped >= lock - 1e-3) {
        // scrubbing ONTO a pending gate opens it — but opening is not passing, so
        // don't add it to the lock set here either (it stays clamped until the
        // learner answers). passGate() records the pass.
        ctrlRef.current?.pause()
        setGateStart(lock)
        setState('at-gate')
        setPlaying(false)
      } else if (state !== 'ended') {
        setState('playing')
      }
    },
    [maxSeek, nextLock, state],
  )

  // Click a checkpoint tick → jump straight to that gate (free navigation, not
  // clamped to the next lock), mark earlier gates passed, pause, and open it.
  const jumpToGate = useCallback(
    (gt: number) => {
      for (const g of program.gateStarts) if (g < gt - 1e-3) passedRef.current.add(g)
      ctrlRef.current?.pause()
      lastTRef.current = gt
      ctrlRef.current?.seek(gt)
      setGateStart(gt)
      setState('at-gate')
      setPlaying(false)
    },
    [program],
  )

  const restart = useCallback(() => {
    passedRef.current = new Set()
    lastTRef.current = 0
    ctrlRef.current?.seek(0)
    setGateStart(null)
    setState('playing')
    setPlaying(false)
  }, [])

  const passGate = useCallback(() => {
    // ANSWERED (or skipped) → NOW the gate is passed: record it so the scrub lock
    // advances to the next gate and the learner can move on.
    if (gateStart != null) passedRef.current.add(gateStart)
    setGateStart(null)
    setState('playing')
    // resume from just after the gate hold so we don't re-trigger it
    play()
  }, [play, gateStart])

  const gateSlot = gateStart !== null ? sceneAt(program, gateStart) : null

  return {
    program,
    t,
    playing,
    state,
    gateSlot,
    maxSeek,
    play,
    pause,
    toggle,
    seek,
    jumpToGate,
    restart,
    passGate,
    muted,
    setMuted,
    speed,
    setSpeed,
  }
}
