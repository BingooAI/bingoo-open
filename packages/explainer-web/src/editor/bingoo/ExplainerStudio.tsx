/**
 * ExplainerStudio.tsx — a Bingoo-style editor: big preview on top, a media panel,
 * visual properties, and a track timeline of draggable clips at the bottom.
 * Fully visual — no cue strings / verbs / fractions exposed. Reuses the engine
 * (frame/runtime), the op store (undo/redo/autosave), and the clip model.
 */
'use client'
import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ExplainerDoc, LocaleBundle, Aspect } from '@bingoo/explainer'
import { frame, collectLocalizable } from '@bingoo/explainer'
import { resolveNarrations } from '@bingoo/explainer'
import { lintDoc } from '@bingoo/explainer'
import { useSfx } from '../../player/useSfx'
import { PreviewStage } from './PreviewStage'
import { createEditorStore, loadSaved } from '../store/editorStore'
import type { EditOp } from '../store/ops'
import { importLesson, HANDOFF_KEY } from '../store/importLesson'
import { EditorProvider, useSnap, useStore, genId } from '../store/ctx'
import { buildProject } from './clips'
import { MediaPanel } from './MediaPanel'
import { Button, Select } from '@bingoo/ui-web'
import { Properties, BackgroundDialog } from './Properties'
import { SceneStrip } from './SceneStrip'
import { TrackTimeline } from './TrackTimeline'
import { NarrationPanel } from './NarrationPanel'
import { Preview } from '../panels/Preview'
import { EXPLAINER_API, apiPost } from './endpoints'

/** Locales bingoo ships (@bingoo/i18n) — pick a translate target that the
 *  product actually supports instead of typing a raw code. */
const BINGOO_LOCALES = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
] as const

export function ExplainerStudio({
  doc,
  bundles,
  onChange,
  useLocalDraft = true,
  saveState,
  onSave,
}: {
  doc: ExplainerDoc
  bundles: Record<string, LocaleBundle>
  /** Called on every edit. The host persists — the editor does not know or care
   *  where. Debounce on the host side. */
  onChange?: (doc: ExplainerDoc, bundles: Record<string, LocaleBundle>) => void
  /**
   * Prefer a localStorage draft over the `doc` prop.
   *
   * MUST be false when the doc came from the server: `loadSaved(doc.meta.id)`
   * silently OVERRODE the prop, so opening a saved lesson would show a stale
   * browser copy — with the pictures and narration you had just paid for missing —
   * and the first edit would then save that stale copy back over the good one.
   */
  useLocalDraft?: boolean
  /** save status from the host, shown as a pill in the topbar so the author can
   *  SEE that autosave is happening (they asked because it was invisible). */
  saveState?: { label: string; tone: 'ok' | 'saving' | 'error' }
  /** explicit save — the topbar "Lưu" button. Autosave still runs; this is for
   *  authors who want to press it. */
  onSave?: () => void
}) {
  const store = useMemo(
    () => createEditorStore((useLocalDraft ? loadSaved(doc.meta.id) : null) ?? { doc, bundles }),
    [doc, bundles, useLocalDraft],
  )

  // Report every edit to the host (which owns persistence).
  useEffect(() => {
    if (!onChange) return
    const unsub = store.subscribe(() => {
      const snap = store.getSnapshot()
      onChange(snap.doc, snap.bundles)
    })
    return () => {
      unsub()
    }
  }, [store, onChange])
  // The editor is driven by client-only state (localStorage autosave), so its
  // first client render legitimately differs from SSR. Render only after mount
  // to avoid a hydration mismatch on the engine's dynamic SVG. (No SSR value for
  // an editor.) Server + pre-mount client both render the same empty shell.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="cc-root" />
  return (
    <EditorProvider store={store}>
      <Shell saveState={saveState} onSave={onSave} />
    </EditorProvider>
  )
}

