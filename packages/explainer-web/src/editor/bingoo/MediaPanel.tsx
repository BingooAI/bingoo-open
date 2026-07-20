/**
 * MediaPanel.tsx — the "add media" rail (Bingoo-style). Click a tile to drop an
 * object into the scene at the playhead; it's selected so its clip appears on
 * the timeline. Grouped: Chữ · Hình · Nhân vật · Thiên nhiên · Tương tác · Art.
 */
'use client'
import * as React from 'react'
import { useState } from 'react'
import type { Element, Place, GateSpec } from '@bingoo/explainer'
import { PROP_META } from '@bingoo/explainer'
import { Button } from '@bingoo/ui-web'
import { SVG_ASSETS } from '../../kit/svgAssets'
import { manipCatalog, SUBJECTS } from '../manipCatalog'
import { SFX_META, SFX_GROUPS, sfxUrl } from '@bingoo/explainer'
import { useSnap, useStore, genId } from '../store/ctx'
import { insertGateOps } from './split'
import { dragState, type ElFactory } from './dragState'
import { Thumb } from './Thumb'
import type { CapCtx } from './ExplainerStudio'
import { EXPLAINER_API, apiPost } from './endpoints'

const SKY = Object.keys(PROP_META).filter((k) => PROP_META[k]!.anchor === 'center')
const GROUND = Object.keys(PROP_META).filter((k) => PROP_META[k]!.anchor === 'bottom')
const TABS = [
  { id: 'text', label: 'Chữ' },
  { id: 'shape', label: 'Hình' },
  { id: 'nature', label: 'Thiên nhiên' },
  { id: 'char', label: 'Nhân vật' },
  { id: 'manip', label: 'Tương tác' },
  { id: 'img', label: 'Ảnh' },
  { id: 'audio', label: 'Âm thanh' },
  { id: 'art', label: 'Art' },
] as const
type Tab = (typeof TABS)[number]['id']

