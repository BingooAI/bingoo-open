// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Properties.tsx — visual properties for the selected object (Bingoo inspector).
 * Colour swatches, a size slider, an animation gallery, per-type extras (text
 * content, manipulative params + interactivity). No coordinates/z/cues exposed.
 */
'use client'
import * as React from 'react'
import { useState } from 'react'
import type {
  Element,
  StyleTokens,
  Place,
  ManipulativeContent,
  Scene,
  GateSpec,
  Background,
} from '@bingoo.ai/explainer'
import { resolveNarrations, contractOf, templateCatalog, SFX_NAMES } from '@bingoo.ai/explainer'
import { sfxUrl } from '../../sfx-base'
import { EXPLAINER_API, apiPost } from './endpoints'
import { useSnap, useStore } from '../store/ctx'
import type { EditOp } from '../store/ops'
import { getEl } from '../store/ops'
import { EffectGallery } from '../panels/EffectGallery'
import { effectsOn, effectLabel } from '../effects'
import { manipCatalog, manipInfo, SUBJECTS } from '../manipCatalog'
import type { CapCtx } from './ExplainerStudio'

export function Properties({ cap }: { cap: CapCtx }) {
  const store = useStore()
  const { doc, ui } = useSnap()
  const [addFx, setAddFx] = useState(false)
  const el = ui.selection ? getEl(doc, ui.activeSceneId, ui.selection) : undefined
  const activeScene = doc.scenes.find((s) => s.id === ui.activeSceneId)

  if (!el && activeScene?.kind === 'gate' && activeScene.gate) {
    return (
      <div className="cc-props">
        <div className="cc-props-head">❓ Câu hỏi tương tác</div>
        <div className="cc-props-body">
          <GateProps scene={activeScene} />
        </div>
      </div>
    )
  }
  if (!el)
    return (
      <div className="cc-props">
        <div className="cc-props-head">🎬 Cảnh</div>
        <div className="cc-props-body">
          {activeScene && <SceneProps scene={activeScene} cap={cap} />}
          <div className="cc-props-empty">
            Bấm một đối tượng trên khung để sửa, hoặc thêm mới từ panel bên trái.
          </div>
        </div>
      </div>
    )
  if (el.type === 'audio')
    return (
      <div className="cc-props">
        <div className="cc-props-head">🔊 Âm thanh</div>
        <div className="cc-props-body">
          <AudioProps el={el} sceneId={ui.activeSceneId} />
        </div>
      </div>
    )
  if (el.type === 'connector')
    return (
      <div className="cc-props">
        <div className="cc-props-head">↳ Mũi tên nối</div>
        <div className="cc-props-body">
          <ConnectorProps el={el} sceneId={ui.activeSceneId} />
        </div>
      </div>
    )

  const sceneId = ui.activeSceneId
  const setStyle = (p: Partial<StyleTokens>) =>
    store.dispatch({
      t: 'el.setStyle',
      sceneId,
      elId: el.id,
      style: { ...(el.style ?? {}), ...p },
    })
  const setPlace = (p: Partial<Place>) => {
    const base: Place = el.place ?? { at: 'free', x: 0.5, y: 0.5, size: 0.2 }
    store.dispatch({ t: 'el.setPlace', sceneId, elId: el.id, place: { ...base, ...p } })
  }
  const scene = doc.scenes.find((s) => s.id === sceneId)!
  const fx = effectsOn(scene, el.id)

  return (
    <div className="cc-props">
      <div className="cc-props-head">{typeLabel(el)}</div>
      <div className="cc-props-body">
        {el.type === 'text' && <TextEditor elId={el.id} />}
        {el.type === 'list' && <ListProps el={el} />}
        {el.type === 'chart' && <ChartProps el={el} />}
        {el.type === 'stat' && <StatProps el={el} />}
        {el.type === 'quote' && <QuoteProps el={el} />}
        {el.type === 'table' && <TableProps el={el} />}
        {el.type === 'image' && <ImageProps el={el} />}
        {/* region layout — where the element sits, for docs authored by slot
            (imported lessons) rather than by free x/y placement */}
        {el.region !== undefined && <RegionProps el={el} />}

        <div className="cc-card">
          <h5>Màu</h5>
          <div className="cc-sw">
            {Object.entries(doc.theme.colors).map(([k, v]) => (
              <button
                key={k}
                title={k}
                className={el.style?.color === k ? 'on' : ''}
                style={{ background: v }}
                onClick={() => setStyle({ color: k })}
              />
            ))}
          </div>
        </div>

        {!el.region && (
          <div className="cc-card">
            <h5>Kích thước & xoay</h5>
            <Slider
              label="Cỡ"
              v={el.place?.size ?? 0.2}
              min={0.04}
              max={1}
              on={(size) => setPlace({ size })}
            />
            {(el.type === 'text' || el.type === 'diagram' || el.type === 'manipulative') && (
              <Slider label="Rộng" v={el.place?.w ?? 0.6} min={0.1} max={1} on={(w) => setPlace({ w })} />
            )}
            <Slider
              label="Xoay"
              v={el.place?.rotate ?? 0}
              min={-180}
              max={180}
              on={(rotate) => setPlace({ rotate })}
              unit="°"
              step={1}
            />
            <Slider
              label="Độ mờ"
              v={el.style?.opacity ?? 1}
              min={0.1}
              max={1}
              on={(opacity) => setStyle({ opacity: +opacity.toFixed(2) })}
            />
            {el.type === 'text' &&
              (() => {
                const keys = Object.entries(doc.theme.fontSizes)
                  .sort((a, b) => a[1] - b[1])
                  .map(([k]) => k)
                const labels = ['Nhỏ', 'Vừa', 'Lớn', 'Rất lớn', 'Khổng lồ']
                return (
                  <div className="cc-prow">
                    <label>Cỡ chữ</label>
                    <select
                      className="cc-select"
                      style={{ width: 'auto' }}
                      value={el.style?.fontSize ?? 'body'}
                      onChange={(e) => setStyle({ fontSize: e.target.value })}
                    >
                      {keys.map((k, i) => (
                        <option key={k} value={k}>
                          {labels[i] ?? k}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })()}
            <div className="cc-align">
              <button onClick={() => setPlace({ x: 0.5 })}>Canh giữa</button>
              <button
                onClick={() => store.dispatch({ t: 'el.setZ', sceneId, elId: el.id, z: (el.z ?? 0) + 1 })}
              >
                Lên lớp
              </button>
              <button
                onClick={() =>
                  store.dispatch({
                    t: 'el.setZ',
                    sceneId,
                    elId: el.id,
                    z: Math.max(0, (el.z ?? 0) - 1),
                  })
                }
              >
                Xuống lớp
              </button>
            </div>
          </div>
        )}

        <div className="cc-card">
          <h5>Hoạt hình</h5>
          <div className="cc-fxlist">
            {fx.map((f) => (
              <span key={f.beatId + f.idx} className="cc-fxchip">
                {effectLabel(f.action)}
                <button
                  onClick={() => {
                    const b = scene.beats?.find((x) => x.id === f.beatId)
                    if (b)
                      store.dispatch({
                        t: 'beat.setActions',
                        sceneId,
                        beatId: f.beatId,
                        actions: b.actions.filter((_, i) => i !== f.idx),
                      })
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
            {fx.length === 0 && (
              <span className="cc-muted">Chưa có. Thêm để đối tượng xuất hiện / nhấn / biến mất.</span>
            )}
          </div>
          {addFx ? (
            <EffectGallery elId={el.id} tSec={cap.gt} onDone={() => setAddFx(false)} />
          ) : (
            <button className="cc-add" onClick={() => setAddFx(true)}>
              ＋ Thêm hoạt hình (tại {cap.gt.toFixed(1)}s)
            </button>
          )}
        </div>

        {el.type === 'manipulative' && <ManipProps el={el} />}

        <button
          className="cc-del"
          onClick={() => (
            store.dispatch({ t: 'el.remove', sceneId, elId: el.id }),
            store.setUI({ selection: null })
          )}
        >
          🗑 Xoá đối tượng
        </button>
      </div>
    </div>
  )
}

function TextEditor({ elId }: { elId: string }) {
  const store = useStore()
  const { bundles, ui } = useSnap()
  const val = bundles[ui.activeLocale]?.strings[elId] ?? ''
  return (
    <div className="cc-card">
      <h5>Nội dung chữ</h5>
      <textarea
        className="cc-text"
        rows={2}
        value={val}
        onChange={(e) =>
          store.dispatch({ t: 'str.set', locale: ui.activeLocale, elId, text: e.target.value })
        }
      />
    </div>
  )
}

function ManipProps({ el }: { el: Element }) {
  const store = useStore()
  const { ui } = useSnap()
  const sceneId = ui.activeSceneId
  const content = (el.content ?? {}) as ManipulativeContent & { interactive?: boolean }
  const info = manipInfo(content.kind)
  const params = (content.params ?? info?.defaultParams ?? {}) as Record<string, unknown>
  const set = (p: Partial<ManipulativeContent & { interactive?: boolean }>) =>
    store.dispatch({ t: 'el.setContent', sceneId, elId: el.id, content: { ...content, ...p } })

  return (
    <>
      <div className="cc-card">
        <h5>Tương tác</h5>
        <select
          className="cc-select"
          value={content.kind}
          onChange={(e) => {
            const ni = manipInfo(e.target.value)
            set({
              kind: e.target.value,
              params: JSON.parse(JSON.stringify(ni?.defaultParams ?? {})),
              actions: [],
            })
          }}
        >
          {SUBJECTS.map((s) => (
            <optgroup key={s.id} label={s.label}>
              {manipCatalog()
                .filter((m) => m.subject === s.id)
                .map((m) => (
                  <option key={m.kind} value={m.kind}>
                    {m.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <label className="cc-check">
          <input
            type="checkbox"
            checked={!!content.interactive}
            onChange={(e) => set({ interactive: e.target.checked })}
          />{' '}
          Cho học sinh tự thao tác (chấm được)
        </label>
      </div>
      <div className="cc-card">
        <h5>Thiết lập</h5>
        {Object.entries(params)
          .filter(([, v]) => typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string')
          .map(([k, v]) => (
            <div key={k} className="cc-prow">
              <label>{paramLabel(k)}</label>
              {typeof v === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={v}
                  onChange={(e) => set({ params: { ...params, [k]: e.target.checked } })}
                />
              ) : typeof v === 'number' ? (
                <input
                  className="cc-num"
                  type="number"
                  value={v}
                  onChange={(e) => set({ params: { ...params, [k]: parseFloat(e.target.value) } })}
                />
              ) : (
                <input
                  className="cc-inp"
                  value={v as string}
                  onChange={(e) => set({ params: { ...params, [k]: e.target.value } })}
                />
              )}
            </div>
          ))}
        {Object.entries(params).some(([, v]) => v !== null && typeof v === 'object') ||
        Object.entries(params).some(([, v]) => v === null) ? (
          <details className="cc-adv">
            <summary>Tuỳ chỉnh nâng cao</summary>
            {Object.entries(params)
              .filter(([, v]) => v === null || (v !== null && typeof v === 'object'))
              .map(([k, v]) => (
                <div key={k} className="cc-prow">
                  <label>{paramLabel(k)}</label>
                  <input
                    className="cc-inp"
                    defaultValue={JSON.stringify(v)}
                    onBlur={(e) => {
                      try {
                        set({ params: { ...params, [k]: JSON.parse(e.target.value) } })
                      } catch {
                        /* keep */
                      }
                    }}
                  />
                </div>
              ))}
          </details>
        ) : null}
      </div>
    </>
  )
}

/* ---- interactive checkpoint (gate) editor ---- */
const KINDS: { id: GateSpec['kind']; label: string }[] = [
  { id: 'select', label: 'Chọn đáp án' },
  { id: 'predict-check', label: 'Dự đoán' },
  { id: 'sequence', label: 'Sắp thứ tự' },
  { id: 'hotspot', label: 'Chạm đúng vùng' },
]
function GateProps({ scene }: { scene: Scene }) {
  const store = useStore()
  const gate = scene.gate!
  const set = (patch: Partial<GateSpec>) =>
    store.dispatch({ t: 'gate.set', sceneId: scene.id, gate: { ...gate, ...patch } as GateSpec })
  const options = gate.options ?? []
  const answers = Array.isArray(gate.answer) ? gate.answer : [gate.answer]
  const hasOptions = gate.kind === 'select' || gate.kind === 'predict-check' || gate.kind === 'sequence'

  return (
    <>
      <div className="cc-card">
        <h5>Kiểu tương tác</h5>
        <div className="cc-motionchips">
          {KINDS.map((k) => (
            <button key={k.id} className={gate.kind === k.id ? 'on' : ''} onClick={() => set({ kind: k.id })}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div className="cc-card">
        <h5>Câu hỏi</h5>
        <textarea
          className="cc-text"
          rows={2}
          value={gate.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
        />
      </div>

      {hasOptions && (
        <div className="cc-card">
          <h5>{gate.kind === 'sequence' ? 'Các bước (số = thứ tự đúng)' : 'Đáp án (✓ = đúng)'}</h5>
          {options.map((o, i) => (
            <div key={o.id} className="cc-nrow">
              {gate.kind === 'sequence' ? (
                <span className="cc-order">{answers.indexOf(o.id) + 1 || '?'}</span>
              ) : (
                <input
                  type="checkbox"
                  checked={answers.includes(o.id)}
                  onChange={(e) =>
                    set({
                      answer:
                        gate.kind === 'select' || gate.kind === 'predict-check'
                          ? e.target.checked
                            ? o.id
                            : ''
                          : e.target.checked
                            ? [...answers, o.id]
                            : answers.filter((a) => a !== o.id),
                    })
                  }
                />
              )}
              <input
                className="cc-inp"
                value={o.label}
                onChange={(e) =>
                  set({
                    options: options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  })
                }
              />
              <button className="cc-xbtn" onClick={() => set({ options: options.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <button
            className="cc-add"
            onClick={() =>
              set({ options: [...options, { id: `o${Date.now() % 9999}`, label: 'Lựa chọn mới' }] })
            }
          >
            ＋ thêm lựa chọn
          </button>
          {gate.kind === 'sequence' && (
            <button
              className="cc-add"
              style={{ marginTop: 6 }}
              onClick={() => set({ answer: options.map((o) => o.id) })}
            >
              Đặt thứ tự đúng = trên xuống
            </button>
          )}
        </div>
      )}

      {gate.kind === 'hotspot' && (
        <div className="cc-card">
          <h5>Các vùng (✓ = đúng · toạ độ 0…1)</h5>
          {(gate.hotspots ?? []).map((h, i) => (
            <div key={h.id} className="cc-nrow">
              <input
                type="checkbox"
                checked={answers.includes(h.id)}
                onChange={(e) => set({ answer: e.target.checked ? h.id : '' })}
              />
              <input
                className="cc-inp"
                style={{ maxWidth: 84 }}
                value={h.label ?? ''}
                placeholder="nhãn"
                onChange={(e) =>
                  set({
                    hotspots: (gate.hotspots ?? []).map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              {(['x', 'y', 'w', 'h'] as const).map((k) => (
                <input
                  key={k}
                  className="cc-num"
                  style={{ width: 44 }}
                  type="number"
                  step={0.02}
                  value={h[k]}
                  onChange={(e) =>
                    set({
                      hotspots: (gate.hotspots ?? []).map((x, j) =>
                        j === i ? { ...x, [k]: parseFloat(e.target.value) } : x,
                      ),
                    })
                  }
                />
              ))}
              <button
                className="cc-xbtn"
                onClick={() => set({ hotspots: (gate.hotspots ?? []).filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="cc-add"
            onClick={() =>
              set({
                hotspots: [
                  ...(gate.hotspots ?? []),
                  { id: `sp${Date.now() % 9999}`, label: 'Vùng', x: 0.3, y: 0.3, w: 0.3, h: 0.3 },
                ],
              })
            }
          >
            ＋ thêm vùng
          </button>
        </div>
      )}

      <div className="cc-card">
        <h5>Phản hồi</h5>
        <input
          className="cc-inp"
          placeholder="Khi đúng…"
          value={gate.feedback?.correct ?? ''}
          onChange={(e) => set({ feedback: { correct: e.target.value, wrong: gate.feedback?.wrong ?? '' } })}
        />
        <input
          className="cc-inp"
          style={{ marginTop: 6 }}
          placeholder="Khi sai…"
          value={gate.feedback?.wrong ?? ''}
          onChange={(e) =>
            set({ feedback: { correct: gate.feedback?.correct ?? '', wrong: e.target.value } })
          }
        />
      </div>

      <button
        className="cc-del"
        onClick={() => (
          store.dispatch({ t: 'scene.remove', sceneId: scene.id }),
          store.setUI({ selection: null })
        )}
      >
        🗑 Xoá câu hỏi này
      </button>
    </>
  )
}

/** Properties for a flow connector: line shape, dash, arrow, colour, delete. */
function ConnectorProps({ el, sceneId }: { el: Element; sceneId: string }) {
  const store = useStore()
  const { doc } = useSnap()
  const c = (el.content ?? {}) as {
    arrow?: boolean
    dash?: boolean
    bendX?: number
    bendY?: number
    from?: string
    to?: string
    label?: string
  }
  const bent = !!(c.bendX || c.bendY)
  const set = (patch: Partial<typeof c>) =>
    store.dispatch({ t: 'el.setContent', sceneId, elId: el.id, content: { ...c, ...patch } })
  const setColor = (color: string) =>
    store.dispatch({
      t: 'el.setStyle',
      sceneId,
      elId: el.id,
      style: { ...(el.style ?? {}), color },
    })
  return (
    <>
      <div className="cc-card">
        <h5>Kiểu đường</h5>
        <p className="cc-muted">
          Kéo <b>tay nắm ● ở giữa</b> mũi tên trên khung để uốn cong tuỳ ý.
        </p>
        <button
          className="cc-add"
          disabled={!bent}
          onClick={() => set({ bendX: 0, bendY: 0 })}
          style={{ marginTop: 6 }}
        >
          ⟲ Làm thẳng lại
        </button>
        <div className="cc-motionchips" style={{ marginTop: 8 }}>
          <button className={!c.dash ? 'on' : ''} onClick={() => set({ dash: false })}>
            Nét liền
          </button>
          <button className={c.dash ? 'on' : ''} onClick={() => set({ dash: true })}>
            Nét đứt
          </button>
        </div>
        <label className="cc-check" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={c.arrow !== false}
            onChange={(e) => set({ arrow: e.target.checked })}
          />{' '}
          Có đầu mũi tên
        </label>
      </div>
      <div className="cc-card">
        <h5>Màu</h5>
        <div className="cc-sw">
          {Object.entries(doc.theme.colors).map(([k, v]) => (
            <button
              key={k}
              title={k}
              className={el.style?.color === k ? 'on' : ''}
              style={{ background: v }}
              onClick={() => setColor(k)}
            />
          ))}
        </div>
      </div>
      <button
        className="cc-del"
        onClick={() => (
          store.dispatch({ t: 'el.remove', sceneId, elId: el.id }),
          store.setUI({ selection: null })
        )}
      >
        🗑 Xoá mũi tên
      </button>
    </>
  )
}

/** Properties for a sound-effect (audio element): listen, retime, delete. */
function AudioProps({ el, sceneId }: { el: Element; sceneId: string }) {
  const store = useStore()
  const c = (el.content ?? {}) as {
    label?: string
    src?: string
    at?: number
    prompt?: string
    duration?: number
  }
  const [pickerOpen, setPickerOpen] = useState(false)
  const setAt = (at: number) =>
    store.dispatch(
      { t: 'el.setContent', sceneId, elId: el.id, content: { ...c, at: +at.toFixed(2) } },
      `sfxat:${el.id}`,
    )
  return (
    <>
      <div className="cc-card">
        <h5>{c.label ?? 'Âm thanh'}</h5>
        <button className="cc-mini" onClick={() => setPickerOpen(true)}>
          🔊 Chọn từ kho ({SFX_NAMES.length})
        </button>
        {pickerOpen && (
          <SfxPicker
            onClose={() => setPickerOpen(false)}
            onPick={(name, url) => {
              store.dispatch({
                t: 'el.setContent',
                sceneId,
                elId: el.id,
                content: { ...c, src: url, label: name },
              })
              setPickerOpen(false)
            }}
          />
        )}
        <div className="cc-modal-actions">
          <button
            className="cc-btn brand2"
            disabled={!c.src}
            onClick={() => {
              if (c.src) {
                try {
                  new Audio(c.src).play().catch(() => {})
                } catch {
                  /* ignore */
                }
              }
            }}
          >
            ▶ Nghe thử
          </button>
          {!c.src && <span className="cc-muted">Chưa có tiếng</span>}
        </div>
        <div className="cc-prow">
          <label>Phát tại</label>
          <input
            className="cc-num"
            type="number"
            step={0.1}
            min={0}
            value={c.at ?? 0}
            onChange={(e) => setAt(parseFloat(e.target.value) || 0)}
          />
          <span className="cc-muted">giây (trong cảnh)</span>
        </div>
        <p className="cc-muted">Kéo khối tiếng trên timeline để khớp với animation.</p>
      </div>
      <button
        className="cc-del"
        onClick={() => (
          store.dispatch({ t: 'el.remove', sceneId, elId: el.id }),
          store.setUI({ selection: null })
        )}
      >
        🗑 Xoá âm thanh
      </button>
    </>
  )
}

/** Scene-level controls shown when nothing is selected: narration + duration. */
function SceneProps({ scene, cap }: { scene: Scene; cap: CapCtx }) {
  const store = useStore()
  const { doc, bundles, ui } = useSnap()
  const bundle = bundles[ui.activeLocale] ?? bundles[doc.meta.defaultLocale]
  if (!bundle) throw new Error(`locale bundle not found: ${ui.activeLocale}`)
  const segs = resolveNarrations(scene, bundle)
  const dur = cap.project.duration
  const removeSeg = (ref: string) => {
    const ops: EditOp[] = [
      {
        t: 'scene.setNarrations',
        sceneId: scene.id,
        narrations: (scene.narrations ?? []).filter((s) => s.ref !== ref),
      },
    ]
    if (scene.narrationRef === ref)
      ops.push({ t: 'scene.setNarrationRef', sceneId: scene.id, narrationRef: undefined })
    store.batch(ops)
  }
  const sceneRegions = contractOf(scene.layout.template)?.slots.map((s) => s.name) ?? []
  return (
    <>
      <div className="cc-card">
        <h5>Bố cục (layout)</h5>
        <select
          className="cc-inp"
          value={scene.layout.template}
          onChange={(e) =>
            store.dispatch(
              {
                t: 'scene.setTemplate',
                sceneId: scene.id,
                template: e.target.value as Scene['layout']['template'],
              },
              `tpl:${scene.id}`,
            )
          }
        >
          {templateCatalog().map((t) => (
            <option key={t.template} value={t.template}>
              {t.template} · {t.use}
            </option>
          ))}
        </select>
        <p className="cc-muted" style={{ marginTop: 6 }}>
          Vùng của bố cục này: <b>{sceneRegions.join(', ') || '—'}</b>. Đổi bố cục có thể làm phần tử nằm ở
          vùng không còn — mở từng phần tử để chọn lại vùng.
        </p>
      </div>
      <div className="cc-card">
        <h5>Lời giảng ({segs.length})</h5>
        {segs.map((s, i) => {
          const txt = (bundle.narration[s.ref]?.script ?? '').replace(/\[\[cue:[^\]]+\]\]/g, '').trim()
          return (
            <div key={s.ref} className="cc-nrow">
              <button
                className="cc-inp"
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => cap.openNarr(scene.id, s.ref)}
                title="Sửa lời & tạo giọng"
              >
                {bundle.narration[s.ref]?.audioUrl ? '🔊' : '🎙'} {i + 1}.{' '}
                {txt ? txt.slice(0, 26) + (txt.length > 26 ? '…' : '') : '(trống)'} · {s.at.toFixed(1)}s
              </button>
              <button className="cc-xbtn" onClick={() => removeSeg(s.ref)} title="Xoá câu này">
                ✕
              </button>
            </div>
          )
        })}
        <button className="cc-add" onClick={() => cap.addNarr(scene.id, cap.gt)}>
          🎙 ＋ Thêm lời giảng
        </button>
        <p className="cc-muted" style={{ marginTop: 6 }}>
          Mỗi cảnh có thể có nhiều câu lời giảng, mỗi câu ở một mốc thời gian.
        </p>
      </div>
      <div className="cc-card">
        <h5>Thời lượng cảnh</h5>
        <Slider
          label="Giữ"
          v={+dur.toFixed(1)}
          min={1}
          max={30}
          step={0.5}
          unit="s"
          on={(x) =>
            store.dispatch({ t: 'scene.setHold', sceneId: scene.id, hold: +x.toFixed(2) }, `hold:${scene.id}`)
          }
        />
        <p className="cc-muted">Kéo dài để cảnh hiển thị lâu hơn. Không thể ngắn hơn lời giảng/animation.</p>
      </div>
    </>
  )
}

/** Background picker — kind + panel + (for gradient) from/to swatches + angle.
 *  Reused for the whole-lesson background and the per-scene override; the two
 *  differ only in which op the caller dispatches. */
const BG_KINDS: [Background['kind'], string][] = [
  ['paper', 'Giấy'],
  ['sky', 'Bầu trời'],
  ['meadow', 'Đồng cỏ'],
  ['gradient', 'Chuyển màu'],
  ['grid', 'Kẻ ô'],
  ['none', 'Không nền'],
]
function BgEditor({
  bg,
  colors,
  onChange,
}: {
  bg?: Background
  colors: Record<string, string>
  onChange: (bg: Background) => void
}) {
  const b: Background = bg ?? { kind: 'paper' }
  return (
    <>
      <select
        className="cc-inp"
        value={b.kind}
        onChange={(e) => onChange({ ...b, kind: e.target.value as Background['kind'] })}
      >
        {BG_KINDS.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <label className="cc-check" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={b.panel ?? true}
          onChange={(e) => onChange({ ...b, panel: e.target.checked })}
        />
        Khung nền sau nội dung
      </label>
      {b.kind === 'gradient' && (
        <>
          <p className="cc-muted" style={{ margin: '8px 0 2px' }}>
            Màu từ
          </p>
          <div className="cc-sw">
            {Object.entries(colors).map(([k, v]) => (
              <button
                key={k}
                title={k}
                className={b.from === k ? 'on' : ''}
                style={{ background: v }}
                onClick={() => onChange({ ...b, from: k })}
              />
            ))}
          </div>
          <p className="cc-muted" style={{ margin: '8px 0 2px' }}>
            đến màu
          </p>
          <div className="cc-sw">
            {Object.entries(colors).map(([k, v]) => (
              <button
                key={k}
                title={k}
                className={b.to === k ? 'on' : ''}
                style={{ background: v }}
                onClick={() => onChange({ ...b, to: k })}
              />
            ))}
          </div>
          <Slider
            label="Góc"
            v={b.angle ?? 0}
            min={0}
            max={360}
            step={15}
            unit="°"
            on={(a) => onChange({ ...b, angle: a })}
          />
        </>
      )}
    </>
  )
}

/**
 * BackgroundDialog — the LESSON-level background settings (doc.background),
 * opened from the header (not buried per-scene). Two ways to set it, matching
 * how a picture element works: pick/generate a real image from the media library
 * (`src`), OR a built-in drawn backdrop (sky/meadow/gradient/…). The engine
 * (Backdrop) paints `src` when present, else the `kind`.
 */
export function BackgroundDialog() {
  const store = useStore()
  const { doc, ui } = useSnap()
  const [picking, setPicking] = useState(false)
  if (!ui.showBackground) return null
  const bg: Background = doc.background ?? { kind: 'paper' }
  const set = (b: Background) => store.dispatch({ t: 'doc.setBackground', background: b }, 'doc-bg')
  const close = () => store.setUI({ showBackground: false })
  return (
    <>
      <div className="cc-modal-backdrop" onClick={close} />
      <div className="cc-media-modal" role="dialog" aria-label="Nền bài học">
        <div className="cc-media-head">
          <b>Nền bài học</b>
          <button className="cc-mini" onClick={close}>
            ✕
          </button>
        </div>
        <div className="cc-bg-body">
          <div className="cc-card">
            <h5>Ảnh nền</h5>
            {bg.src ? (
              <div className="cc-bg-preview">
                <img src={bg.src} alt="Nền hiện tại" />
                <button
                  className="cc-btn"
                  onClick={() => set({ ...bg, src: undefined, srcPortrait: undefined })}
                >
                  Bỏ ảnh
                </button>
              </div>
            ) : (
              <p className="cc-muted">Chưa có ảnh nền — dùng nền dựng sẵn bên dưới.</p>
            )}
            <button className="cc-btn brand" onClick={() => setPicking(true)}>
              🖼 Chọn / sinh ảnh từ thư viện
            </button>
          </div>
          <div className="cc-card">
            <h5>Hoặc nền dựng sẵn</h5>
            <BgEditor bg={bg} colors={doc.theme.colors} onChange={set} />
            {bg.src && (
              <p className="cc-muted" style={{ marginTop: 6 }}>
                Đang có ảnh nền nên nền dựng sẵn bị ảnh che. Bỏ ảnh để dùng lại.
              </p>
            )}
          </div>
        </div>
      </div>
      {picking && (
        <MediaPicker
          query={doc.meta.title}
          prompt={`soft abstract background illustration for a lesson about ${doc.meta.title}, gentle colors, no text`}
          onClose={() => setPicking(false)}
          onPick={(url) => {
            set({ ...bg, src: url })
            setPicking(false)
          }}
        />
      )}
    </>
  )
}

function Slider({
  label,
  v,
  min,
  max,
  on,
  unit,
  step = 0.01,
}: {
  label: string
  v: number
  min: number
  max: number
  on: (v: number) => void
  unit?: string
  step?: number
}) {
  return (
    <div className="cc-slider">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => on(parseFloat(e.target.value))}
      />
      <span>
        {unit == null || unit === '%'
          ? `${Math.round(v * 100)}%`
          : unit === '°'
            ? `${Math.round(v)}°`
            : `${+v.toFixed(1)}${unit}`}
      </span>
    </div>
  )
}

function typeLabel(el: Element): string {
  const LABELS: Record<Element['type'], string> = {
    text: 'Chữ',
    shape: 'Hình',
    stick: 'Nhân vật',
    diagram: 'Sơ đồ',
    stroke: 'Nét vẽ',
    manipulative: 'Tương tác',
    image: 'Ảnh',
    audio: 'Âm thanh',
    mesh3d: '3D',
    connector: 'Mũi tên nối',
    list: 'Danh sách',
    table: 'Bảng',
    chart: 'Biểu đồ',
    stat: 'Số liệu',
    quote: 'Trích dẫn',
  }
  return LABELS[el.type] ?? el.type
}

/** Friendly Vietnamese label for a manipulative param key (hides jargon). */
const PARAM_VI: Record<string, string> = {
  denominator: 'Số phần chia',
  numerator: 'Số phần lấy',
  shaded: 'Ô tô màu',
  shape: 'Kiểu hình',
  compareTo: 'So sánh với',
  count: 'Số lượng',
  counters: 'Số hạt',
  capacity: 'Sức chứa',
  bond: 'Tách thành',
  rows: 'Số hàng',
  cols: 'Số cột',
  tens: 'Chục',
  ones: 'Đơn vị',
  hundreds: 'Trăm',
  places: 'Các hàng',
  digits: 'Chữ số',
  min: 'Nhỏ nhất',
  max: 'Lớn nhất',
  step: 'Bước nhảy',
  hour: 'Giờ',
  minute: 'Phút',
  showAngle: 'Hiện góc',
  value: 'Giá trị',
  bars: 'Các thanh',
  parts: 'Các phần',
  whole: 'Tổng',
  unknown: 'Ẩn số',
  left: 'Bên trái',
  right: 'Bên phải',
  temp: 'Nhiệt độ',
  state: 'Trạng thái',
  closed: 'Đóng mạch',
  bulbs: 'Số bóng đèn',
  words: 'Các từ',
  letters: 'Các chữ',
  graphemes: 'Các âm',
  syllables: 'Âm tiết',
  root: 'Từ gốc',
  prefix: 'Tiền tố',
  suffix: 'Hậu tố',
  stages: 'Các giai đoạn',
  current: 'Hiện tại',
  organisms: 'Sinh vật',
  links: 'Liên kết',
  size: 'Kích thước',
  categories: 'Nhóm dữ liệu',
  sectors: 'Các phần',
  target: 'Mục tiêu',
  mode: 'Chế độ',
  direction: 'Chiều',
}
function paramLabel(k: string): string {
  if (PARAM_VI[k]) return PARAM_VI[k]
  return k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
}

/* ══════════════════════ slide-layer + image + region editors ════════════════
 * An imported lesson uses the slide layer (list/table/chart/stat/quote) and
 * positions by SLOT (region), not by free x/y. The inspector was built for the
 * old free-placement model, so those elements showed only colour + dead sliders
 * and read as sealed objects. These editors write through the same `el.setContent`
 * / `str.set` ops the rest of the panel uses, so edits undo/redo and autosave
 * like everything else.
 */

function useContentSetter(el: Element) {
  const store = useStore()
  const { ui } = useSnap()
  const c = (el.content ?? {}) as Record<string, unknown>
  return [
    c,
    (patch: Record<string, unknown>) =>
      store.dispatch({
        t: 'el.setContent',
        sceneId: ui.activeSceneId,
        elId: el.id,
        content: { ...c, ...patch },
      }),
  ] as const
}

/** Where the element sits, for slot-authored docs — pick a slot the template
 *  actually has, and set the order within a multi-element slot. */
function RegionProps({ el }: { el: Element }) {
  const store = useStore()
  const { doc, ui } = useSnap()
  const scene = doc.scenes.find((s) => s.id === ui.activeSceneId)
  const slots = scene ? (contractOf(scene.layout.template)?.slots.map((s) => s.name) ?? []) : []
  return (
    <div className="cc-card">
      <h5>Vị trí (slot)</h5>
      <div className="cc-prow">
        <label>Slot</label>
        <select
          className="cc-select"
          value={el.region ?? ''}
          onChange={(e) =>
            store.dispatch({
              t: 'el.setRegion',
              sceneId: ui.activeSceneId,
              elId: el.id,
              region: e.target.value || undefined,
            })
          }
        >
          {!slots.includes(el.region ?? '') && el.region && (
            <option value={el.region}>{el.region} (lạ)</option>
          )}
          {slots.map((sName) => (
            <option key={sName} value={sName}>
              {sName}
            </option>
          ))}
        </select>
      </div>
      <div className="cc-prow">
        <label>Thứ tự</label>
        <input
          className="cc-num"
          type="number"
          min={1}
          value={el.flow?.order ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value === '' ? undefined : Math.max(1, Number(e.target.value))
            store.dispatch({
              t: 'el.setFlow',
              sceneId: ui.activeSceneId,
              elId: el.id,
              flow: { ...el.flow, order: v },
            })
          }}
        />
      </div>
    </div>
  )
}

function ListProps({ el }: { el: Element }) {
  const [c, set] = useContentSetter(el)
  const items = (c.items as string[]) ?? []
  const style = (c.style as string) ?? 'bullet'
  const setItem = (i: number, v: string) => set({ items: items.map((x, j) => (j === i ? v : x)) })
  return (
    <div className="cc-card">
      <h5>Danh sách</h5>
      <div className="cc-prow">
        <label>Kiểu</label>
        <select className="cc-select" value={style} onChange={(e) => set({ style: e.target.value })}>
          {['bullet', 'number', 'check', 'dash', 'none'].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      {items.map((it, i) => (
        <div className="cc-prow" key={i}>
          <input className="cc-text" value={it} onChange={(e) => setItem(i, e.target.value)} />
          <button className="cc-mini" onClick={() => set({ items: items.filter((_, j) => j !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <button className="cc-mini" onClick={() => set({ items: [...items, 'Ý mới'] })}>
        + Thêm dòng
      </button>
    </div>
  )
}

function ChartProps({ el }: { el: Element }) {
  const [c, set] = useContentSetter(el)
  const series = (c.series as { label: string; value: number; color?: string }[]) ?? []
  const setPt = (i: number, patch: Partial<{ label: string; value: number }>) =>
    set({ series: series.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  return (
    <div className="cc-card">
      <h5>Biểu đồ</h5>
      <div className="cc-prow">
        <label>Kiểu</label>
        <select
          className="cc-select"
          value={(c.chart as string) ?? 'bar'}
          onChange={(e) => set({ chart: e.target.value })}
        >
          {['bar', 'column', 'line', 'area', 'pie', 'donut'].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      {series.map((s, i) => (
        <div className="cc-prow" key={i}>
          <input
            className="cc-text"
            style={{ flex: 2 }}
            value={s.label}
            onChange={(e) => setPt(i, { label: e.target.value })}
          />
          <input
            className="cc-num"
            type="number"
            value={s.value}
            onChange={(e) => setPt(i, { value: Number(e.target.value) })}
          />
          <button className="cc-mini" onClick={() => set({ series: series.filter((_, j) => j !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <button className="cc-mini" onClick={() => set({ series: [...series, { label: 'Mục', value: 0 }] })}>
        + Thêm cột
      </button>
    </div>
  )
}

function StatProps({ el }: { el: Element }) {
  const [c, set] = useContentSetter(el)
  return (
    <div className="cc-card">
      <h5>Số liệu</h5>
      <div className="cc-prow">
        <label>Giá trị</label>
        <input
          className="cc-text"
          value={(c.value as string) ?? ''}
          onChange={(e) => set({ value: e.target.value })}
        />
      </div>
      <div className="cc-prow">
        <label>Đơn vị</label>
        <input
          className="cc-text"
          value={(c.unit as string) ?? ''}
          onChange={(e) => set({ unit: e.target.value })}
        />
      </div>
      <div className="cc-prow">
        <label>Nhãn</label>
        <input
          className="cc-text"
          value={(c.label as string) ?? ''}
          onChange={(e) => set({ label: e.target.value })}
        />
      </div>
    </div>
  )
}

function QuoteProps({ el }: { el: Element }) {
  const store = useStore()
  const { bundles, ui } = useSnap()
  const [c, set] = useContentSetter(el)
  const text = bundles[ui.activeLocale]?.strings[el.id] ?? ''
  return (
    <div className="cc-card">
      <h5>Trích dẫn</h5>
      <textarea
        className="cc-text"
        rows={2}
        value={text}
        onChange={(e) =>
          store.dispatch({
            t: 'str.set',
            locale: ui.activeLocale,
            elId: el.id,
            text: e.target.value,
          })
        }
      />
      <div className="cc-prow">
        <label>Tác giả</label>
        <input
          className="cc-text"
          value={(c.by as string) ?? ''}
          onChange={(e) => set({ by: e.target.value })}
        />
      </div>
    </div>
  )
}

function TableProps({ el }: { el: Element }) {
  const [c] = useContentSetter(el)
  const header = (c.header as string[]) ?? []
  const rows = (c.rows as string[][]) ?? []
  // A full grid editor is a lot of surface; for now show the shape and let the
  // header/cells be edited as text. Keeps the element from being a sealed box.
  return (
    <div className="cc-card">
      <h5>
        Bảng ({header.length || (rows[0]?.length ?? 0)} cột × {rows.length} hàng)
      </h5>
      <div style={{ fontSize: 12, color: 'var(--foreground-muted, #6f665e)' }}>
        Sửa từng ô sẽ có ở bản sau — hiện chỉnh cấu trúc bảng trong JSON.
      </div>
    </div>
  )
}

function ImageProps({ el }: { el: Element }) {
  const [c, set] = useContentSetter(el)
  const [pickerOpen, setPickerOpen] = useState(false)
  const store = useStore()
  const { ui } = useSnap()
  // opened by a double-click on the picture (ui.pickImageFor) — consume the flag
  React.useEffect(() => {
    if (ui.pickImageFor === el.id) {
      setPickerOpen(true)
      store.setUI({ pickImageFor: null })
    }
  }, [ui.pickImageFor, el.id, store])
  return (
    <div className="cc-card">
      <h5>Ảnh</h5>
      {c.src ? (
        <img
          src={c.src as string}
          alt=""
          style={{ width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 6 }}
        />
      ) : (
        <div style={{ fontSize: 12, color: 'var(--cc-sub)' }}>Chưa có ảnh.</div>
      )}
      <button className="cc-mini" onClick={() => setPickerOpen(true)}>
        🖼 {c.src ? 'Đổi ảnh' : 'Chọn ảnh…'}
      </button>
      <div className="cc-prow">
        <label>Chú thích</label>
        <input
          className="cc-text"
          value={(c.alt as string) ?? ''}
          onChange={(e) => set({ alt: e.target.value })}
        />
      </div>
      {pickerOpen && (
        <MediaPicker
          query={(c.query as string) || (c.alt as string) || ''}
          prompt={(c.prompt as string) || ''}
          onClose={() => setPickerOpen(false)}
          onPick={(url, meta) => {
            set({ src: url, ...(meta?.query ? { query: meta.query } : {}) })
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}

type Hit = { id?: string; url: string; label?: string; score?: number }

/**
 * MediaPicker — a real library picker, not three inline thumbnails.
 *
 * Opens over the editor: auto-searches the media library by the element's
 * description, offers a search box, a "browse everything" mode, and an AI-
 * generate button — so filling a picture is a proper choose-or-make flow instead
 * of a dead box with a URL field.
 */
function MediaPicker({
  query,
  prompt,
  onClose,
  onPick,
}: {
  query: string
  prompt: string
  onClose: () => void
  onPick: (url: string, meta?: { query?: string }) => void
}) {
  const [q, setQ] = useState(query)
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)

  const find = React.useCallback(async (text: string) => {
    setBusy(true)
    try {
      const res = await apiPost<Hit[]>(EXPLAINER_API.imagesFind, { q: text, limit: 30 })
      setHits(res)
    } catch {
      setHits([])
    }
    setBusy(false)
  }, [])

  // auto-search by the element's description the moment it opens
  React.useEffect(() => {
    void find(query)
  }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await apiPost<{ url?: string }>(EXPLAINER_API.image, {
        prompt: prompt || q || query,
        query: q || query,
        allowGenerate: true,
      })
      if (res.url) onPick(res.url, { query: q || query })
    } catch {
      /* ignore — the button re-enables */
    }
    setGenerating(false)
  }

  return (
    <>
      <div className="cc-modal-backdrop" onClick={onClose} />
      <div className="cc-media-modal" role="dialog" aria-label="Thư viện ảnh">
        <div className="cc-media-head">
          <b>Thư viện ảnh</b>
          <button className="cc-mini" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="cc-media-tools">
          <input
            className="cc-inp"
            value={q}
            placeholder="Tìm ảnh trong thư viện…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void find(q)}
            autoFocus
          />
          <button className="cc-btn" disabled={busy} onClick={() => void find(q)}>
            {busy ? '…' : '🔍 Tìm'}
          </button>
          <button
            className="cc-btn"
            disabled={busy}
            onClick={() => void find('')}
            title="Xem toàn bộ thư viện"
          >
            Tất cả
          </button>
          <button
            className="cc-btn brand"
            disabled={generating}
            onClick={generate}
            title="Sinh ảnh mới bằng AI ($)"
          >
            {generating ? 'Đang sinh…' : '✨ Sinh bằng AI'}
          </button>
        </div>
        <div className="cc-media-grid">
          {hits === null || busy ? (
            <div className="cc-media-empty">Đang tải…</div>
          ) : hits.length ? (
            hits.map((h, i) => (
              <button
                key={h.id ?? i}
                className="cc-media-thumb"
                title={h.label ?? ''}
                onClick={() => onPick(h.url, { query: h.label })}
              >
                <img src={h.url} alt={h.label ?? ''} />
                {h.label && <span>{h.label}</span>}
              </button>
            ))
          ) : (
            <div className="cc-media-empty">
              Không tìm thấy ảnh nào. Thử từ khoá khác, xem <b>Tất cả</b>, hoặc <b>Sinh bằng AI</b>.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * SfxPicker — browse and preview the built-in sound library. Preview is silent unless the
 * deployment has configured a pack; the names are pickable either way, because the name is
 * what the document stores and what the player later resolves.
 * Filter by name, click ▶ to hear, "Chọn" to attach. So a sound effect is a
 * choose-and-hear flow instead of typing a name and hoping it exists.
 */
function SfxPicker({
  onClose,
  onPick,
}: {
  onClose: () => void
  /** `url` is undefined when this deployment has no sound pack — the name is still worth storing. */
  onPick: (name: string, url: string | undefined) => void
}) {
  const [q, setQ] = useState('')
  const names = SFX_NAMES.filter((n) => n.includes(q.trim().toLowerCase()))
  const preview = (name: string) => {
    const url = sfxUrl(name)
    if (url) {
      try {
        void new Audio(url).play().catch(() => undefined)
      } catch {
        /* ignore */
      }
    }
  }
  return (
    <>
      <div className="cc-modal-backdrop" onClick={onClose} />
      <div className="cc-media-modal" role="dialog" aria-label="Kho âm thanh">
        <div className="cc-media-head">
          <b>Kho âm thanh ({SFX_NAMES.length})</b>
          <button className="cc-mini" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="cc-media-tools">
          <input
            className="cc-inp"
            value={q}
            placeholder="Lọc theo tên (vd: animal, whoosh, correct)…"
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <div className="cc-sfx-grid">
          {names.map((n) => (
            <div key={n} className="cc-sfx-row">
              <button className="cc-mini" title="Nghe thử" onClick={() => preview(n)}>
                ▶
              </button>
              <span className="cc-sfx-name">{n}</span>
              <button className="cc-mini" onClick={() => onPick(n, sfxUrl(n))}>
                Chọn
              </button>
            </div>
          ))}
          {!names.length && <div className="cc-media-empty">Không có âm thanh nào khớp.</div>}
        </div>
      </div>
    </>
  )
}
