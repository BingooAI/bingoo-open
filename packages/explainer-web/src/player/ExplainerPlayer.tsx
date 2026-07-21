// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Player.tsx — the learner player surface (player-spec §0-§4). A thin app over
 * the engine runtime: it renders the pure RenderModel via the SVG Stage, drives
 * play/scrub, freezes at gates, switches aspect & locale, and shows captions.
 * No drawing/animation logic lives here (player-spec §11 invariant).
 */
'use client'
import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ExplainerDoc, LocaleBundle, Aspect, Rect } from '@bingoo.ai/explainer'
import { buildProgram, resolveNarrations } from '@bingoo.ai/explainer'
import { frame } from '@bingoo.ai/explainer'
import { Button } from '@bingoo.ai/ui-web'
import { Stage } from '../elements/Stage'
import { usePlayer } from './usePlayer'
import { useSpeech, speechLang } from './useSpeech'
import { GateHost } from './GateHost'
import { InteractiveManipulative } from './InteractiveManipulative'
import { useSfx } from './useSfx'
import type { QuizLabels } from '@bingoo.ai/ui-web'

export type AspectMode = '16:9' | '9:16' | 'dual'

export function ExplainerPlayer({
  doc,
  bundles,
  mode: modeProp,
  onModeChange,
  variant = 'full',
  active,
  quizLabels,
}: {
  doc: ExplainerDoc
  bundles: Record<string, LocaleBundle>
  /** Optional controlled aspect mode — lets a host (e.g. the studio "Học thử"
   *  bar) drive it with a visible toggle instead of the in-player ⚙ popover. */
  mode?: AspectMode
  onModeChange?: (m: AspectMode) => void
  /** 'feed' = bản tối giản cho dòng khám phá: bỏ hết chrome, chỉ 1 thanh tua, chạm để phát/dừng. */
  variant?: 'full' | 'feed'
  /** Khi variant='feed': tự PHÁT lúc active, tự DỪNG khi rời khung (cuộn qua bài khác). */
  active?: boolean
  /**
   * Copy for quiz beats embedded in a lesson. A host that leaves this out gets English, which
   * is the honest fallback: it reads as untranslated rather than as someone else's language.
   */
  quizLabels?: QuizLabels
}) {
  const [locale, setLocale] = useState(doc.meta.defaultLocale)
  const [modeState, setModeState] = useState<AspectMode>('16:9')
  const mode = modeProp ?? modeState
  const setMode = (m: AspectMode) => {
    setModeState(m)
    onModeChange?.(m)
  }
  const [register] = useState<string>(doc.theme.register)
  const [captionOn, setCaptionOn] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // R5 — bài là nội dung ĐỘNG (LLM sinh/import): locale bundle ghi lệch ("vi-VN" thay vì "vi") KHÔNG
  // được phép làm trắng cả trang. Lùi dần: locale đang chọn → mặc định của doc → bundle bất kỳ còn có.
  // Hết sạch bundle mới nổ (bài rỗng thì thật sự không dựng được gì).
  const bundle = bundles[locale] ?? bundles[doc.meta.defaultLocale] ?? Object.values(bundles)[0]
  if (!bundle)
    throw new Error(`explainer: no locale bundle for "${locale}" or default "${doc.meta.defaultLocale}"`)
  const primary: Aspect = mode === '9:16' ? '9:16' : '16:9'
  // one document, many registers (spec §8): swap look without touching content
  const theme = useMemo(() => ({ ...doc.theme, register }), [doc.theme, register])

  const audioClock = useRef<(() => number | null) | null>(null)
  const api = usePlayer(doc, bundle, primary, audioClock)
  const model = frame(api.program, api.t)

  // Feed: tự PHÁT khi active (bài đang xem), tự DỪNG khi cuộn qua bài khác.
  useEffect(() => {
    if (variant !== 'feed') return
    if (active) api.play()
    else api.pause()
  }, [variant, active])

  // secondary aspect program for the side-by-side preview (spec FR-C-02)
  const otherAspect: Aspect = primary === '16:9' ? '9:16' : '16:9'
  const otherProgram = useMemo(() => buildProgram(doc, bundle, otherAspect), [doc, bundle, otherAspect])
  const otherModel = frame(otherProgram, api.t)

  const pct = api.program.duration > 0 ? (api.t / api.program.duration) * 100 : 0
  const lockPct = api.program.duration > 0 ? (api.maxSeek / api.program.duration) * 100 : 100

  // interactive manipulatives in the current scene → drawn by an overlay the
  // learner can drive (combines visual + interaction, spec §12). We omit them
  // from the static Stage so there's no double-draw.
  const curScene = doc.scenes.find((s) => s.id === model.sceneId)
  const interManips: { id: string; kind: string; params: unknown; rect: Rect }[] = []
  for (const e of curScene?.elements ?? []) {
    if (e.type !== 'manipulative') continue
    const c = e.content as { kind: string; params?: unknown; interactive?: boolean }
    if (!c?.interactive) continue
    const rect = model.items.find((it) => it.id === e.id)?.rect
    if (rect) interManips.push({ id: e.id, kind: c.kind, params: c.params, rect })
  }
  const skipIds = new Set(interManips.map((m) => m.id))

  // TTS voice-over: a scene can hold several voice lines. Play whichever segment
  // covers the current scene-time, position-driven by t, and highlight its words.
  const segs = curScene ? resolveNarrations(curScene, bundle) : []
  const activeSeg = [...segs].reverse().find((s) => model.tScene >= s.at - 0.01)
  const segAudio = activeSeg?.narration.audioUrl
  const segLocalT = activeSeg ? model.tScene - activeSeg.at : 0
  const segWords = activeSeg?.narration.words
  const segCaption = activeSeg ? stripCues(activeSeg.narration.script) : model.caption
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const a = audioRef.current
    if (a) a.src = segAudio ?? ''
  }, [segAudio])
  useEffect(() => {
    const a = audioRef.current
    if (!a || !segAudio) return
    a.muted = api.muted
    if (Math.abs(a.currentTime - segLocalT) > 0.3) a.currentTime = Math.max(0, segLocalT)
    // Only (re)start the audio while the playhead is still WITHIN this line. Once
    // it has played through, do NOT replay it: replaying an ended segment pinned
    // the master clock back inside scene 1's audio, so the lesson looped the first
    // line forever and never advanced to scene 2. Past the audio's end, the rAF
    // clock takes over and t moves on to the next segment/scene.
    const dur = Number.isFinite(a.duration) ? a.duration : Infinity
    const within = segLocalT < dur - 0.1
    if (api.playing && a.paused && within) a.play().catch(() => {})
    if ((!api.playing || !within) && !a.paused) a.pause()
  }, [api.t, api.playing, api.muted, segLocalT, segAudio])

  // when a voice line is actually playing, make its audio the master clock so
  // the caption highlight + visuals track speech EXACTLY (no rAF-vs-audio drift).
  audioClock.current = () => {
    const a = audioRef.current
    if (!api.playing || !segAudio || !a || a.paused || a.readyState < 2) return null
    // Once this line has finished, stop driving the clock from it — otherwise the
    // clock is capped at the audio's end (scene 1) and can never reach scene 2.
    const dur = Number.isFinite(a.duration) ? a.duration : Infinity
    if (a.ended || a.currentTime >= dur - 0.05) return null
    return model.sceneStart + (activeSeg?.at ?? 0) + a.currentTime
  }

  // keyless voice fallback: speak the active line via the browser when it has no
  // pre-generated audio, so every lesson has a voice with no API key.
  useSpeech(segCaption, {
    playing: api.playing,
    muted: api.muted,
    enabled: !segAudio,
    lang: speechLang(bundle.locale),
  })

  // sound effects: fire the scene's audio elements as the playhead crosses them
  const sfxItems = (curScene?.elements ?? [])
    .filter((e) => e.type === 'audio')
    .map((e) => {
      const c = e.content as { src?: string; at?: number }
      return { id: e.id, at: c?.at ?? 0, src: c?.src }
    })
  useSfx(sfxItems, model.tScene, api.playing, api.muted)

  // looping background music
  const musicRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const a = musicRef.current
    if (a) {
      a.src = doc.music?.src ?? ''
      a.volume = doc.music?.volume ?? 0.3
    }
  }, [doc.music?.src, doc.music?.volume])
  useEffect(() => {
    const a = musicRef.current
    if (!a || !doc.music?.src) return
    a.muted = api.muted
    if (api.playing && a.paused) a.play().catch(() => {})
    if ((!api.playing || api.state === 'ended') && !a.paused) a.pause()
  }, [api.playing, api.muted, api.state, doc.music?.src])

  // checkpoint markers on the timeline: label = the gate's prompt, so hovering
  // tells you what it is, and clicking jumps there (which opens the gate).
  const [hoverGate, setHoverGate] = useState<number | null>(null)
  const gateInfos = useMemo(
    () =>
      api.program.slots
        .filter((s) => s.scene.kind === 'gate' && s.scene.gate)
        .map((s) => ({ t: s.start, prompt: s.scene.gate!.prompt, kind: s.scene.gate!.kind })),
    [api.program],
  )

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  // ── Bản FEED tối giản: stage full + 1 thanh tua + chạm để phát/dừng ──
  if (variant === 'feed') {
    return (
      <div
        className="player player-portrait player-feed"
        data-theme="light"
        onClick={api.toggle}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        {/* Sizing biến thể FEED: cột đã là khung 9:16 → stage FILL chiều rộng. Gate/quiz POPUP nổi giữa đè lên player (nền mờ). */}
        <style>{`
.player-feed{height:100%}
.player-feed .stage-row{height:100%;padding:0;margin:0}
.player-feed .stage-wrap.portrait{width:100%;height:100%}
.player-feed .stage-wrap.portrait .stage-inner{width:100%;height:100%;max-height:100%;aspect-ratio:auto;margin:0;border-radius:0;border:0}
.player-feed .gate{position:absolute!important;inset:0!important;z-index:20;display:flex!important;align-items:flex-end!important;justify-content:center!important;padding:0!important;background:rgba(12,16,30,.42)!important;background-image:none!important;backdrop-filter:blur(1.5px)}
.player-feed .gate-quiz,.player-feed .gate-card{width:100%!important;max-width:100%!important;max-height:80%!important;overflow-y:auto!important;border-radius:24px 24px 0 0!important;box-shadow:0 -14px 44px rgba(0,0,0,.28)!important;margin:0!important;left:auto!important;right:auto!important;bottom:0!important;animation:feed-sheet .3s cubic-bezier(.22,.61,.36,1)}
@keyframes feed-sheet{from{transform:translateY(46px);opacity:.5}to{transform:none;opacity:1}}
`}</style>
        <audio ref={musicRef} loop preload="auto" />
        <div className="stage-wrap portrait">
          <div className="stage-inner">
            <Stage model={model} theme={theme} skipIds={skipIds} caption={false} />
            {interManips.map((m) => (
              <div
                key={m.id}
                className="manip-overlay"
                style={{
                  position: 'absolute',
                  left: `${(m.rect.x / model.canvas.w) * 100}%`,
                  top: `${(m.rect.y / model.canvas.h) * 100}%`,
                  width: `${(m.rect.w / model.canvas.w) * 100}%`,
                  height: `${(m.rect.h / model.canvas.h) * 100}%`,
                }}
              >
                <InteractiveManipulative
                  kind={m.kind}
                  theme={theme}
                  aspect={primary}
                  initialParams={m.params}
                  variant="stage"
                  hideHint
                />
              </div>
            ))}
            {api.state === 'at-gate' && api.gateSlot?.scene.gate && (
              <GateHost
                labels={quizLabels}
                key={api.gateSlot.scene.id}
                gate={api.gateSlot.scene.gate}
                theme={theme}
                aspect={primary}
                onPass={api.passGate}
                onSkip={api.passGate}
              />
            )}
            {api.state === 'ended' && <Complete doc={doc} onReplay={api.restart} />}
            {api.state !== 'ended' && captionOn && (
              <WordCaption words={segWords} tScene={segLocalT} fallback={segCaption} />
            )}
            <audio ref={audioRef} preload="auto" />
          </div>
        </div>

        {!api.playing && api.state === 'playing' ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: '4.4rem',
                height: '4.4rem',
                borderRadius: '999px',
                background: 'rgba(0,0,0,.4)',
                color: '#fff',
                fontSize: '1.8rem',
                paddingLeft: '.3rem',
                backdropFilter: 'blur(4px)',
              }}
            >
              ▶
            </span>
          </div>
        ) : null}

        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '14px 14px 12px',
            background: 'linear-gradient(to top, rgba(0,0,0,.5), transparent)',
          }}
        >
          <div
            style={{
              position: 'relative',
              height: 6,
              borderRadius: 999,
              background: 'rgba(255,255,255,.3)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${pct}%`,
                borderRadius: 999,
                background: '#fff',
              }}
            />
            <input
              type="range"
              min={0}
              max={api.program.duration}
              step={0.01}
              value={api.t}
              onChange={(e) => api.seek(parseFloat(e.target.value))}
              aria-label="Tua"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                margin: 0,
                opacity: 0,
                cursor: 'pointer',
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={primary === '9:16' && mode !== 'dual' ? 'player player-portrait' : 'player'}>
      <audio ref={musicRef} loop preload="auto" />

      {/* The lesson stage is ALWAYS the bright kids aesthetic — pin it to the
          light token set so embedded ui-web widgets (QuizShell, AnswerOption in a
          gate) render light to match the lesson, even when the player sits inside
          the dark studio chrome. The transport bar outside stays contextual. */}
      <div className={mode === 'dual' ? 'stage-row dual' : 'stage-row'} data-theme="light">
        <div className={primary === '9:16' ? 'stage-wrap portrait' : 'stage-wrap landscape'}>
          <div className="stage-inner">
            {/* the player draws its own word-highlighted caption below, so the
                 Stage must NOT draw one too — both did, and every narration line
                 appeared twice, on top of itself. */}
            <Stage model={model} theme={theme} skipIds={skipIds} caption={false} />
            {interManips.map((m) => (
              <div
                key={m.id}
                className="manip-overlay"
                style={{
                  position: 'absolute',
                  left: `${(m.rect.x / model.canvas.w) * 100}%`,
                  top: `${(m.rect.y / model.canvas.h) * 100}%`,
                  width: `${(m.rect.w / model.canvas.w) * 100}%`,
                  height: `${(m.rect.h / model.canvas.h) * 100}%`,
                }}
              >
                <InteractiveManipulative
                  kind={m.kind}
                  theme={theme}
                  aspect={primary}
                  initialParams={m.params}
                  variant="stage"
                  hideHint
                />
              </div>
            ))}
            {/* The live gate appears only when the player PAUSES at it — during
                 the lead-in the scene itself (its prompt) is what shows. A dimmed
                 widget preview here read as broken/washed, so it's gone; the gate
                 no longer covers the scene anyway (it docks to the side/bottom). */}
            {api.state === 'at-gate' && api.gateSlot?.scene.gate && (
              <GateHost
                labels={quizLabels}
                key={api.gateSlot.scene.id}
                gate={api.gateSlot.scene.gate}
                theme={theme}
                aspect={primary}
                onPass={api.passGate}
                onSkip={api.passGate}
              />
            )}
            {api.state === 'ended' && <Complete doc={doc} onReplay={api.restart} />}
            {api.state !== 'ended' && captionOn && (
              <WordCaption words={segWords} tScene={segLocalT} fallback={segCaption} />
            )}
            <audio ref={audioRef} preload="auto" />
          </div>
        </div>

        {mode === 'dual' && (
          <div className="stage-wrap portrait">
            <div className="stage-inner">
              <Stage model={otherModel} theme={theme} caption={false} />
              {captionOn && otherModel.caption && <div className="caption small">{otherModel.caption}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <Button
          variant="primary"
          size="icon"
          onClick={api.toggle}
          aria-label={api.playing ? 'Tạm dừng' : 'Phát'}
        >
          {api.playing ? '❚❚' : '▶'}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={api.restart}
          aria-label="Làm lại từ đầu"
          title="Làm lại từ đầu"
        >
          ↺
        </Button>
        <span className="pl-time">
          {fmt(api.t)} <span className="pl-time-sep">/</span> {fmt(api.program.duration)}
        </span>
        <div className="scrub">
          <div className="scrub-track">
            <div className="scrub-lock" style={{ left: `${lockPct}%` }} />
            <div className="scrub-fill" style={{ width: `${pct}%` }} />
            {gateInfos.map((info, i) => {
              const leftPct = (info.t / api.program.duration) * 100
              return (
                <button
                  key={info.t}
                  type="button"
                  className={`scrub-gate ${info.kind === 'manipulate' ? 'manip' : ''} ${hoverGate === i ? 'hover' : ''}`}
                  style={{ left: `${leftPct}%` }}
                  onMouseEnter={() => setHoverGate(i)}
                  onMouseLeave={() => setHoverGate((h) => (h === i ? null : h))}
                  onClick={() => api.jumpToGate(info.t)}
                  aria-label={`Đến điểm tương tác: ${info.prompt}`}
                >
                  {hoverGate === i && (
                    <span
                      className="scrub-tip"
                      style={{ left: leftPct > 80 ? 'auto' : 0, right: leftPct > 80 ? 0 : 'auto' }}
                    >
                      <b>{info.kind === 'manipulate' ? '✍ Thử làm' : 'Câu hỏi'}</b>
                      {info.prompt}
                    </span>
                  )}
                </button>
              )
            })}
            <input
              className="scrub-range"
              type="range"
              min={0}
              max={api.program.duration}
              step={0.01}
              value={api.t}
              onChange={(e) => api.seek(parseFloat(e.target.value))}
              aria-label="Thanh thời gian"
            />
            {/* custom thumb at the EXACT percentage so it aligns with the fill
                and checkpoint dots (the native range thumb is inset by its own
                radius, which made them look misaligned). */}
            <div className="scrub-thumb" style={{ left: `${pct}%` }} />
          </div>
        </div>

        <div className="pl-right">
          <Button
            variant={captionOn ? 'soft' : 'ghost'}
            size="icon-sm"
            onClick={() => setCaptionOn((c) => !c)}
            aria-pressed={captionOn}
            title={captionOn ? 'Tắt phụ đề' : 'Bật phụ đề'}
          >
            CC
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => api.setMuted(!api.muted)}
            aria-label="Âm thanh"
            title="Âm thanh"
          >
            {api.muted ? '🔇' : '🔊'}
          </Button>
          {/* speed · aspect · language tucked into a settings popover — the bar
              keeps only what you touch while watching. */}
          <div className="pl-menu-wrap">
            <Button
              variant={settingsOpen ? 'soft' : 'ghost'}
              size="icon-sm"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="Cài đặt"
              title="Tốc độ · khổ · ngôn ngữ"
            >
              ⚙
            </Button>
            {settingsOpen && (
              <>
                <div className="pl-menu-backdrop" onClick={() => setSettingsOpen(false)} />
                <div className="pl-menu" role="menu">
                  <div className="pl-menu-row">
                    <span>Tốc độ</span>
                    <div className="pl-seg">
                      {([0.5, 0.75, 1] as const).map((s) => (
                        <button
                          key={s}
                          className={api.speed === s ? 'on' : ''}
                          onClick={() => api.setSpeed(s)}
                        >
                          {s}×
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pl-menu-row">
                    <span>Khổ hình</span>
                    <div className="pl-seg">
                      {(['16:9', '9:16', 'dual'] as AspectMode[]).map((m) => (
                        <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                          {m === 'dual' ? '⧉' : m}
                        </button>
                      ))}
                    </div>
                  </div>
                  {doc.locales.length > 1 && (
                    <div className="pl-menu-row">
                      <span>Ngôn ngữ</span>
                      <div className="pl-seg">
                        {doc.locales.map((l) => (
                          <button key={l} className={locale === l ? 'on' : ''} onClick={() => setLocale(l)}>
                            {l.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const stripCues = (s: string) =>
  s
    .replace(/\[\[cue:[^\]]+\]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Caption that highlights the word being spoken (from TTS word timings). */
function WordCaption({
  words,
  tScene,
  fallback,
}: {
  words?: { word: string; start: number; end: number }[]
  tScene: number
  fallback: string | null
}) {
  if (!words || words.length === 0) {
    return fallback ? (
      <div className="caption" aria-live="polite">
        {fallback}
      </div>
    ) : null
  }
  const idx = words.findIndex((w) => tScene >= w.start && tScene < w.end)
  return (
    <div className="caption" aria-live="polite">
      {words.map((w, i) => (
        <span key={i} className={i === idx ? 'cap-word hl' : 'cap-word'}>
          {w.word}{' '}
        </span>
      ))}
    </div>
  )
}

function Complete({ doc, onReplay }: { doc: ExplainerDoc; onReplay: () => void }) {
  return (
    <div className="complete">
      <div className="complete-card">
        <div className="complete-check">✓</div>
        <h2>Hoàn thành</h2>
        <p>Bạn vừa xem xong “{doc.meta.title}”.</p>
        <button className="play-again" onClick={onReplay}>
          ↺ Xem lại
        </button>
      </div>
    </div>
  )
}