export function MediaPanel({ cap }: { cap: CapCtx }) {
  const store = useStore()
  const { doc, bundles, ui } = useSnap()
  const [tab, setTab] = useState<Tab>('text')
  const [sfxFilter, setSfxFilter] = useState('')
  const [imgPrompt, setImgPrompt] = useState('')
  const [imgBusy, setImgBusy] = useState(false)
  const [imgErr, setImgErr] = useState<string | null>(null)

  // AI image: generate a picture from a description via the image provider and
  // drop it into the scene (upload path stays for local files).
  const genImage = async () => {
    const p = imgPrompt.trim()
    if (!p || imgBusy) return
    setImgBusy(true)
    setImgErr(null)
    try {
      const data = await apiPost<{ url?: string }>(EXPLAINER_API.image, {
        prompt: p,
        query: p,
        allowGenerate: true,
      })
      if (!data.url) throw new Error('Không tạo được ảnh (chưa cấu hình provider?)')
      // the layout engine places by SLOT — a free x/y here would be exactly the
      // "LLM puts things at random coordinates" bug, committed by the editor
      add((id) => ({
        el: {
          id,
          type: 'image',
          region: 'stage',
          content: { kind: 'image', src: data.url, alt: p },
          z: 5,
        },
      }))
      setImgPrompt('')
    } catch (e) {
      setImgErr(String(e))
    }
    setImgBusy(false)
  }

  // Attach a REAL sound from the built-in library (SFX_CATALOG on R2) at the
  // playhead. No generation — the old flow called a broken ElevenLabs endpoint;
  // these are curated clips that just play.
  const addSfx = (name: string) => {
    const url = sfxUrl(name)
    if (!url) return
    const sceneId = targetScene()
    const b = cap.project.sceneBounds.find((s) => s.id === sceneId)
    const at = +Math.max(0, cap.gt - (b?.start ?? 0)).toFixed(2)
    const id = genId('sfx')
    store.dispatch({
      t: 'el.add',
      sceneId,
      element: {
        id,
        type: 'audio',
        content: { kind: name, label: name, src: url, at, duration: 1 },
        place: { at: 'free', x: 0.5, y: 0.5, size: 0.06 },
        z: 0,
      },
    })
    store.setUI({ activeSceneId: sceneId, selection: id })
  }
  const previewSfx = (name: string) => {
    const url = sfxUrl(name)
    if (url) {
      try {
        void new Audio(url).play().catch(() => undefined)
      } catch {
        /* ignore */
      }
    }
  }

  // add to the scene shown at the playhead (so the new object is visible now)
  const targetScene = () =>
    (cap.project.sceneBounds.find((s) => cap.gt >= s.start && cap.gt < s.end) ?? cap.project.sceneBounds[0])
      ?.id ?? ui.activeSceneId

  // insert an interactive checkpoint, SPLITTING the scene at the playhead so the
  // question sits between "before" and "after" halves (spec: real break point).
  const addGate = (gate: GateSpec) => {
    const curId = targetScene()
    const b = cap.project.sceneBounds.find((s) => s.id === curId)
    const tsLocal = b ? cap.gt - b.start : 0
    const gateId = genId('gate')
    const { ops, split } = insertGateOps(doc, bundles, curId, tsLocal, gate, gateId, genId('scene'))
    store.batch(ops)
    store.setUI({ activeSceneId: gateId, selection: null })
    // place the playhead on the new checkpoint (it sits right at the cut)
    if (!split && b) cap.setGt(b.end + 0.05)
    else cap.setGt(cap.gt)
  }
  const GATES: { label: string; icon: string; make: () => GateSpec }[] = [
    {
      label: 'Chọn đáp án',
      icon: '☑',
      make: () => ({
        kind: 'select',
        prompt: 'Câu hỏi cho học sinh?',
        options: [
          { id: 'a', label: 'Đáp án A' },
          { id: 'b', label: 'Đáp án B' },
          { id: 'c', label: 'Đáp án C' },
        ],
        answer: 'a',
        feedback: { correct: 'Đúng rồi!', wrong: 'Chưa đúng, thử lại nhé.' },
        onPass: 'resume',
      }),
    },
    {
      label: 'Sắp thứ tự',
      icon: '⇅',
      make: () => ({
        kind: 'sequence',
        prompt: 'Kéo sắp đúng thứ tự:',
        options: [
          { id: 's1', label: 'Bước 1' },
          { id: 's2', label: 'Bước 2' },
          { id: 's3', label: 'Bước 3' },
        ],
        answer: ['s1', 's2', 's3'],
        feedback: { correct: 'Chuẩn thứ tự!', wrong: 'Chưa đúng, thử lại.' },
        onPass: 'resume',
      }),
    },
    {
      label: 'Chạm đúng vùng',
      icon: '◎',
      make: () => ({
        kind: 'hotspot',
        prompt: 'Chạm vào đúng vùng:',
        hotspots: [
          { id: 'h1', label: 'Vùng A', x: 0.18, y: 0.3, w: 0.3, h: 0.3 },
          { id: 'h2', label: 'Vùng B', x: 0.55, y: 0.3, w: 0.3, h: 0.3 },
        ],
        answer: 'h1',
        feedback: { correct: 'Đúng chỗ!', wrong: 'Chưa đúng, thử lại.' },
        onPass: 'resume',
      }),
    },
    {
      label: 'Dự đoán',
      icon: '❓',
      make: () => ({
        kind: 'predict-check',
        prompt: 'Em dự đoán điều gì xảy ra?',
        options: [
          { id: 'a', label: 'Khả năng 1' },
          { id: 'b', label: 'Khả năng 2' },
        ],
        answer: 'a',
        feedback: { correct: 'Đúng!', wrong: 'Chưa đúng.' },
        onPass: 'resume',
      }),
    },
  ]
  const add = (make: (id: string) => { el: Element; text?: string }) => {
    const id = genId('el')
    const sceneId = targetScene()
    const { el, text } = make(id)
    store.dispatch({ t: 'el.add', sceneId, element: el })
    if (text !== undefined) store.dispatch({ t: 'str.set', locale: ui.activeLocale, elId: id, text })
    store.setUI({ activeSceneId: sceneId, selection: id })
  }
  const shapeEl = (shape: string, place: Place, color = 'ink'): Element => ({
    id: '',
    type: 'shape',
    content: { shape },
    place,
    style: { color, weight: 'md' },
  })
  const skyP: Place = { at: 'sky', x: 0.5, y: 0.24, size: 0.16 }
  const groundP: Place = { at: 'ground', x: 0.5, size: 0.22 }
  const freeP: Place = { at: 'free', x: 0.5, y: 0.5, size: 0.2 }
  const titleF: ElFactory = (id) => ({
    el: {
      id,
      type: 'text',
      content: {},
      place: { at: 'free', x: 0.5, y: 0.16, size: 0.1, w: 0.7 },
      style: { color: 'ink', fontSize: 'title', font: 'hand', align: 'center' },
    },
    text: 'Tiêu đề',
  })
  const subF: ElFactory = (id) => ({
    el: {
      id,
      type: 'text',
      content: {},
      place: { at: 'free', x: 0.5, y: 0.8, size: 0.05, w: 0.8 },
      style: { color: 'ink', fontSize: 'body', font: 'sans', align: 'center' },
    },
    text: 'Câu phụ đề',
  })
  const dragProps = (f: ElFactory) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      dragState.make = f
      e.dataTransfer.effectAllowed = 'copy'
    },
    onDragEnd: () => {
      dragState.make = null
    },
  })

  return (
    <div className="cc-media">
      <div className="cc-media-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="cc-media-body">
        {tab === 'text' && (
          <div className="cc-tiles">
            <button className="cc-tile big" {...dragProps(titleF)} onClick={() => add(titleF)}>
              Aa<small>Tiêu đề lớn</small>
            </button>
            <button className="cc-tile big" {...dragProps(subF)} onClick={() => add(subF)}>
              abc<small>Nội dung</small>
            </button>
          </div>
        )}
        {tab === 'shape' && (
          <>
            <button
              className={ui.connecting ? 'cc-add on' : 'cc-add'}
              style={ui.connecting ? { borderColor: 'var(--cc-brand)', color: 'var(--cc-brand)' } : undefined}
              onClick={() => store.setUI({ connecting: !ui.connecting, connectFrom: null })}
            >
              {ui.connecting
                ? '✓ Đang nối — bấm 2 hình để tạo mũi tên (bấm để tắt)'
                : '🔗 Nối hình (vẽ mũi tên flow)'}
            </button>
            <div className="cc-media-sub">Cơ bản</div>
            <Tiles
              items={['box', 'circle', 'star', 'arrow', 'wave', 'droplet']}
              onAdd={add}
              make={(s) => (id) => ({
                el: { ...shapeEl(s, freeP, s === 'star' || s === 'arrow' ? 'accent' : 'ink'), id },
              })}
            />
            <div className="cc-media-sub">Sơ đồ (flowchart)</div>
            <Tiles
              items={['box', 'pill', 'diamond', 'parallelogram', 'hexagon', 'cylinder']}
              labels={{
                box: 'Xử lý',
                pill: 'Bắt đầu/Kết thúc',
                diamond: 'Quyết định',
                parallelogram: 'Nhập/Xuất',
                hexagon: 'Chuẩn bị',
                cylinder: 'Dữ liệu',
              }}
              onAdd={add}
              make={(s) => (id) => ({
                el: {
                  ...shapeEl(s, { at: 'free', x: 0.5, y: 0.5, size: 0.18, w: 0.26 }, 'ink'),
                  id,
                },
              })}
            />
          </>
        )}
        {tab === 'nature' && (
          <>
            <div className="cc-media-sub">Bầu trời</div>
            <Tiles
              items={SKY}
              onAdd={add}
              make={(s) => (id) => ({
                el: { ...shapeEl(s, skyP, s.includes('sun') ? 'accent' : 'inkSoft'), id },
              })}
            />
            <div className="cc-media-sub">Mặt đất</div>
            <Tiles
              items={GROUND}
              onAdd={add}
              make={(s) => (id) => ({
                el: {
                  ...shapeEl(
                    s,
                    groundP,
                    s === 'puddle' || s === 'lake' ? 'accent2' : s === 'flower' ? 'accent' : 'good',
                  ),
                  id,
                },
              })}
            />
          </>
        )}
        {tab === 'char' && (
          <Tiles
            thumbType="stick"
            items={['stick']}
            labels={{ stick: 'Người que' }}
            onAdd={add}
            make={() => (id) => ({
              el: {
                id,
                type: 'stick',
                content: {},
                place: groundP,
                style: { color: 'ink', weight: 'md' },
                poses: { base: { visible: true, face: 'neutral' } },
              },
            })}
          />
        )}
        {tab === 'manip' && (
          <>
            <div className="cc-media-sub">❓ Câu hỏi cho học sinh (dừng lại &amp; chấm)</div>
            <div className="cc-tiles">
              {GATES.map((g) => (
                <button key={g.label} className="cc-tile" onClick={() => addGate(g.make())}>
                  <span className="cc-tile-thumb" style={{ fontSize: 18 }}>
                    {g.icon}
                  </span>
                  <small>{g.label}</small>
                </button>
              ))}
            </div>
            <div className="cc-media-sub" style={{ marginTop: 12 }}>
              🧩 Học cụ cho học sinh tự thao tác
            </div>
            {SUBJECTS.map((sub) => (
              <React.Fragment key={sub.id}>
                <div className="cc-media-sub2">{sub.label}</div>
                <div className="cc-tiles">
                  {manipCatalog()
                    .filter((m) => m.subject === sub.id)
                    .map((m) => (
                      <button
                        key={m.kind}
                        className="cc-tile"
                        {...dragProps((id) => ({
                          el: {
                            id,
                            type: 'manipulative',
                            content: {
                              kind: m.kind,
                              params: JSON.parse(JSON.stringify(m.defaultParams)),
                              actions: [],
                              interactive: true,
                            },
                            place: { at: 'free', x: 0.5, y: 0.56, size: 0.6, w: 0.86 },
                            z: 6,
                            style: { color: 'ink', weight: 'md' },
                          },
                        }))}
                        onClick={() =>
                          add((id) => ({
                            el: {
                              id,
                              type: 'manipulative',
                              content: {
                                kind: m.kind,
                                params: JSON.parse(JSON.stringify(m.defaultParams)),
                                actions: [],
                                interactive: true,
                              },
                              place: { at: 'free', x: 0.5, y: 0.56, size: 0.6, w: 0.86 },
                              z: 6,
                              style: { color: 'ink', weight: 'md' },
                            },
                          }))
                        }
                      >
                        <span className="cc-tile-thumb">
                          <Thumb type="manipulative" name={m.kind} box={28} />
                        </span>
                        <small>{m.label}</small>
                      </button>
                    ))}
                </div>
              </React.Fragment>
            ))}
          </>
        )}
        {tab === 'img' && (
          <div className="cc-imgupload">
            <label className="cc-uploadbtn">
              📁 Tải ảnh lên
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const rd = new FileReader()
                  rd.onload = () =>
                    add((id) => ({
                      el: {
                        id,
                        type: 'image',
                        content: { src: String(rd.result), alt: f.name },
                        place: { at: 'free', x: 0.5, y: 0.5, size: 0.4 },
                        z: 5,
                      },
                    }))
                  rd.readAsDataURL(f)
                  e.currentTarget.value = ''
                }}
              />
            </label>
            <p className="cc-muted">
              Chọn ảnh từ máy (PNG/JPG/SVG). Ảnh chèn vào giữa khung — kéo, đổi cỡ, thêm hiệu ứng như mọi đối
              tượng.
            </p>
            <div className="cc-media-sub" style={{ marginTop: 10 }}>
              ✨ Tạo ảnh bằng AI
            </div>
            <textarea
              className="cc-text"
              rows={2}
              value={imgPrompt}
              onChange={(e) => setImgPrompt(e.target.value)}
              placeholder="Mô tả ảnh cần vẽ (vd: một giọt nước dễ thương)…"
            />
            <Button
              variant="primary"
              size="sm"
              fullWidth
              style={{ marginTop: 6 }}
              disabled={imgBusy || !imgPrompt.trim()}
              onClick={genImage}
            >
              {imgBusy ? 'Đang tạo ảnh…' : '✨ Tạo ảnh'}
            </Button>
            {imgErr && (
              <p className="cc-muted" style={{ color: '#f0a', marginTop: 6 }}>
                {imgErr}
              </p>
            )}
          </div>
        )}
        {tab === 'audio' && (
          <>
            <div className="cc-media-sub">
              🔊 Hiệu ứng âm thanh · kho {SFX_META.length} tiếng (đặt tại kim thời gian)
            </div>
            <input
              className="cc-inp"
              value={sfxFilter}
              placeholder="Tìm: đúng, mưa, mèo, ăn mừng…"
              onChange={(e) => setSfxFilter(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            {(() => {
              const q = sfxFilter.trim().toLowerCase()
              const matched = SFX_META.filter(
                (m) =>
                  !q ||
                  m.label.toLowerCase().includes(q) ||
                  m.name.includes(q) ||
                  m.group.toLowerCase().includes(q),
              )
              return SFX_GROUPS.map((g) => {
                const items = matched.filter((m) => m.group === g)
                if (!items.length) return null
                return (
                  <div key={g} className="cc-sfx-group">
                    <div className="cc-sfx-grouphead">
                      {g} · {items.length}
                    </div>
                    <div className="cc-sfx-list">
                      {items.map((m) => (
                        <div key={m.name} className="cc-sfx-row">
                          <button className="cc-mini" title="Nghe thử" onClick={() => previewSfx(m.name)}>
                            ▶
                          </button>
                          <span className="cc-sfx-name">
                            {m.label} <span className="cc-sfx-slug">{m.name}</span>
                          </span>
                          <button
                            className="cc-mini"
                            title="Chèn tại kim thời gian"
                            onClick={() => addSfx(m.name)}
                          >
                            ＋
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            })()}
            <p className="cc-muted" style={{ marginTop: 8 }}>
              ▶ nghe thử · ＋ chèn vào cảnh tại kim thời gian. Kéo khối tiếng trên timeline để khớp với
              animation.
            </p>
            <div className="cc-media-sub" style={{ marginTop: 12 }}>
              🎵 Nhạc nền (lặp cả bài)
            </div>
            {doc.music?.src ? (
              <div className="cc-imgupload">
                <audio controls src={doc.music.src} style={{ width: '100%', height: 32 }} />
                <div className="cc-prow">
                  <label>Âm lượng</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={doc.music.volume ?? 0.3}
                    onChange={(e) =>
                      store.dispatch({
                        t: 'doc.setMusic',
                        music: { src: doc.music!.src, volume: +e.target.value },
                      })
                    }
                    style={{ flex: 1 }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={() => store.dispatch({ t: 'doc.setMusic', music: undefined })}
                >
                  🗑 Xoá nhạc nền
                </Button>
              </div>
            ) : (
              <label className="cc-uploadbtn">
                🎵 Tải nhạc nền
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const rd = new FileReader()
                    rd.onload = () =>
                      store.dispatch({
                        t: 'doc.setMusic',
                        music: { src: String(rd.result), volume: 0.3 },
                      })
                    rd.readAsDataURL(f)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
            )}
          </>
        )}
        {tab === 'art' && (
          <Tiles
            items={Object.keys(SVG_ASSETS)}
            onAdd={add}
            make={(s) => (id) => ({
              el: {
                ...shapeEl(
                  s,
                  s.includes('sun') ? skyP : { at: 'sky', x: 0.5, y: 0.3, size: 0.16 },
                  s.includes('sun') ? 'accent' : 'inkSoft',
                ),
                id,
              },
            })}
          />
        )}
      </div>
    </div>
  )
}

function Tiles({
  items,
  make,
  onAdd,
  labels,
  thumbType = 'shape',
}: {
  items: string[]
  make: (s: string) => ElFactory
  onAdd: (f: ElFactory) => void
  labels?: Record<string, string>
  thumbType?: string
}) {
  return (
    <div className="cc-tiles">
      {items.map((s) => (
        <button
          key={s}
          className="cc-tile"
          draggable
          onClick={() => onAdd(make(s))}
          onDragStart={(e) => {
            dragState.make = make(s)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onDragEnd={() => {
            dragState.make = null
          }}
          title="Bấm để thêm, hoặc kéo thả vào khung"
        >
          <span className="cc-tile-thumb">
            <Thumb type={thumbType} name={s} box={30} />
          </span>
          <small>{labels?.[s] ?? s}</small>
        </button>
      ))}
    </div>
  )
}
