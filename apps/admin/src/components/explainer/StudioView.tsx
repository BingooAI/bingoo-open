'use client'

/**
 * StudioView — the editor, opened ON A LESSON.
 *
 * It used to seed itself from a hardcoded acceptance lesson, so "Mở Studio để
 * sửa" edited a demo, not your work. Now it loads the lesson named in the URL
 * (`?lesson=<id>`), and every edit is saved back to the server.
 *
 * `useLocalDraft={false}` matters: the Studio otherwise prefers a localStorage
 * draft keyed by `doc.meta.id`, which would silently shadow the lesson we just
 * fetched — showing a stale copy without the pictures and narration you paid for,
 * and then saving that stale copy back over the good one on the first keystroke.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ExplainerDoc, LocaleBundle } from '@bingoo/explainer'
import { ExplainerStudio } from '@bingoo/explainer-web'
import '@bingoo/explainer-web/styles.css'
import { getLesson, saveLesson, type LessonFull } from '@/lib/explainerLessons'
import { ACCEPTANCE_DOC, ACCEPTANCE_BUNDLES } from '@/lib/explainerLesson'

type Loaded = {
  doc: ExplainerDoc
  bundles: Record<string, LocaleBundle>
  lesson: LessonFull | null
}

export function StudioView() {
  const lessonId = useSearchParams().get('lesson')
  const [state, setState] = useState<Loaded | null>(null)
  const [saved, setSaved] = useState('')
  const [savingNow, setSavingNow] = useState(false)
  const latest = useRef<{ doc: ExplainerDoc; bundles: Record<string, LocaleBundle> } | null>(null)

  const persist = useCallback((doc: ExplainerDoc, bundles: Record<string, LocaleBundle>) => {
    setSavingNow(true)
    const bundle = Object.values(bundles)[0]
    const els = doc.scenes.flatMap((s) => s.elements)
    const totalImgs = els.filter((e) => e.type === 'image').length
    const doneImgs = els.filter(
      (e) => e.type === 'image' && !!(e.content as { src?: string } | undefined)?.src,
    ).length
    const narr = bundle?.narration ?? {}
    return saveLesson({
      doc,
      bundles,
      images: { done: doneImgs, total: totalImgs },
      audio: {
        done: Object.values(narr).filter((n) => !!n.audioUrl).length,
        total: Object.keys(narr).length,
      },
    })
      .then(() => setSaved(new Date().toLocaleTimeString('vi')))
      .catch(() => setSaved('lỗi lưu'))
      .finally(() => setSavingNow(false))
  }, [])

  /** the topbar "Lưu" button — save the latest edit immediately, no debounce */
  const onSave = useCallback(() => {
    if (!lessonId || !latest.current) return
    if (timer.current) clearTimeout(timer.current)
    void persist(latest.current.doc, latest.current.bundles)
  }, [lessonId, persist])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!lessonId) {
      // no lesson named — the sample, so the editor is still explorable
      setState({ doc: ACCEPTANCE_DOC, bundles: ACCEPTANCE_BUNDLES, lesson: null })
      return
    }
    void getLesson(lessonId)
      .then((l) => setState({ doc: l.doc, bundles: l.bundles, lesson: l }))
      .catch(() => setState({ doc: ACCEPTANCE_DOC, bundles: ACCEPTANCE_BUNDLES, lesson: null }))
  }, [lessonId])

  /** Autosave — debounced; the editor fires on every keystroke. */
  const onChange = useCallback(
    (doc: ExplainerDoc, bundles: Record<string, LocaleBundle>) => {
      latest.current = { doc, bundles }
      if (!lessonId) return // editing the sample — nothing to save it over
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void persist(doc, bundles), 900)
    },
    [lessonId, persist],
  )

  if (!state) return <div style={{ padding: 24 }}>Đang tải bài…</div>

  return (
    <div className="exw" style={{ position: 'relative' }}>
      {lessonId && (
        <span
          style={{
            position: 'fixed',
            right: 14,
            bottom: 10,
            zIndex: 40,
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(0,0,0,.55)',
            color: '#fff',
          }}
        >
          {saved === 'lỗi lưu' ? '⚠ chưa lưu được' : saved ? `✓ đã lưu ${saved}` : 'đã mở từ server'}
        </span>
      )}
      <ExplainerStudio
        doc={state.doc}
        bundles={state.bundles}
        onChange={onChange}
        useLocalDraft={!lessonId}
        onSave={onSave}
        saveState={
          !lessonId
            ? { label: 'Bản mẫu — không lưu', tone: 'saving' }
            : savingNow
              ? { label: 'Đang lưu…', tone: 'saving' }
              : saved === 'lỗi lưu'
                ? { label: 'Lưu lỗi', tone: 'error' }
                : saved
                  ? { label: `Đã lưu ${saved}`, tone: 'ok' }
                  : { label: 'Tự lưu bật', tone: 'ok' }
        }
      />
    </div>
  )
}