export type CapCtx = {
  gt: number
  setGt: (t: number, seek?: boolean) => void
  playing: boolean
  togglePlay: () => void
  aspect: Aspect
  project: ReturnType<typeof buildProject>
  openNarr: (sceneId: string, ref: string) => void
  addNarr: (sceneId: string, atLocal: number) => void
}

function Shell({
  saveState,
  onSave,
}: {
  saveState?: { label: string; tone: 'ok' | 'saving' | 'error' }
  onSave?: () => void
}) {
  const store = useStore()
  const snap = useSnap()
  const { doc, bundles, ui } = snap
  const bundle = bundles[ui.activeLocale] ?? bundles[doc.meta.defaultLocale]
  if (!bundle) throw new Error(`locale bundle not found: ${ui.activeLocale}`)
  const aspect: Aspect = ui.aspect === '9:16' ? '9:16' : '16:9'
  // SCENE-CENTRIC: edit one scene at a time (like slides). The timeline/preview
  // show only the ACTIVE scene, in scene-local time; the SceneStrip switches.
  const activeScene = doc.scenes.find((s) => s.id === ui.activeSceneId) ?? doc.scenes[0]
  const project = useMemo(
    () => buildProject({ ...doc, scenes: activeScene ? [activeScene] : [] }, bundle, aspect),
    [doc, bundle, aspect, activeScene?.id],
  )

  const [gt, setGtState] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [narrTarget, setNarrTarget] = useState<{ sceneId: string; narrId: string } | null>(null)
  const [translating, setTranslating] = useState<string | null>(null)
  const [batchTts, setBatchTts] = useState<{ done: number; total: number } | null>(null)
  // A failing voice line used to be swallowed by `catch {}` — the counter just
  // ticked on and you were told nothing.
  const [ttsError, setTtsError] = useState<string | null>(null)
  const raf = useRef(0)
  const last = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const segAtRef = useRef(0) // active voice line's start (scene-local)
  const segAudioRef = useRef(false) // is a voice line audible right now

  const setGt = (t: number) => setGtState(Math.max(0, Math.min(t, project.duration)))

  useEffect(() => {
    if (!playing) return
    last.current = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = (now - last.current) / 1000
      last.current = now
      setGtState((g) => {
        const a = audioRef.current
        // audio (voice) is the master clock while it plays → visuals/word-lane
        // stay locked to speech; fall back to wall-clock between voice lines.
        const n =
          segAudioRef.current && a && !a.paused && a.readyState >= 2
            ? Math.max(g, segAtRef.current + a.currentTime)
            : g + dt
        if (n >= project.duration) {
          setPlaying(false)
          return project.duration
        }
        return n
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, project.duration])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')) return
      // Space on a focused button would both click it AND run this → double toggle.
      // Blur the button first so the shortcut is the single source of truth.
      if (e.code === 'Space' && el?.tagName === 'BUTTON') el.blur()
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
      } else if (e.key === 'Escape' && ui.connecting) {
        store.setUI({ connecting: false, connectFrom: null })
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selection) {
        e.preventDefault()
        store.dispatch({ t: 'el.remove', sceneId: ui.activeSceneId, elId: ui.selection })
        store.setUI({ selection: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store, ui.selection, ui.activeSceneId, ui.connecting])

  // i18n: add a language. First copy the source text in place (so it works
  // offline), then ask the translation provider to translate strings + narration
  // scripts — keeping every [[cue:cN]] marker and the timing marks untouched.
  // Translate an EXISTING locale from the default (source) locale. Split out of
  // addLocale so it can be re-run: the first attempt used to fail silently and
  // leave the locale sitting on copied source text with NO way to retry (the
  // "+ ngôn ngữ" list hides already-added locales). Now a "Dịch lại" button calls
  // this. Always translates from the pristine default locale, not a stale copy.
  const translateLocale = async (l: string) => {
    const src = bundles[doc.meta.defaultLocale]
    if (!src || l === doc.meta.defaultLocale) return
    setTranslating(l)
    try {
      const scripts = Object.fromEntries(Object.entries(src.narration).map(([nid, n]) => [nid, n.script]))
      // Not just `src.strings` (the text elements) — ALSO every authored string
      // that lives in the DOC: list items, table cells, chart labels, stats,
      // quotes and the lesson title. collectLocalizable keys them the way the
      // renderer reads per-locale overrides, so writing the translations back via
      // str.set makes the WHOLE lesson translate, not half of it.
      const strings = { ...src.strings, ...collectLocalizable(doc) }
      // NATIVE re-authoring (not word-for-word translate) — the model gets the
      // whole lesson + title as context and writes it as a native teacher would,
      // keeping cues + taught content. Word-for-word "loses the essence".
      const data = await apiPost<{
        strings?: Record<string, string>
        scripts?: Record<string, string>
      }>(
        EXPLAINER_API.localize,
        { from: doc.meta.defaultLocale, to: l, title: doc.meta.title, strings, scripts },
        { timeoutMs: 120_000 },
      )
      const t: EditOp[] = []
      for (const [elId, text] of Object.entries(data.strings ?? {}))
        t.push({ t: 'str.set', locale: l, elId, text })
      for (const [nid, script] of Object.entries(data.scripts ?? {}))
        t.push({ t: 'narr.setScript', locale: l, narrId: nid, script })
      if (t.length) store.batch(t)
      else throw new Error('máy sinh bản ngữ trả về rỗng')
    } catch (e) {
      console.error('localize failed', e)
      window.alert(
        `Sinh bản ${l.toUpperCase()} thất bại: ${(e as Error).message}\n\n` +
          `Đã giữ nguyên bản gốc để anh vẫn có nội dung. Kiểm tra provider dịch (OpenAI) hoặc thử lại.`,
      )
    } finally {
      setTranslating(null)
    }
  }

  const addLocale = async (l: string) => {
    if (!l || doc.locales.includes(l)) return
    const src = bundles[doc.meta.defaultLocale] ?? bundles[ui.activeLocale]
    if (!src) throw new Error(`locale bundle not found: ${doc.meta.defaultLocale}`)
    const ops: EditOp[] = [{ t: 'locale.add', locale: l }]
    for (const [elId, text] of Object.entries(src.strings)) ops.push({ t: 'str.set', locale: l, elId, text })
    for (const [nid, n] of Object.entries(src.narration)) {
      ops.push({ t: 'narr.setScript', locale: l, narrId: nid, script: n.script })
      ops.push({ t: 'narr.setMarks', locale: l, narrId: nid, marks: n.marks })
    }
    store.batch(ops)
    store.setUI({ activeLocale: l })
    await translateLocale(l)
    store.setUI({ activeLocale: l })
    await genAllVoices()
  }

  // Re-translate + re-voice the ACTIVE locale (for when the first pass failed).
  const retranslateActive = async () => {
    await translateLocale(ui.activeLocale)
    await genAllVoices()
  }

  // Import a lesson (from the AI /generate page, a downloaded JSON, or a paste).
  // Validates against the engine schema first (loud failure > silent corruption),
  // loads it into the store, and reports any lint errors so the author can fix.
  const fileRef = useRef<HTMLInputElement | null>(null)
  const loadImport = (raw: unknown, source: string) => {
    const res = importLesson(raw)
    if (!res.ok) {
      window.alert(`Nhập thất bại — ${res.error}`)
      return false
    }
    store.load(res.state)
    if (res.lintErrors.length)
      window.alert(
        `Đã nhập "${res.state.doc.meta.title}" (${source}).\n\n⚠ Còn ${res.lintErrors.length} lỗi cần sửa:\n` +
          res.lintErrors.slice(0, 8).join('\n'),
      )
    return true
  }
  const importFile = async (file: File) => {
    try {
      loadImport(JSON.parse(await file.text()), file.name)
    } catch {
      window.alert('Tệp không phải JSON hợp lệ.')
    }
  }

  // Handoff from /generate: "✎ Sửa trong Studio" stashes the lesson here; pick it
  // up once on mount and clear it so a refresh doesn't re-import.
  const handoffDone = useRef(false)
  useEffect(() => {
    if (handoffDone.current) return
    handoffDone.current = true
    try {
      const raw = localStorage.getItem(HANDOFF_KEY)
      if (raw) {
        localStorage.removeItem(HANDOFF_KEY)
        loadImport(JSON.parse(raw), 'AI sinh')
      }
    } catch {
      /* ignore malformed handoff */
    }
    // mount-only: the handoff is consumed once, on first render.
  }, [])

  // batch: generate voice for EVERY narration line in the lesson (active locale)
  const genAllVoices = async () => {
    if (batchTts) return
    setTtsError(null)
    const b = bundles[ui.activeLocale] ?? bundles[doc.meta.defaultLocale]
    if (!b) throw new Error(`locale bundle not found: ${ui.activeLocale}`)
    const refs = [
      ...new Set(
        doc.scenes.flatMap((s) =>
          resolveNarrations(s, b)
            .filter((seg) => seg.narration.script.trim())
            .map((seg) => seg.ref),
        ),
      ),
    ]
    if (!refs.length) return
    setBatchTts({ done: 0, total: refs.length })
    for (let i = 0; i < refs.length; i++) {
      const nid = refs[i]!
      const n = b.narration[nid]!
      try {
        const data = await apiPost<{
          audioUrl?: string | null
          words?: { word: string; start: number; end: number }[]
          cueMarks?: { cue: string; t: number }[]
        }>(EXPLAINER_API.tts, { text: n.script, locale: ui.activeLocale })
        if (!data.audioUrl) throw new Error('TTS không trả audio')
        store.dispatch({
          t: 'narr.setAudio',
          locale: ui.activeLocale,
          narrId: nid,
          audioUrl: data.audioUrl,
          words: data.words ?? [],
        })
        if ((data.cueMarks ?? []).length)
          store.dispatch({
            t: 'narr.setMarks',
            locale: ui.activeLocale,
            narrId: nid,
            marks: data.cueMarks!,
          })
      } catch (e) {
        setTtsError(`${nid}: ${(e as Error).message}`)
      }
      setBatchTts({ done: i + 1, total: refs.length })
    }
    setBatchTts(null)
  }

  const addNarr = (sceneId: string, atLocal: number) => {
    const ref = genId('narr')
    const sc = doc.scenes.find((s) => s.id === sceneId)
    const cur = sc?.narrations ?? []
    // seed an (empty) narration entry too, so the new line PERSISTS and shows up
    // immediately even before you type — it won't silently vanish on close.
    store.batch([
      {
        t: 'scene.setNarrations',
        sceneId,
        narrations: [...cur, { ref, at: +Math.max(0, atLocal).toFixed(2) }],
      },
      { t: 'narr.setScript', locale: ui.activeLocale, narrId: ref, script: '' },
    ])
    setNarrTarget({ sceneId, narrId: ref })
  }
  const cap: CapCtx = {
    gt,
    setGt,
    playing,
    togglePlay: () => setPlaying((p) => !p),
    aspect,
    project,
    openNarr: (sceneId, ref) => setNarrTarget({ sceneId, narrId: ref }),
    addNarr,
  }
  const model = frame(project.program, Math.min(gt, project.duration))

  // Live validation: the same lintDoc the AI pipeline gates on, run on the doc
  // being edited so authors see broken cues / unknown kinds / overlaps WHILE
  // editing (the live editor previously showed none). Recomputed per snapshot.
  const lint = useMemo(() => lintDoc(doc, Object.values(bundles)), [doc, bundles])
  const lintErr = lint.filter((i) => i.level === 'error')
  const lintWarn = lint.filter((i) => i.level === 'warn')
  const showLint = () =>
    window.alert(
      lint.length === 0
        ? '✓ Không có lỗi lint.'
        : `${lintErr.length} lỗi · ${lintWarn.length} cảnh báo\n\n` +
            lint
              .slice(0, 14)
              .map((i) => `${i.level === 'error' ? '✗' : '⚠'} ${i.code}: ${i.message}`)
              .join('\n') +
            (lint.length > 14 ? `\n… và ${lint.length - 14} mục nữa` : ''),
    )

  // play the current scene's voice-over on the editor timeline, driven by the
  // playhead. A scene can have several voice lines; play whichever one covers
  // the playhead so every segment is audible while you edit.
  const curScene = doc.scenes.find((s) => s.id === model.sceneId)
  const segs = curScene ? resolveNarrations(curScene, bundle) : []
  const activeSeg = [...segs].reverse().find((s) => model.tScene >= s.at - 0.01)
  const segAudio = activeSeg?.narration.audioUrl
  const segLocalT = activeSeg ? model.tScene - activeSeg.at : 0
  segAtRef.current = activeSeg?.at ?? 0
  segAudioRef.current = !!segAudio
  // sound effects audible while editing too
  const sfxItems = (curScene?.elements ?? [])
    .filter((e) => e.type === 'audio')
    .map((e) => {
      const c = e.content as { src?: string; at?: number }
      return { id: e.id, at: c?.at ?? 0, src: c?.src }
    })
  useSfx(sfxItems, model.tScene, playing, false)
  useEffect(() => {
    const a = audioRef.current
    if (a) a.src = segAudio ?? ''
  }, [segAudio])
  useEffect(() => {
    const a = audioRef.current
    if (!a || !segAudio) return
    if (Math.abs(a.currentTime - segLocalT) > 0.25) a.currentTime = Math.max(0, segLocalT)
    if (playing && a.paused) a.play().catch(() => {})
    if (!playing && !a.paused) a.pause()
  }, [gt, playing, segLocalT, segAudio])

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
    if (playing && a.paused) a.play().catch(() => {})
    if (!playing && !a.paused) a.pause()
  }, [playing, doc.music?.src])

  return (
    <div className="cc-root">
      <audio ref={audioRef} preload="auto" />
      <audio ref={musicRef} loop preload="auto" />
      <div className="cc-top">
        <a className="cc-home" href="/">
          ←
        </a>
        <img className="cc-brandmark" src="/brand/logo/logo.svg" alt="Bingoo" height={24} />
        <input
          className="cc-title"
          value={doc.meta.title}
          onChange={(e) => store.dispatch({ t: 'meta.setTitle', title: e.target.value }, 'title')}
          onBlur={() => store.endCoalesce()}
        />
        {onSave && (
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            disabled={saveState?.tone === 'saving'}
            title="Lưu ngay lên server (autosave vẫn chạy)"
          >
            💾 Lưu
          </Button>
        )}
        {saveState && (
          <span
            className="cc-save-pill"
            style={{
              color:
                saveState.tone === 'error'
                  ? '#f28b82'
                  : saveState.tone === 'saving'
                    ? 'var(--cc-sub)'
                    : '#4ec97a',
            }}
          >
            {saveState.tone === 'ok' ? '✓ ' : saveState.tone === 'saving' ? '⟳ ' : '⚠ '}
            {saveState.label}
          </span>
        )}
        <span className="cc-flex" />
        <Button
          variant="secondary"
          size="icon-sm"
          disabled={!snap.canUndo}
          onClick={() => store.undo()}
          title="Hoàn tác"
        >
          ↶
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          disabled={!snap.canRedo}
          onClick={() => store.redo()}
          title="Làm lại"
        >
          ↷
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => store.setUI({ showBackground: true })}
          title="Nền bài học (ảnh từ thư viện hoặc nền dựng sẵn)"
        >
          🎨 Nền
        </Button>
        <div className="cc-seg">
          {(['16:9', '9:16'] as const).map((a) => (
            <button
              key={a}
              className={ui.aspect === a ? 'on' : ''}
              onClick={() => store.setUI({ aspect: a })}
            >
              {a}
            </button>
          ))}
        </div>
        <Select
          selectSize="md"
          value={ui.activeLocale}
          onChange={(e) => store.setUI({ activeLocale: e.target.value })}
          title="Ngôn ngữ đang soạn"
        >
          {doc.locales.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </Select>
        {!translating && ui.activeLocale !== doc.meta.defaultLocale && (
          <Button
            variant="ghost"
            size="sm"
            onClick={retranslateActive}
            title={`Sinh lại bản ${ui.activeLocale.toUpperCase()} (native) từ ${doc.meta.defaultLocale.toUpperCase()} + tạo lại giọng`}
          >
            🌐 Sinh lại bản ngữ
          </Button>
        )}
        {translating ? (
          <span className="cc-btn ghost" style={{ opacity: 0.7 }}>
            Đang sinh bản {translating.toUpperCase()}…
          </span>
        ) : (
          <Select
            selectSize="md"
            value=""
            title="Thêm ngôn ngữ — dịch toàn bộ + tạo giọng"
            onChange={(e) => {
              if (e.target.value) void addLocale(e.target.value)
            }}
          >
            <option value="">＋ ngôn ngữ…</option>
            {BINGOO_LOCALES.filter((l) => !doc.locales.includes(l.code)).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={!!batchTts}
          onClick={genAllVoices}
          title={ttsError ?? 'Tạo giọng cho toàn bộ lời giảng (ngôn ngữ đang chọn)'}
        >
          {batchTts
            ? `Giọng ${batchTts.done}/${batchTts.total}…`
            : ttsError
              ? '🎙 Lỗi — xem tooltip'
              : '🎙 Cả bài'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importFile(f)
            e.target.value = ''
          }}
        />
        <Button
          variant={lintErr.length ? 'danger' : 'ghost'}
          size="sm"
          onClick={showLint}
          title="Kiểm tra bài học (schema, cue, overlap, kind/verb)"
        >
          {lintErr.length ? `✗ ${lintErr.length}` : lintWarn.length ? `⚠ ${lintWarn.length}` : '✓'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileRef.current?.click()}
          title="Nhập bài học JSON (từ AI sinh hoặc tệp đã tải)"
        >
          Nhập
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const j = store.exportJSON()
            const b = new Blob([j], { type: 'application/json' })
            const u = URL.createObjectURL(b)
            const x = document.createElement('a')
            x.href = u
            x.download = `${doc.meta.id}.json`
            x.click()
            URL.revokeObjectURL(u)
          }}
        >
          Xuất
        </Button>
        <Button variant="primary" size="sm" onClick={() => setShowPreview(true)}>
          ▶ Học thử
        </Button>
      </div>

      <div className="cc-main">
        <MediaPanel cap={cap} />
        <div className="cc-stagecol">
          <div className="cc-stagewrap">
            <PreviewStage model={model} theme={doc.theme} aspect={aspect} />
          </div>
          <div className="cc-transport">
            <Button variant="primary" size="icon" onClick={() => setPlaying((p) => !p)}>
              {playing ? '❚❚' : '▶'}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setGt(0)} title="Về đầu">
              ↺
            </Button>
            <span className="cc-time">
              {fmt(gt)} / {fmt(project.duration)}
            </span>
            <Button
              variant="soft"
              size="sm"
              onClick={() => activeScene && addNarr(activeScene.id, gt)}
              title="Thêm một câu lời giảng tại vị trí kim thời gian"
            >
              🎙 ＋ Lời giảng
            </Button>
          </div>
        </div>
        <Properties cap={cap} />
      </div>

      <SceneStrip cap={cap} />
      <TrackTimeline cap={cap} />

      <BackgroundDialog />
      {showPreview && <Preview onClose={() => setShowPreview(false)} />}
      {narrTarget && (
        <NarrationPanel
          sceneId={narrTarget.sceneId}
          narrId={narrTarget.narrId}
          onClose={() => setNarrTarget(null)}
        />
      )}
    </div>
  )
}

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const cs = Math.floor((s * 100) % 100)
  return `${m}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
