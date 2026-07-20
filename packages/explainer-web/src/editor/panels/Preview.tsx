// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Preview.tsx — "Học thử" (editor-spec §4.11 / player-spec §7). Opens the REAL
 * learner Player over the current (unpublished) document → instant make-test-fix
 * loop. Same runtime as publish, so WYSIWYG is guaranteed.
 */
'use client'
import * as React from 'react'
import { useState } from 'react'
import { ExplainerPlayer, type AspectMode } from '../../player/ExplainerPlayer'
import { useSnap } from '../store/ctx'

const ASPECTS: { m: AspectMode; label: string }[] = [
  { m: '16:9', label: '16:9' },
  { m: '9:16', label: '9:16' },
  { m: 'dual', label: 'Cả hai' },
]

export function Preview({ onClose }: { onClose: () => void }) {
  const { doc, bundles } = useSnap()
  const [mode, setMode] = useState<AspectMode>('16:9')
  return (
    <div className="ed-preview">
      <div className="ed-preview-bar">
        <span>Học thử · {doc.meta.title}</span>
        <div className="ed-aspect-seg" role="group" aria-label="Khổ hình">
          {ASPECTS.map(({ m, label }) => (
            <button
              key={m}
              className={mode === m ? 'on' : ''}
              onClick={() => setMode(m)}
              title={`Xem ở khổ ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="ed-mini" onClick={onClose}>
          ✕ Đóng
        </button>
      </div>
      <div className="ed-preview-body">
        <ExplainerPlayer doc={doc} bundles={bundles} mode={mode} onModeChange={setMode} />
      </div>
    </div>
  )
}
