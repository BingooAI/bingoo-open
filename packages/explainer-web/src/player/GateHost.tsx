// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * GateHost.tsx — the PLAYING → PAUSED_AT_GATE → PLAYING handoff (spec §11).
 * The exposition frame is frozen underneath (rendered by Player); GateHost picks
 * the gate widget by kind and overlays it. v1 wires select/predict-check,
 * sequence, and hotspot — all auto-graded (spec §12).
 */
'use client'
import * as React from 'react'
import type { GateSpec, ThemeTokens, Aspect } from '@bingoo.ai/explainer'
import type { QuizLabels } from '@bingoo.ai/ui-web'
import type { PlayerLabels } from './labels'
import { SelectGate } from './gates/SelectGate'
import { SequenceGate } from './gates/SequenceGate'
import { HotspotGate } from './gates/HotspotGate'
import { ManipulateGate } from './gates/ManipulateGate'
import { ActivityGate } from './gates/ActivityGate'

/** Pick the widget for a gate. Shared by the LIVE host and the lead-in PREVIEW,
 *  so the preview shows the SAME question/options/board the learner will answer —
 *  not a stand-in. In preview the callbacks are no-ops and the wrapper disables
 *  pointer events, so nothing grades until the real pause. */
function renderGate(
  gate: GateSpec,
  theme: ThemeTokens,
  aspect: Aspect,
  onPass: () => void,
  onSkip?: () => void,
  labels?: QuizLabels,
  locale?: string,
  playerLabels?: PlayerLabels,
) {
  switch (gate.kind) {
    case 'activity':
      return (
        <ActivityGate
          gate={gate}
          theme={theme}
          aspect={aspect}
          onPass={onPass}
          onSkip={onSkip}
          labels={labels}
          locale={locale}
          playerLabels={playerLabels}
        />
      )
    case 'manipulate':
      return (
        <ManipulateGate
          gate={gate}
          theme={theme}
          aspect={aspect}
          onPass={onPass}
          onSkip={onSkip}
          locale={locale}
        />
      )
    case 'sequence':
      return <SequenceGate gate={gate} onPass={onPass} onSkip={onSkip} />
    case 'hotspot':
      return <HotspotGate gate={gate} onPass={onPass} onSkip={onSkip} />
    case 'select':
    case 'predict-check':
    default:
      return <SelectGate gate={gate} onPass={onPass} onSkip={onSkip} />
  }
}

/**
 * The gate scene's LEAD-IN look, shown while the scene is PLAYING (before the
 * pause, and again while re-watching an already-answered gate). It renders the
 * REAL widget — the actual choices, the match board, the categorize columns —
 * but dimmed and un-clickable (the wrapper kills pointer events; callbacks are
 * no-ops). Without it a gate scene is a lonely title over an empty box; with it
 * the learner sees exactly what's coming, and it grades only at the live pause.
 */
function GatePreview({ gate, theme, aspect }: { gate: GateSpec; theme: ThemeTokens; aspect: Aspect }) {
  return (
    <div className="gate-preview" aria-hidden="true">
      <div className="gate-preview-tag">Câu hỏi sắp tới</div>
      {renderGate(gate, theme, aspect, () => {}, undefined, undefined, undefined, undefined)}
    </div>
  )
}

export function GateHost({
  gate,
  theme,
  aspect = '16:9',
  preview = false,
  onPass,
  onSkip,
  labels,
  locale,
  playerLabels,
}: {
  gate: GateSpec
  theme: ThemeTokens
  aspect?: Aspect
  /** lead-in preview (dimmed, non-interactive) instead of the live gate */
  preview?: boolean
  onPass: () => void
  onSkip?: () => void
  /** Host copy for the embedded quiz. Omitted falls back to English. */
  labels?: QuizLabels
  /** Language for kit hints. */
  locale?: string
  /** Chrome and feedback copy for the gates. */
  playerLabels?: PlayerLabels
}) {
  if (preview) return <GatePreview gate={gate} theme={theme} aspect={aspect} />
  return renderGate(gate, theme, aspect, onPass, onSkip, labels, locale, playerLabels)
}
