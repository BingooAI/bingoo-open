// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * SceneStrip.tsx — the scene filmstrip (like Bingoo/PowerPoint). See every
 * scene as a thumbnail, click to jump, and manage them: add a blank scene,
 * duplicate (with its own narration copy), delete, reorder. This is what makes
 * building a lesson from scratch possible — you can create the scenes.
 */
'use client'
import * as React from 'react'
import type { Scene } from '@bingoo.ai/explainer'
import { buildProgram } from '@bingoo.ai/explainer'
import { frame } from '@bingoo.ai/explainer'
import { Stage } from '../../elements/Stage'
import { useSnap, useStore, genId } from '../store/ctx'
import type { CapCtx } from './ExplainerStudio'
import type { EditOp } from '../store/ops'

export function SceneStrip({ cap }: { cap: CapCtx }) {
  const store = useStore()
  const { doc, bundles, ui } = useSnap()
  const curIdx = doc.scenes.findIndex((s) => s.id === ui.activeSceneId)
  const dragIdx = React.useRef<number | null>(null)
  const [overIdx, setOverIdx] = React.useState<number | null>(null)

  const go = (id: string) => {
    store.setUI({ activeSceneId: id, selection: null })
    cap.setGt(0)
  }

  // drag a scene card onto another to reorder (one undo per drop)
  const drop = (to: number) => {
    const from = dragIdx.current
    dragIdx.current = null
    setOverIdx(null)
    if (from == null || from === to) return
    store.dispatch({ t: 'scene.reorder', from, to })
  }

  const addScene = () => {
    const id = genId('scene')
    const scene: Scene = {
      id,
      kind: 'exposition',
      layout: { template: 'focus', regions: {} },
      elements: [],
      beats: [],
    }
    store.dispatch({ t: 'scene.add', scene, at: curIdx < 0 ? doc.scenes.length : curIdx + 1 })
    store.setUI({ activeSceneId: id, selection: null })
  }

  const duplicate = (s: Scene, idx: number) => {
    const id = genId('scene')
    const clone: Scene = JSON.parse(JSON.stringify({ ...s, id }))
    const ops: EditOp[] = []
    // give the copy its own narration(s) so edits don't leak between scenes
    const cloneNarr = (srcRef: string): string => {
      const nref = `${srcRef}__${id}`
      for (const loc of doc.locales) {
        const n = bundles[loc]?.narration[srcRef]
        if (!n) continue
        ops.push({ t: 'narr.setScript', locale: loc, narrId: nref, script: n.script })
        ops.push({ t: 'narr.setMarks', locale: loc, narrId: nref, marks: n.marks })
        if (n.audioUrl || n.words)
          ops.push({
            t: 'narr.setAudio',
            locale: loc,
            narrId: nref,
            audioUrl: n.audioUrl,
            words: n.words,
          })
      }
      return nref
    }
    if (s.narrationRef) clone.narrationRef = cloneNarr(s.narrationRef)
    if (s.narrations?.length)
      clone.narrations = s.narrations.map((seg) => ({ ref: cloneNarr(seg.ref), at: seg.at }))
    ops.push({ t: 'scene.add', scene: clone, at: idx + 1 })
    store.batch(ops)
    store.setUI({ activeSceneId: id, selection: null })
  }

  return (
    <div className="cc-scenestrip">
      {doc.scenes.map((s, i) => (
        <div
          key={s.id}
          className={`cc-scenecard${s.id === ui.activeSceneId ? ' on' : ''}${overIdx === i && dragIdx.current !== i ? ' dropover' : ''}`}
          onClick={() => go(s.id)}
          draggable
          onDragStart={(e) => {
            dragIdx.current = i
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            if (overIdx !== i) setOverIdx(i)
          }}
          onDragLeave={() => setOverIdx((o) => (o === i ? null : o))}
          onDrop={(e) => {
            e.preventDefault()
            drop(i)
          }}
          onDragEnd={() => {
            dragIdx.current = null
            setOverIdx(null)
          }}
          title="Kéo để đổi vị trí cảnh"
        >
          <div className="cc-scenecard-idx">{i + 1}</div>
          <div className="cc-scenecard-thumb">
            <SceneThumb scene={s} />
            <span className={`cc-scenecard-badge ${s.kind}`}>{s.kind === 'gate' ? 'hỏi' : 'giảng'}</span>
          </div>
          <div className="cc-scenecard-ops">
            <button
              title="Sang trái"
              disabled={i === 0}
              onClick={(e) => (
                e.stopPropagation(),
                store.dispatch({ t: 'scene.reorder', from: i, to: i - 1 })
              )}
            >
              ‹
            </button>
            <button title="Nhân bản" onClick={(e) => (e.stopPropagation(), duplicate(s, i))}>
              ⧉
            </button>
            <button
              title="Xoá cảnh"
              disabled={doc.scenes.length <= 1}
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Xoá cảnh này?')) {
                  store.dispatch({ t: 'scene.remove', sceneId: s.id })
                  store.setUI({ selection: null })
                }
              }}
            >
              🗑
            </button>
            <button
              title="Sang phải"
              disabled={i === doc.scenes.length - 1}
              onClick={(e) => (
                e.stopPropagation(),
                store.dispatch({ t: 'scene.reorder', from: i, to: i + 1 })
              )}
            >
              ›
            </button>
          </div>
        </div>
      ))}
      <button className="cc-scene-add" onClick={addScene} title="Thêm cảnh mới">
        ＋<span>Cảnh</span>
      </button>
    </div>
  )
}

function SceneThumb({ scene }: { scene: Scene }) {
  const { doc, bundles, ui } = useSnap()
  const bundle = bundles[ui.activeLocale] ?? bundles[doc.meta.defaultLocale]
  if (!bundle) throw new Error(`locale bundle not found: ${ui.activeLocale}`)
  const program = buildProgram({ ...doc, scenes: [scene] }, bundle, '16:9')
  const model = frame(program, Math.max(0, program.duration - 0.05))
  return <Stage model={model} theme={doc.theme} />
}
