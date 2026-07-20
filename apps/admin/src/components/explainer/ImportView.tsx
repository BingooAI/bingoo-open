'use client'

/**
 * ImportView — bring an LLM-written lesson in, step by step.
 *
 * The steps are separate on purpose. Validation is free and can reject outright,
 * so nothing is spent until the shape is known good. Images and audio cost money
 * and can partly fail, so they run per-item, visibly, and are resumable — a
 * failed picture must not throw away a working narration. Only then does the
 * lesson reach the Studio, where a human fixes what a model can't.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ExplainerDoc, LocaleBundle } from '@bingoo.ai/explainer'
import { promptMarkdown, promptMessage, AUDIENCES, DEFAULT_MINUTES, planFor } from '@bingoo.ai/explainer'
import { buildProgram, frame } from '@bingoo.ai/explainer'
import { ExplainerPlayer, ExplainerStudio, Stage } from '@bingoo.ai/explainer-web'
import '@bingoo.ai/explainer-web/styles.css'
import { api } from '@/lib/api-client'
import { saveLesson, listLessons, getLesson, deleteLesson, type LessonRow } from '@/lib/explainerLessons'
import {
  validateImport,
  repairPrompt,
  pendingImages,
  pendingAudio,
  withImage,
  withAudio,
  type ImportIssue,
  type ImageJob,
  type MediaHit,
} from '@/lib/explainerImport'

/**
 * Order matters, and it is not the obvious one. Resolving images and speaking
 * narration COST MONEY, so they must not run on a lesson nobody has looked at:
 * you preview FIRST, on placeholders, and only pay once the lesson is worth
 * paying for. (Unresolved pictures render as labelled placeholders, so the
 * preview is honest about what is missing rather than showing holes.)
 */
type Step = 1 | 2 | 3 | 4 | 5
type JobState = 'idle' | 'running' | 'done' | 'error'
type Job = { key: string; label: string; state: JobState; note?: string }

const STEPS: { n: Step; title: string; sub: string }[] = [
  { n: 1, title: 'Kiểm tra', sub: 'schema · bố cục · sư phạm' },
  { n: 2, title: 'Xem thử & sửa', sub: 'miễn phí — duyệt trước khi tiêu tiền' },
  { n: 3, title: 'Ảnh', sub: 'tìm thư viện trước, sinh sau' },
  { n: 4, title: 'Giọng đọc', sub: 'TTS + mốc cue' },
  { n: 5, title: 'Hoàn tất', sub: 'xem lại · tải JSON' },
]

