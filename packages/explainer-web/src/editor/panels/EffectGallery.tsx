/**
 * EffectGallery.tsx — pick a named animation (no verb/cue knowledge). Adding
 * one stamps the effect at the current playhead via buildAddEffectOps. You can
 * optionally attach a sound ("Kèm tiếng"): the same click generates an SFX and
 * drops it at the effect's time, so the animation plays WITH a sound.
 */
'use client'
import * as React from 'react'
import { useState } from 'react'
import { EFFECTS, EFFECT_GROUPS, buildAddEffectOps, type Effect } from '../effects'
import { SFX_NAMES, sfxUrl } from '@bingoo/explainer'
import { useSnap, useStore, genId } from '../store/ctx'
import { getEl } from '../store/ops'

// sensible default sound per effect group when "Tự động" is chosen
const AUTO_SFX: Record<string, string> = { in: 'pop_in', emph: 'ding', out: 'whoosh_move' }

export function EffectGallery({
  elId,
  tSec = 0,
  onDone,
}: {
  elId: string
  tSec?: number
  onDone?: () => void
}) {
  const store = useStore()
  const { doc, bundles, ui } = useSnap()
  const el = getEl(doc, ui.activeSceneId, elId)
  const isStick = el?.type === 'stick'
  const [sound, setSound] = useState('none') // "none" | "auto" | sfx kind

  const attachSound = (fx: Effect) => {
    const name = sound === 'auto' ? AUTO_SFX[fx.group] : sound
    const url = name ? sfxUrl(name) : undefined
    if (!name || !url) return
    // a real library clip (R2), attached instantly — no generation call
    store.dispatch({
      t: 'el.add',
      sceneId: ui.activeSceneId,
      element: {
        id: genId('sfx'),
        type: 'audio',
        content: { kind: name, label: name, src: url, at: +tSec.toFixed(2), duration: 1 },
        place: { at: 'free', x: 0.5, y: 0.5, size: 0.06 },
        z: 0,
      },
    })
  }

  const pick = (fx: Effect) => {
    const ops = buildAddEffectOps(doc, bundles, ui.activeSceneId, elId, fx, tSec)
    if (ops.length) store.batch(ops)
    if (sound !== 'none') attachSound(fx)
    onDone?.()
  }

  return (
    <div className="ed-fxgallery">
      <div className="ed-fxsound">
        <label>🔊 Kèm tiếng</label>
        <select className="cc-select" value={sound} onChange={(e) => setSound(e.target.value)}>
          <option value="none">Không</option>
          <option value="auto">Tự động (theo hiệu ứng)</option>
          {SFX_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {EFFECT_GROUPS.map((g) => (
        <div key={g.id} className="ed-fxgroup">
          <div className="ed-fxgroup-h">{g.label}</div>
          <div className="ed-fxgrid">
            {EFFECTS.filter((e) => e.group === g.id && (!e.forStick || isStick)).map((e) => (
              <button key={e.id} className="ed-fxbtn" onClick={() => pick(e)} title={e.label}>
                <span className="ed-fxicon">{e.icon}</span>
                <span className="ed-fxlabel">{e.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="ed-fxhint">
        {`Hiệu ứng đặt tại playhead (${tSec.toFixed(1)}s). Kéo playhead trước khi thêm để đổi thời điểm.`}
      </div>
    </div>
  )
}
