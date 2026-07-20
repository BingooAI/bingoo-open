/**
 * NarrationPanel.tsx — the voice-over editor (Bingoo "audio" surface). Edit the
 * per-scene script, then "Tạo giọng" calls ElevenLabs (/api/tts) to generate
 * audio + per-word timing, stored on the narration. Falls back to a mock (word
 * timing only) when no API key is set, so the flow always works.
 */
'use client'
import * as React from 'react'
import { useState } from 'react'
import { Button } from '@bingoo.ai/ui-web'
import { useSnap, useStore } from '../store/ctx'
import type { EditOp } from '../store/ops'
import { EXPLAINER_API, apiPost } from './endpoints'

export function NarrationPanel({
  sceneId,
  narrId,
  onClose,
}: {
  sceneId: string
  narrId: string
  onClose: () => void
}) {
  const store = useStore()
  const { doc, bundles, ui } = useSnap()
  const scene = doc.scenes.find((s) => s.id === sceneId)
  const locale = ui.activeLocale
  const [voiceId, setVoiceId] = useState('')
  const [status, setStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [audioHits, setAudioHits] = useState<
    | {
        id: string
        url: string
        label?: string
        durationMs?: number
        words?: unknown
        cueMarks?: unknown
      }[]
    | null
  >(null)
  if (!scene) return null

  const narr = bundles[locale]?.narration[narrId]
  const script = narr?.script ?? ''

  const taRef = React.useRef<HTMLTextAreaElement | null>(null)
  const setScript = (s: string) => {
    store.dispatch({ t: 'narr.setScript', locale, narrId, script: s }, `narr:${narrId}`)
  }

  const remove = () => {
    if (!confirm('Xoá câu lời giảng này?')) return
    const ops: EditOp[] = [
      {
        t: 'scene.setNarrations',
        sceneId,
        narrations: (scene.narrations ?? []).filter((s) => s.ref !== narrId),
      },
    ]
    if (scene.narrationRef === narrId)
      ops.push({ t: 'scene.setNarrationRef', sceneId, narrationRef: undefined })
    store.batch(ops)
    onClose()
  }

  // Insert the next free cue token at the caret — the model can then bind a beat
  // or a manip action to `@c<N>` at that word.
  const insertCue = () => {
    const used = [...script.matchAll(/\[\[cue:c(\d+)\]\]/g)].map((m) => Number(m[1]))
    const n = (used.length ? Math.max(...used) : 0) + 1
    const token = `[[cue:c${n}]] `
    const ta = taRef.current
    const at = ta?.selectionStart ?? script.length
    setScript(script.slice(0, at) + token + script.slice(at))
    store.endCoalesce()
  }

  // Pick from the narration audio ALREADY baked into the library — reuse without
  // paying for TTS again. Restores the picked clip's word timings + cue marks.
  const browseAudio = async () => {
    setAudioHits([])
    try {
      const res = await apiPost<
        {
          id: string
          url: string
          label?: string
          durationMs?: number
          words?: unknown
          cueMarks?: unknown
        }[]
      >(EXPLAINER_API.audioFind, {
        q: script
          .replace(/\[\[cue:[^\]]+\]\]/g, '')
          .trim()
          .slice(0, 40),
        limit: 30,
      })
      setAudioHits(res)
    } catch {
      setAudioHits([])
    }
  }
  const useAudio = (h: { url: string; words?: unknown; cueMarks?: unknown }) => {
    store.dispatch({
      t: 'narr.setAudio',
      locale,
      narrId,
      audioUrl: h.url,
      words: (h.words as never) ?? [],
    })
    if (Array.isArray(h.cueMarks) && h.cueMarks.length)
      store.dispatch({ t: 'narr.setMarks', locale, narrId, marks: h.cueMarks as never })
    setAudioHits(null)
    setStatus('✓ Đã gắn giọng từ kho')
  }

  const generate = async () => {
    setBusy(true)
    setStatus('Đang tạo giọng…')
    try {
      // the API wraps success as `{ data: … }` — reading the payload off the outer
      // object gave `undefined` for every field, so the audio was thrown away
      const data = await apiPost<{
        audioUrl: string | null
        words: { word: string; start: number; end: number }[]
        cueMarks?: { cue: string; t: number }[]
        mock?: boolean
        error?: string
        duration?: number
      }>(EXPLAINER_API.tts, { text: script, voiceId: voiceId || undefined, locale })
      if (!data.audioUrl) throw new Error(data.error ?? 'TTS không trả audio')
      store.dispatch({
        t: 'narr.setAudio',
        locale,
        narrId,
        audioUrl: data.audioUrl,
        words: data.words,
      })
      // sync the VISUALS to the SPEECH: re-time every cue to when its word is spoken
      const aligned = (data.cueMarks ?? []).length
      if (aligned) store.dispatch({ t: 'narr.setMarks', locale, narrId, marks: data.cueMarks! })
      setStatus(
        (data.mock ? '✓ Mock · ' : '✓ ElevenLabs · ') +
          `${data.words.length} từ, ${data.duration?.toFixed(1)}s` +
          (aligned ? ` · đã khớp ${aligned} mốc hình với lời` : ''),
      )
    } catch (e) {
      setStatus('Lỗi: ' + String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cc-modal-scrim" onClick={onClose}>
      <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cc-modal-head">
          🔊 Lời giảng · cảnh “{scene.id}” · {locale.toUpperCase()}
          <button onClick={onClose}>✕</button>
        </div>
        <div className="cc-modal-body">
          <label className="cc-field">
            Lời cô đọc
            <textarea
              ref={taRef}
              className="cc-text"
              rows={5}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              onBlur={() => store.endCoalesce()}
              placeholder="Nhập lời giảng cho cảnh này…"
            />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginTop: -4 }}>
            <button className="cc-mini" onClick={insertCue}>
              ＋ Chèn cue
            </button>
            <span style={{ color: 'var(--cc-sub)' }}>
              Đặt <code>[[cue:c1]]</code> trước câu để buộc hiệu ứng/động tác vào đúng lúc cô nói. “Tạo giọng”
              sẽ tự canh giờ cho các cue.
            </span>
          </div>
          <label className="cc-field">
            Giọng (ElevenLabs Voice ID · để trống = mặc định)
            <input
              className="cc-inp"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="21m00Tcm4TlvDq8ikWAM"
            />
          </label>
          {audioHits !== null && (
            <div className="cc-audio-picker">
              {audioHits.length ? (
                audioHits.map((h) => (
                  <div key={h.id} className="cc-audio-row">
                    <audio controls src={h.url} style={{ height: 30, flex: 1 }} />
                    <span className="cc-audio-label" title={h.label}>
                      {h.label ?? '—'}
                    </span>
                    <button className="cc-mini" onClick={() => useAudio(h)}>
                      Dùng
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--cc-sub)', fontSize: 12, padding: 6 }}>
                  Kho chưa có giọng nào khớp. Tạo mới bên dưới.
                </div>
              )}
              <button className="cc-mini" onClick={() => setAudioHits(null)}>
                Đóng kho
              </button>
            </div>
          )}
          <div className="cc-modal-actions">
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => {
                store.endCoalesce()
                onClose()
              }}
            >
              ✓ Xong (chỉ lưu lời)
            </Button>
            <Button variant="soft" size="sm" disabled={busy || !script.trim()} onClick={generate}>
              {busy ? '…' : '✨ Tạo giọng (tuỳ chọn)'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={browseAudio}
              title="Chọn giọng đã tạo trong kho"
            >
              🎧 Kho giọng
            </Button>
            {narr?.audioUrl && <audio controls src={narr.audioUrl} style={{ height: 32 }} />}
            <span className="cc-flex" />
            <Button variant="danger" size="sm" onClick={remove}>
              🗑 Xoá câu này
            </Button>
          </div>
          {status && <div className="cc-modal-status">{status}</div>}
          {narr?.words && narr.words.length > 0 && (
            <div className="cc-words">
              {narr.words.map((w, i) => (
                <span key={i} title={`${w.start}s`}>
                  {w.word}
                </span>
              ))}
            </div>
          )}
          <div className="cc-modal-hint">
            Chỉ cần nhập lời rồi bấm <b>Xong</b> — không bắt buộc tạo giọng. Khi phát, lời chưa có giọng sẽ
            được đọc bằng giọng máy của trình duyệt (có thể tắt tiếng/tắt phụ đề ở trình phát). Tạo giọng
            ElevenLabs cần <code>ELEVENLABS_API_KEY</code> trong <code>.env.local</code>.
          </div>
        </div>
      </div>
    </div>
  )
}