export function ImportView() {
  const [raw, setRaw] = useState('')
  const [step, setStep] = useState<Step>(1)
  const [issues, setIssues] = useState<ImportIssue[]>([])
  const [doc, setDoc] = useState<ExplainerDoc | null>(null)
  const [bundle, setBundle] = useState<LocaleBundle | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [busy, setBusy] = useState(false)
  const mode: 'play' | 'edit' = 'play'
  const [dragging, setDragging] = useState(false)
  const [hits, setHits] = useState<Record<string, MediaHit[]>>({})
  const [searched, setSearched] = useState(false)
  /** generated-but-not-yet-approved pictures, by element id */
  const [proposed, setProposed] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState('')

  /**
   * Read an uploaded lesson. Decoded as UTF-8 explicitly, and REPAIRED if it
   * arrives mojibake'd: a file saved as UTF-8 but written out through a cp1252
   * pipeline turns "Số chẵn" into "Sá» cháºµn". The lesson then imports and
   * plays with garbled Vietnamese in every string — technically valid, entirely
   * broken. Round-tripping the bytes back through latin-1 undoes it.
   */
  async function readFile(f: File) {
    setFileName(f.name)
    const text = await f.text()
    setRaw(looksMojibake(text) ? repairMojibake(text) : text)
    setIssues([])
  }

  const errors = issues.filter((i) => i.level === 'error')
  const warns = issues.filter((i) => i.level === 'warn')
  // LOCALE CHUẨN của bài = doc.meta.defaultLocale. File import (LLM sinh) đôi khi ghi bundle.locale
  // LỆCH ("vi-VN"/"en") → key bundle theo nó thì player/studio tra `defaultLocale` KHÔNG THẤY và nổ
  // trắng trang. Ép khớp doc — đúng cách store `importLesson` làm. Dùng chung cho player, TTS và bản
  // autosave, để không ghi locale lệch xuống DB.
  const docLocale = doc?.meta.defaultLocale ?? bundle?.locale ?? 'vi'
  const bundles = useMemo(
    () => (bundle ? { [docLocale]: { ...bundle, locale: docLocale } } : {}),
    [bundle, docLocale],
  )

  /* ── step 1 ── */
  function runValidate() {
    const r = validateImport(raw)
    setIssues(r.issues)
    if (!r.ok) {
      setDoc(null)
      setBundle(null)
      return
    }
    setDoc(r.parsed.doc)
    setBundle(r.parsed.bundle)
    setStep(2)
  }

  /* ── step 3: images ────────────────────────────────────────────────────────
   * SEARCH FIRST, GENERATE ONLY ON REQUEST.
   *
   * This used to call /image/resolve once per picture, and resolve searches and
   * then GENERATES on a miss. Six pictures meant six generations — 40–50 seconds
   * and real money each — spent before anyone had agreed the lesson was even
   * worth illustrating. And when a generation failed, the provider threw a plain
   * Error the API turned into a bare "Internal Server Error": you were charged
   * for five and told nothing about the sixth.
   *
   * Now: ONE batched search over the library — free, instant, duplicate queries
   * collapsed — the hits shown with their scores, and generation only for the
   * pictures a human explicitly clicks.
   */
  async function searchImages() {
    if (!doc) return
    const todo = pendingImages(doc)
    if (!todo.length) {
      setStep(4)
      return
    }
    setBusy(true)
    setJobs([])
    try {
      const res = await api.post<Record<string, MediaHit[]>>('/explainer/images/search', {
        queries: [...new Set(todo.map((t) => t.query))],
      })
      setHits(res)
      setSearched(true)
    } catch (e) {
      setJobs([
        {
          key: 'search',
          label: 'Tìm trong thư viện',
          state: 'error',
          note: String((e as Error).message),
        },
      ])
    }
    setBusy(false)
  }

  /**
   * Picking a library hit STAGES it, exactly like a generated one.
   *
   * It used to apply straight into the doc, so the row vanished the instant you
   * clicked and you never saw the picture in place — you were choosing from
   * thumbnails and finding out later, in the player, that the star you picked was
   * the wrong star. Library picks and generated pictures now go through the same
   * one gate: see it in the scene, then keep it.
   */
  function useHit(job: ImageJob, hit: MediaHit) {
    setProposed((p) => ({ ...p, [job.elementId]: hit.url }))
  }

  /**
   * The PAID path. Never automatic — only from an explicit click.
   *
   * And the result is STAGED, not applied. An image model draws a different
   * picture every run, and some are simply wrong — a shoe that isn't red, six
   * stars when the line says seven. Pasting whatever came back straight into the
   * lesson meant the only way to SEE it was to play the lesson, and the only way
   * to change it was to hand-edit JSON. So it is shown; you keep it, or you ask
   * for another.
   */
  async function generateImage(job: ImageJob) {
    setJobs((js) => [
      ...js.filter((j) => j.key !== job.elementId),
      { key: job.elementId, label: job.query, state: 'running' as JobState },
    ])
    try {
      const res = await api.post<{ url: string }>('/explainer/image/resolve', {
        // the image MODEL gets the English prompt; the LIBRARY gets the query
        prompt: job.prompt || job.query,
        query: job.query,
        alt: job.alt,
        tags: job.tags,
        allowGenerate: true,
        // "sinh cái khác": a fresh draw, not the one already cached for this prompt
        ...(proposed[job.elementId] ? { variant: Date.now() } : {}),
      })
      setProposed((p) => ({ ...p, [job.elementId]: res.url }))
      setJobs((js) =>
        js.map((j) =>
          j.key === job.elementId ? { ...j, state: 'done', note: 'ảnh mới — duyệt hoặc sinh lại' } : j,
        ),
      )
    } catch (e) {
      setJobs((js) =>
        js.map((j) =>
          j.key === job.elementId ? { ...j, state: 'error', note: String((e as Error).message) } : j,
        ),
      )
    }
  }

  function rejectProposed(job: ImageJob) {
    setProposed((p) => {
      const next = { ...p }
      delete next[job.elementId]
      return next
    })
  }

  function acceptProposed(job: ImageJob) {
    const url = proposed[job.elementId]
    if (!url) return
    setDoc((d) => (d ? withImage(d, job.elementId, url) : d))
    setProposed((p) => {
      const next = { ...p }
      delete next[job.elementId]
      return next
    })
  }

  /* ── step 3: audio ── */
  async function runAudio() {
    if (!bundle) return
    const todo = pendingAudio(bundle)
    if (!todo.length) {
      setStep(5)
      return
    }
    setBusy(true)
    setJobs(todo.map((t) => ({ key: t.ref, label: t.script.slice(0, 60), state: 'idle' as JobState })))
    let next = bundle
    for (const t of todo) {
      setJobs((js) => js.map((j) => (j.key === t.ref ? { ...j, state: 'running' } : j)))
      try {
        const res = await api.post<{
          audioUrl: string | null
          duration: number
          cueMarks: { cue: string; t: number }[]
          mock?: boolean
        }>('/explainer/tts', { text: t.script, locale: docLocale })
        if (res.audioUrl) next = withAudio(next, t.ref, res.audioUrl, res.cueMarks)
        setBundle(next)
        setJobs((js) =>
          js.map((j) =>
            j.key === t.ref
              ? {
                  ...j,
                  state: res.audioUrl ? 'done' : 'error',
                  note: res.audioUrl
                    ? `${res.duration.toFixed(1)}s · ${res.cueMarks.length} cue${res.mock ? ' (mock)' : ''}`
                    : 'TTS không trả audio',
                }
              : j,
          ),
        )
      } catch (e) {
        setJobs((js) =>
          js.map((j) => (j.key === t.ref ? { ...j, state: 'error', note: String((e as Error).message) } : j)),
        )
      }
    }
    setBusy(false)
  }

  const imgTodo = doc && bundle ? pendingImages(doc, bundle) : []

  // Search is free and instant, so it should just HAPPEN when you arrive. Making
  // it a button left "Sinh mới ($)" as the only thing on screen to click — the UI
  // was inviting you to pay before it had even looked.
  useEffect(() => {
    if (step === 3 && doc && !searched && !busy) void searchImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, doc])

  // AUTOSAVE. Pictures and narration cost money to produce; losing them to an
  // accidental refresh is not an acceptable failure mode, and this page had no
  // persistence of any kind.
  // AUTOSAVE TO THE SERVER. Pictures and narration cost money to produce; losing
  // them to a refresh is not an acceptable failure mode, and this page had no
  // persistence of any kind. Debounced — every accepted picture and every spoken
  // line changes the doc.
  const [saved, setSaved] = useState('')
  const [lessonId, setLessonId] = useState<string | null>(null)
  useEffect(() => {
    if (!doc || !bundle) return
    const t = setTimeout(() => {
      const totalImgs = doc.scenes.flatMap((s2) => s2.elements).filter((e) => e.type === 'image').length
      const totalAuds = Object.keys(bundle.narration ?? {}).length
      void saveLesson({
        doc,
        bundles,
        images: { done: totalImgs - pendingImages(doc).length, total: totalImgs },
        audio: { done: totalAuds - pendingAudio(bundle).length, total: totalAuds },
      })
        .then((row) => {
          setLessonId(row.id)
          setSaved(new Date().toLocaleTimeString('vi'))
          void listLessons()
            .then(setLessons)
            .catch(() => undefined)
        })
        .catch(() => setSaved('lỗi lưu'))
    }, 800)
    return () => clearTimeout(t)
  }, [doc, bundle, bundles])

  const [lessons, setLessons] = useState<LessonRow[]>([])
  useEffect(() => {
    void listLessons()
      .then(setLessons)
      .catch(() => setLessons([]))
  }, [])

  // Opened from the lessons list (?lesson=<id>) — load it straight into step 2.
  const params = useSearchParams()
  const openId = params.get('lesson')
  useEffect(() => {
    if (!openId || doc) return
    void getLesson(openId)
      .then((full) => {
        const b = Object.values(full.bundles)[0]
        if (!b) return
        setLessonId(full.id)
        setDoc(full.doc)
        setBundle(b)
        setStep(2)
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  /** Re-open a saved lesson. Its pictures and narration are MediaAssets with
   *  permanent URLs, so this plays what was made — it never regenerates. */
  async function resume(row: LessonRow) {
    const full = await getLesson(row.id)
    const b = Object.values(full.bundles)[0]
    if (!b) return
    setLessonId(full.id)
    setDoc(full.doc)
    setBundle(b)
    setIssues([])
    setSearched(false)
    setHits({})
    setStep(2)
  }

  const audTodo = bundle ? pendingAudio(bundle) : []

  return (
    <div
      className="exw"
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '24px 20px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, letterSpacing: '-0.02em' }}>Nhập bài từ AI</h1>
        <p style={{ margin: 0, color: 'var(--foreground-muted, #6f665e)', maxWidth: '70ch' }}>
          Tải file hướng dẫn bên dưới, đưa cho AI, rồi dán JSON nó trả về vào đây. Ảnh và giọng đọc được điền
          ở các bước sau — model chỉ mô tả ảnh bằng <code>query</code>, vì một model bịa URL ảnh là bịa ra một
          cái 404.
        </p>
      </header>

      <PromptCard />

      {step === 1 && lessons.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Bài của anh</h2>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--foreground-muted, #6f665e)',
              maxWidth: '74ch',
            }}
          >
            Lưu trên server, gắn với tài khoản. Ảnh và giọng đọc đã sinh là <b>MediaAsset thật</b> — mở lại là
            phát luôn, <b>không sinh lại, không trả tiền lần hai</b>. Mở được từ máy khác.
          </p>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {lessons.map((l) => (
              <li
                key={l.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #e6ddd0)',
                  fontSize: 13,
                }}
              >
                <span style={{ flex: 1, minWidth: 160, fontWeight: 700 }}>{l.title}</span>
                <span
                  style={{
                    color: 'var(--foreground-muted, #6f665e)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ảnh {l.imagesDone}/{l.imagesTotal} · giọng {l.audioDone}/{l.audioTotal}
                </span>
                <span style={{ color: 'var(--foreground-muted, #6f665e)' }}>
                  {new Date(l.updatedAt).toLocaleString('vi')}
                </span>
                <Btn primary onClick={() => void resume(l)}>
                  Mở tiếp
                </Btn>
                <Btn onClick={() => void deleteLesson(l.id).then(() => listLessons().then(setLessons))}>
                  Xoá
                </Btn>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Stepper step={step} onGo={setStep} canGo={(n) => n === 1 || !!doc} />
      {doc && saved && (
        <span
          style={{
            fontSize: 12,
            color: saved === 'lỗi lưu' ? '#c0392b' : 'var(--foreground-muted, #6f665e)',
          }}
        >
          {saved === 'lỗi lưu' ? '⚠ chưa lưu được lên server' : `✓ đã lưu lên server lúc ${saved}`}
        </span>
      )}

      {step === 1 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files[0]
              if (f) void readFile(f)
            }}
            style={{
              padding: '18px',
              borderRadius: 10,
              textAlign: 'center',
              border: `2px dashed ${dragging ? 'var(--accent-coral, #d4703c)' : 'var(--border, #e6ddd0)'}`,
              background: dragging ? 'rgba(212,112,60,.07)' : 'transparent',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Kéo file .json vào đây</div>
            <div style={{ fontSize: 13, color: 'var(--foreground-muted, #6f665e)', marginBottom: 10 }}>
              hoặc dán JSON vào ô bên dưới
            </div>
            <input
              type="file"
              accept=".json,application/json,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void readFile(f)
              }}
              style={{ display: 'none' }}
              id="lesson-file"
            />
            <label htmlFor="lesson-file">
              <span
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  border: '1px solid var(--border, #e6ddd0)',
                }}
              >
                Chọn file…
              </span>
            </label>
            {fileName && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--foreground-muted, #6f665e)' }}>
                {fileName}
              </div>
            )}
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder='{ "doc": { ... }, "bundle": { ... } }'
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 260,
              padding: 14,
              borderRadius: 10,
              border: '1px solid var(--border, #e6ddd0)',
              background: 'var(--surface, #fff)',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 13,
              lineHeight: 1.5,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Btn onClick={runValidate} disabled={!raw.trim()} primary>
              Kiểm tra
            </Btn>
            {errors.length > 0 && (
              <Btn onClick={() => navigator.clipboard.writeText(repairPrompt(issues))}>
                Copy lỗi để dán lại cho AI
              </Btn>
            )}
          </div>

          {issues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {errors.length > 0 && <Note tone="bad">{errors.length} lỗi — bài bị từ chối.</Note>}
              {!errors.length && warns.length > 0 && (
                <Note tone="warn">{warns.length} cảnh báo — vẫn nhập được.</Note>
              )}
              {issues.map((i, k) => (
                <div
                  key={k}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    background: i.level === 'error' ? 'rgba(200,60,40,.06)' : 'rgba(217,139,43,.08)',
                    border: `1px solid ${i.level === 'error' ? 'rgba(200,60,40,.25)' : 'rgba(217,139,43,.3)'}`,
                  }}
                >
                  <b style={{ fontFamily: 'ui-monospace, monospace' }}>{i.code}</b>{' '}
                  <span style={{ color: 'var(--foreground-muted, #6f665e)' }}>{i.where}</span>
                  <div>{i.message}</div>
                  {i.fix && (
                    <div style={{ marginTop: 4, color: 'var(--accent-coral, #d4703c)' }}>FIX → {i.fix}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 3 && doc && bundle && (
        <ImagesPane
          todo={imgTodo}
          hits={hits}
          searched={searched}
          busy={busy}
          jobs={jobs}
          proposed={proposed}
          onAccept={acceptProposed}
          onReject={rejectProposed}
          scenePreview={(job, url) => {
            // Render THE ACTUAL SCENE this picture lands in, with the candidate in
            // place. Approving a picture without seeing where it goes is guessing:
            // the same picture is right in one scene and wrong in the next.
            const staged = url ? withImage(doc, job.elementId, url) : doc
            return <ScenePreview doc={staged} bundle={bundle} sceneId={job.sceneId} />
          }}
          onSearch={searchImages}
          onUse={useHit}
          onGenerate={generateImage}
          onNext={() => setStep(4)}
          resolved={(id) => {
            const el = doc.scenes.flatMap((sc) => sc.elements).find((e) => e.id === id)
            return !!(el?.content as { src?: string } | undefined)?.src
          }}
        />
      )}

      {step === 4 && bundle && (
        <StepPane
          title={`Giọng đọc — ${audTodo.length} lời giảng`}
          hint="TTS trả về mốc cue để khớp hiệu ứng với lời. Nếu TTS không trả mốc, mốc của model được giữ nguyên — bỏ chúng đi là gỡ hết hiệu ứng khỏi lời giảng."
          jobs={jobs}
          busy={busy}
          onRun={runAudio}
          runLabel={audTodo.length ? `Đọc ${audTodo.length} lời giảng` : 'Không có lời giảng nào cần đọc'}
          onNext={() => setStep(5)}
          canNext={!busy}
        />
      )}

      {(step === 2 || step === 5) && doc && bundle && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {step === 2 && (
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Xem thử — chưa tốn đồng nào</h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--foreground-muted, #6f665e)',
                  maxWidth: '72ch',
                }}
              >
                Ảnh chưa sinh nên hiện dưới dạng ô có nhãn — đủ để đọc bài. Duyệt xong (hoặc sửa trong Studio)
                rồi mới sang bước Ảnh và Giọng đọc, vì hai bước đó <b>mất tiền</b>.
              </p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* The Studio is a FULL-SCREEN editor on a SAVED lesson — so it opens
                in its own tab, pointed at this lesson, rather than swapping mode
                on a copy that only exists in this component's memory. */}
            <a
              href={lessonId ? `/vi/studio?lesson=${lessonId}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={lessonId ? 'Mở Studio ở tab mới, đúng bài này' : 'Đang lưu bài lên server…'}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                border: '1px solid var(--border, #e6ddd0)',
                color: 'inherit',
                opacity: lessonId ? 1 : 0.45,
                pointerEvents: lessonId ? 'auto' : 'none',
              }}
            >
              Mở Studio để sửa ↗
            </a>
            {step === 2 && <Btn onClick={() => setStep(3)}>Bài ổn → sinh ảnh &amp; giọng đọc →</Btn>}
            <Btn
              onClick={() => {
                const blob = new Blob([JSON.stringify({ doc, bundle }, null, 2)], {
                  type: 'application/json',
                })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `${doc.meta.id}.json`
                a.click()
              }}
            >
              Tải JSON
            </Btn>
          </div>
          {mode === 'play' ? (
            <div
              style={{
                border: '1px solid var(--border, #e6ddd0)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <ExplainerPlayer doc={doc} bundles={bundles} />
            </div>
          ) : (
            <ExplainerStudio doc={doc} bundles={bundles} />
          )}
        </section>
      )}
    </div>
  )
}

/**
 * The brief you hand to the model. It is BUILT HERE, in the browser, from the
 * running engine (`promptMarkdown()`) — not served as a static file. A file would
 * be a copy, and a copy drifts: someone moves a slot, and the doc on a teacher's
 * desktop still describes the old one. This can only ever describe the engine
 * that is actually deployed.
 */
function PromptCard() {
  const [copied, setCopied] = useState<'' | 'brief' | 'full' | 'msg'>('')
  const [topic, setTopic] = useState('Số chẵn và số lẻ')
  const [stage, setStage] = useState(AUDIENCES[1]?.id ?? 'primary')
  const [detail, setDetail] = useState('lớp 1')
  // The field holds the RAW TEXT while you type; the number is only read back
  // from it. Clamping on every keystroke made the input unusable: typing "1" on
  // the way to "10" was rewritten to "3" (the minimum), and clearing the box gave
  // Number("") === 0, which is falsy, so it snapped back to the default — you
  // could neither type a two-digit value nor delete what was there.
  const [minutesText, setMinutesText] = useState(String(DEFAULT_MINUTES))
  const minutes = clampMinutes(Number(minutesText)) ?? DEFAULT_MINUTES

  const audience = `${AUDIENCES.find((a) => a.id === stage)?.label ?? ''}${detail ? ` — ${detail}` : ''}`
  // The brief is generated FOR this duration: the scene count and every phase
  // minimum inside it scale with the minutes, because a teacher has minutes,
  // not scenes.
  // TWO versions, TWO buttons.
  //   • brief (~40KB) — the upload-safe one. The full document is 120KB of
  //     absolute rules and big embedded-JSON dumps, and an upload-time safety
  //     classifier reads that shape as a prompt-injection payload, so ChatGPT/
  //     Claude refuse the file. The brief keeps every rule, stated as a spec.
  //   • full (~120KB) — every kit's params, all 55 question shapes, a complete
  //     14-scene sample. The strongest reference; use it in a tool that accepts
  //     large files, or when the brief-authored draft needs more to imitate.
  const briefMd = useMemo(() => promptMarkdown(minutes, true), [minutes])
  const fullMd = useMemo(() => promptMarkdown(minutes, false), [minutes])
  const msg = useMemo(() => promptMessage(topic || '<CHỦ ĐỀ>', audience, minutes), [topic, audience, minutes])
  const plan = useMemo(() => planFor(minutes), [minutes])

  const copy = (text: string, which: '' | 'brief' | 'full' | 'msg') => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(which)
      setTimeout(() => setCopied(''), 1600)
    })
  }
  const download = (text: string, suffix: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
    a.download = `EXPLAINER-PROMPT-${minutes}p-${suffix}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px',
        borderRadius: 12,
        border: '1px solid var(--border, #e6ddd0)',
        background: 'rgba(212,112,60,.05)',
      }}
    >
      <div style={{ fontWeight: 800 }}>1 · Đính kèm file này cho AI</div>

      <div
        style={{
          display: 'grid',
          gap: 10,
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        }}
      >
        {/* upload-safe default */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            borderRadius: 10,
            border: '1px solid var(--accent-coral, #d4703c)',
          }}
        >
          <div style={{ fontWeight: 700 }}>
            Bản gọn — {(briefMd.length / 1024).toFixed(0)} KB · để tải lên
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--foreground-muted, #6f665e)' }}>
            Đủ luật bố cục + sư phạm, kit & câu hỏi rút gọn, 4 ví dụ. Không bị ChatGPT/Claude chặn.
            <b> Chất lượng vẫn được cổng kiểm tra đảm bảo</b> khi nhập lại.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn primary onClick={() => download(briefMd, 'gon')}>
              ↓ Tải bản gọn
            </Btn>
            <Btn onClick={() => copy(briefMd, 'brief')}>{copied === 'brief' ? '✓ Đã copy' : 'Copy'}</Btn>
          </div>
        </div>
        {/* full reference */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            borderRadius: 10,
            border: '1px solid var(--border, #e6ddd0)',
          }}
        >
          <div style={{ fontWeight: 700 }}>Bản đầy đủ — {(fullMd.length / 1024).toFixed(0)} KB · tra cứu</div>
          <div style={{ fontSize: 12.5, color: 'var(--foreground-muted, #6f665e)' }}>
            Mọi kit (kèm giá trị hợp lệ), cả 55 loại câu hỏi, bài mẫu 14 scene. Bản mạnh nhất — nhưng{' '}
            <b>có thể bị chặn khi tải lên</b> do quá dài. Dùng khi công cụ nhận file lớn.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => download(fullMd, 'day-du')}>↓ Tải bản đầy đủ</Btn>
            <Btn onClick={() => copy(fullMd, 'full')}>{copied === 'full' ? '✓ Đã copy' : 'Copy'}</Btn>
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border, #e6ddd0)',
          paddingTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800 }}>2 · Tin nhắn gửi kèm</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Field label="Chủ đề" value={topic} onChange={setTopic} />
          <label
            style={{
              flex: '1 1 170px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--foreground-muted, #6f665e)',
            }}
          >
            Đối tượng
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as typeof stage)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                border: '1px solid var(--border, #e6ddd0)',
                background: 'var(--surface, #fff)',
                color: 'inherit',
              }}
            >
              {AUDIENCES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Cụ thể hơn" value={detail} onChange={setDetail} />
          <label
            style={{
              flex: '0 0 150px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--foreground-muted, #6f665e)',
            }}
          >
            Thời lượng (phút)
            <input
              type="number"
              min={MIN_MINUTES}
              max={MAX_MINUTES}
              value={minutesText}
              onChange={(e) => setMinutesText(e.target.value)}
              // clamp only when you LEAVE the field — never while typing
              onBlur={() => setMinutesText(String(clampMinutes(Number(minutesText)) ?? DEFAULT_MINUTES))}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                border: '1px solid var(--border, #e6ddd0)',
                background: 'var(--surface, #fff)',
                color: 'inherit',
              }}
            />
            <span style={{ fontWeight: 500, fontSize: 11 }}>
              {MIN_MINUTES}–{MAX_MINUTES} phút → ~{plan.scenes} scene
            </span>
          </label>
        </div>
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e6ddd0)',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        >
          {msg}
        </pre>
        <div>
          <Btn primary onClick={() => copy(msg, 'msg')}>
            {copied === 'msg' ? '✓ Đã copy tin nhắn' : 'Copy tin nhắn'}
          </Btn>
        </div>
      </div>
    </section>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label
      style={{
        flex: '1 1 220px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--foreground-muted, #6f665e)',
      }}
    >
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          border: '1px solid var(--border, #e6ddd0)',
          background: 'var(--surface, #fff)',
          color: 'inherit',
        }}
      />
    </label>
  )
}

/** Below this relevance the resolver does not trust a library hit. Shown so
 *  "không tìm thấy" means something instead of just "shrug". */
const SCORE_HINT = 0.34

const MIN_MINUTES = 3
const MAX_MINUTES = 45

/** null while the box holds something that isn't a usable number yet (empty, "1"
 *  on the way to "10") — the caller keeps the last good value instead of fighting
 *  the keystroke. */
function clampMinutes(n: number): number | null {
  if (!Number.isFinite(n) || n < MIN_MINUTES || n > MAX_MINUTES) return null
  return Math.round(n)
}

/** The scene a picture lands in, drawn by the real engine at a glance-able size. */
function ScenePreview({
  doc,
  bundle,
  sceneId,
}: {
  doc: ExplainerDoc
  bundle: LocaleBundle
  sceneId: string
}) {
  const model = useMemo(() => {
    const program = buildProgram(doc, bundle, '16:9')
    const slot = program.slots.find((s) => s.scene.id === sceneId)
    return frame(program, Math.max(0, (slot?.end ?? 0) - 0.05))
  }, [doc, bundle, sceneId])
  return (
    <div
      style={{
        aspectRatio: '16 / 9',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border, #e6ddd0)',
      }}
    >
      <Stage model={model} theme={doc.theme} caption={false} />
    </div>
  )
}

/** Telltale of UTF-8 bytes read as cp1252/latin-1: "Ã", "á»", "áº" clusters. */
function looksMojibake(s: string): boolean {
  const hits = (s.match(/[ÃÂáºá»Ä]/g) ?? []).length
  return hits > 20 && hits > s.length / 500
}

function repairMojibake(s: string): string {
  try {
    const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return s // not actually mojibake — leave it alone
  }
}

/* ───────────────────────────────────────────────────────────────────── chrome */

function Stepper({
  step,
  onGo,
  canGo,
}: {
  step: Step
  onGo: (s: Step) => void
  canGo: (s: Step) => boolean
}) {
  return (
    <ol
      style={{
        display: 'flex',
        gap: 8,
        listStyle: 'none',
        margin: 0,
        padding: 0,
        flexWrap: 'wrap',
      }}
    >
      {STEPS.map((s) => {
        const active = s.n === step
        const done = s.n < step
        const allowed = canGo(s.n)
        return (
          <li key={s.n} style={{ flex: '1 1 180px' }}>
            <button
              type="button"
              disabled={!allowed}
              onClick={() => allowed && onGo(s.n)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                borderRadius: 10,
                cursor: allowed ? 'pointer' : 'default',
                border: `1px solid ${active ? 'var(--accent-coral, #d4703c)' : 'var(--border, #e6ddd0)'}`,
                background: active ? 'rgba(212,112,60,.08)' : done ? 'rgba(63,157,90,.07)' : 'transparent',
                opacity: allowed ? 1 : 0.5,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--foreground-muted, #6f665e)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {done ? '✓' : s.n}
              </div>
              <div style={{ fontWeight: 800 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--foreground-muted, #6f665e)' }}>{s.sub}</div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** Search is free and instant. Generation costs money and 40+ seconds — so it
 *  never happens on its own; you look at what the library already has, and click
 *  to generate only what it doesn't. */
function ImagesPane({
  todo,
  hits,
  searched,
  busy,
  jobs,
  onSearch,
  onUse,
  onGenerate,
  onNext,
  resolved,
  proposed,
  onAccept,
  onReject,
  scenePreview,
}: {
  todo: ImageJob[]
  hits: Record<string, MediaHit[]>
  searched: boolean
  busy: boolean
  jobs: Job[]
  /** generated but NOT yet approved — shown for a decision, not applied */
  proposed: Record<string, string>
  onAccept: (j: ImageJob) => void
  onReject: (j: ImageJob) => void
  /** the scene this picture lands in, rendered with the candidate in place */
  scenePreview: (j: ImageJob, url?: string) => React.ReactNode
  onSearch: () => void
  onUse: (j: ImageJob, h: MediaHit) => void
  onGenerate: (j: ImageJob) => void
  onNext: () => void
  resolved: (elementId: string) => boolean
}) {
  const done = todo.filter((t) => resolved(t.elementId)).length
  const found = todo.filter((t) => (hits[t.query] ?? []).length > 0).length
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Ảnh — {todo.length} cần điền</h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--foreground-muted, #6f665e)',
            maxWidth: '74ch',
          }}
        >
          <b>Tìm là miễn phí, sinh mới thì tốn tiền</b> (~40s và một lượt gọi model mỗi ảnh). Nên ở đây chỉ
          <b> tìm trong thư viện</b> — một lần cho cả loạt, gộp các mô tả trùng nhau. Ảnh nào thư viện có thì
          bấm chọn; ảnh nào không có, anh <b>tự bấm “Sinh mới”</b>.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn onClick={onSearch} disabled={busy}>
          {busy ? 'Đang tìm…' : 'Tìm lại (miễn phí)'}
        </Btn>
        <Btn onClick={onNext} disabled={busy} primary>
          Bước tiếp →
        </Btn>
        <span
          style={{
            fontSize: 13,
            color: 'var(--foreground-muted, #6f665e)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {done}/{todo.length} đã có ảnh
          {searched && ` · ${found}/${todo.length} tìm thấy trong thư viện`}
        </span>
      </div>

      {jobs
        .filter((j) => j.state === 'error')
        .map((j) => (
          <div
            key={j.key}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 13,
              background: 'rgba(200,60,40,.06)',
              border: '1px solid rgba(200,60,40,.25)',
            }}
          >
            <b>{j.label}</b> — {j.note}
          </div>
        ))}

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {todo.map((t) => {
          const cands = hits[t.query] ?? []
          const job = jobs.find((j) => j.key === t.elementId)
          const ok = resolved(t.elementId)
          return (
            <li
              key={t.elementId}
              style={{
                border: '1px solid var(--border, #e6ddd0)',
                borderRadius: 10,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: ok ? 'rgba(63,157,90,.05)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ width: 16 }}>{ok ? '✓' : job?.state === 'running' ? '…' : '·'}</span>
                <span style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' }}>
                  <b>{t.sceneTitle ?? t.sceneId}</b>
                  <span style={{ fontSize: 12, color: 'var(--foreground-muted, #6f665e)' }}>{t.query}</span>
                  {t.caption && (
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted, #6f665e)' }}>
                      <span style={{ fontWeight: 700 }}>Lời giảng: </span>“{t.caption}”
                    </span>
                  )}
                </span>
                {job?.note && (
                  <span
                    style={{
                      fontSize: 12,
                      color: job.state === 'error' ? '#c0392b' : 'var(--foreground-muted, #6f665e)',
                    }}
                  >
                    {job.note}
                  </span>
                )}
                {/* the PAID button only appears once the FREE search has actually
                    run — otherwise the only thing to click is the one that costs money */}
                {searched ? (
                  <Btn onClick={() => onGenerate(t)} disabled={job?.state === 'running' || busy}>
                    {job?.state === 'running' ? 'Đang sinh…' : 'Sinh mới ($)'}
                  </Btn>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--foreground-muted, #6f665e)' }}>đang tìm…</span>
                )}
              </div>
              {proposed[t.elementId] && (
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: 8,
                    borderRadius: 8,
                    background: 'rgba(212,112,60,.07)',
                    border: '1px solid var(--border, #e6ddd0)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proposed[t.elementId]}
                    alt={t.alt ?? t.query}
                    style={{
                      width: 96,
                      height: 96,
                      objectFit: 'contain',
                      borderRadius: 6,
                      background: '#fff',
                    }}
                  />
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    {scenePreview(t, proposed[t.elementId])}
                  </div>
                  <div style={{ flex: '0 0 210px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{t.sceneTitle ?? t.sceneId}</div>
                    {t.caption && (
                      // the LINE OF SCRIPT this scene narrates — so you can judge
                      // whether the picture matches what is being said, not just
                      // whether it looks nice. (Audio isn't generated until a
                      // later step, so this is text, not a speaker.)
                      <div
                        style={{
                          fontSize: 12,
                          lineHeight: 1.45,
                          color: 'var(--foreground-muted, #6f665e)',
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>Lời giảng: </span>“{t.caption}”
                      </div>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--foreground-muted, #6f665e)' }}>
                      Ảnh đang chọn, đặt vào đúng scene bên trái. Bài chỉ nhận khi anh <b>duyệt</b>.
                    </span>
                    <Btn primary onClick={() => onAccept(t)}>
                      Dùng ảnh này
                    </Btn>
                    <Btn onClick={() => onGenerate(t)}>Sinh cái khác ($)</Btn>
                    <Btn onClick={() => onReject(t)}>Bỏ</Btn>
                  </div>
                </div>
              )}
              {!searched && !busy && (
                <span style={{ fontSize: 12, color: 'var(--foreground-muted, #6f665e)' }}>Chưa tìm.</span>
              )}
              {searched &&
                (cands.length ? (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {cands.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => onUse(t, h)}
                        title={`${h.label ?? ''} · điểm ${h.score.toFixed(2)}`}
                        style={{
                          flex: '0 0 auto',
                          width: 92,
                          padding: 4,
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: 'transparent',
                          border: '1px solid var(--border, #e6ddd0)',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={h.url}
                          alt={h.label ?? ''}
                          style={{
                            width: '100%',
                            height: 68,
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--foreground-muted, #6f665e)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {h.score.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--foreground-muted, #6f665e)' }}>
                    Đã tìm — <b>thư viện không có ảnh nào khớp</b> (điểm dưới ngưỡng {SCORE_HINT}). Bấm “Sinh
                    mới ($)” nếu ảnh này đáng để tốn tiền.
                  </span>
                ))}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function StepPane({
  title,
  hint,
  jobs,
  busy,
  onRun,
  runLabel,
  onNext,
  canNext,
}: {
  title: string
  hint: string
  jobs: Job[]
  busy: boolean
  onRun: () => void
  runLabel: string
  onNext: () => void
  canNext: boolean
}) {
  const done = jobs.filter((j) => j.state === 'done').length
  const failed = jobs.filter((j) => j.state === 'error').length
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{title}</h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--foreground-muted, #6f665e)',
            maxWidth: '72ch',
          }}
        >
          {hint}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Btn onClick={onRun} disabled={busy} primary>
          {busy ? 'Đang chạy…' : runLabel}
        </Btn>
        <Btn onClick={onNext} disabled={!canNext}>
          Bước tiếp →
        </Btn>
        {failed > 0 && <Note tone="warn">{failed} lỗi — bấm chạy lại, phần đã xong sẽ được bỏ qua.</Note>}
        {jobs.length > 0 && (
          <span
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted, #6f665e)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {done}/{jobs.length}
          </span>
        )}
      </div>
      {jobs.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {jobs.map((j) => (
            <li
              key={j.key}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                border: '1px solid var(--border, #e6ddd0)',
                background:
                  j.state === 'error'
                    ? 'rgba(200,60,40,.05)'
                    : j.state === 'done'
                      ? 'rgba(63,157,90,.05)'
                      : 'transparent',
              }}
            >
              <span style={{ width: 18 }}>
                {j.state === 'done' ? '✓' : j.state === 'error' ? '✗' : j.state === 'running' ? '…' : '·'}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {j.label}
              </span>
              {j.note && <span style={{ color: 'var(--foreground-muted, #6f665e)' }}>{j.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Btn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 16px',
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 14,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        border: '1px solid var(--border, #e6ddd0)',
        background: primary ? 'var(--accent-coral, #d4703c)' : 'transparent',
        color: primary ? '#fff' : 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function Note({ tone, children }: { tone: 'bad' | 'warn'; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: tone === 'bad' ? '#c0392b' : '#b7791f',
      }}
    >
      {children}
    </span>
  )
}
