// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * ActivityGate.tsx — the generic interactive activity beat. Two sources, both
 * from bingoo's shared libraries, so one host unlocks the whole interaction
 * catalogue:
 *  • `activity.quiz` → a @bingoo.ai/core quiz question rendered + graded by
 *    @bingoo.ai/ui-web's <QuizShell> (ALL ~40 question types; a new type added to
 *    core appears here automatically — no change needed).
 *  • `activity.manip` → any manipulative kit, driven live and graded by
 *    checkAnswer (covers all 67 kits via the registry).
 *  • `activity.tracing` → write the letter/shape, graded by scoreTracedStroke.
 *  • `activity.coloring` → colour to a target, graded by coloringScore.
 *
 * Tracing and colouring were in @bingoo.ai/core and @bingoo.ai/ui-web all along; the
 * gate simply never reached for them. So a lesson for a five-year-old who cannot
 * read yet could only offer buttons to press — the two activities that actually
 * suit that learner were sitting there unused.
 */
'use client'
import { useState } from 'react'
import type { GateSpec, ThemeTokens, Aspect } from '@bingoo.ai/explainer'
import type { QuizQuestion, TracingGlyph, ColoringPicture } from '@bingoo.ai/core'
import { coloringScore } from '@bingoo.ai/core'
import { checkAnswer, getInteractions } from '@bingoo.ai/manipulatives'
import { QuizShell, TracingBoard, ColoringBoard } from '@bingoo.ai/ui-web'
import { InteractiveManipulative } from '../InteractiveManipulative'
import { DEFAULT_QUIZ_LABELS } from './quizLabels'
import type { QuizLabels } from '@bingoo.ai/ui-web'

export function ActivityGate({
  gate,
  theme,
  aspect = '16:9',
  onPass,
  onSkip,
  labels = DEFAULT_QUIZ_LABELS,
}: {
  gate: GateSpec
  theme: ThemeTokens
  aspect?: Aspect
  onPass: () => void
  onSkip?: () => void
  /** Host-supplied copy. Defaults to English so an unwired host reads as untranslated. */
  labels?: QuizLabels
}) {
  const act = gate.activity

  // ── tracing — the child WRITES it; every stroke scored against the guide ──
  if (act?.tracing) {
    return (
      <TracingActivity
        glyph={act.tracing as TracingGlyph}
        gate={gate}
        onPass={onPass}
        onSkip={onSkip}
        labels={labels}
      />
    )
  }

  // ── colouring — graded against each region's targetColor ──
  if (act?.coloring) {
    return (
      <ColoringActivity
        picture={act.coloring as ColoringPicture}
        gate={gate}
        onPass={onPass}
        onSkip={onSkip}
        labels={labels}
      />
    )
  }

  // ── manipulative activity — any kit, graded by checkAnswer ──
  if (act?.manip) {
    return (
      <ManipActivity
        manip={act.manip}
        theme={theme}
        aspect={aspect}
        gate={gate}
        onPass={onPass}
        onSkip={onSkip}
      />
    )
  }

  // ── quiz activity — any of the ~40 core question types via QuizShell ──
  if (act?.quiz) {
    return (
      <div className="gate">
        <div className="gate-quiz">
          {/* QuizShell brings its OWN skip + check buttons — no extra one here. */}
          <QuizShell
            questions={[act.quiz as QuizQuestion]}
            labels={labels}
            passMark={1}
            onComplete={(s) => {
              if (s.passed) onPass()
            }}
            onContinue={onPass}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="gate">
      <div className="gate-card" role="dialog">
        <h2 className="gate-prompt">{gate.prompt}</h2>
        <p className="gate-feedback bad">Hoạt động trống.</p>
        {onSkip && (
          <button className="gate-skip" onClick={onSkip}>
            Bỏ qua
          </button>
        )}
      </div>
    </div>
  )
}

/** A manipulative made interactive as a checkpoint (same shape as ManipulateGate,
 *  but sourced from `activity.manip`). */
function ManipActivity({
  manip,
  theme,
  aspect,
  gate,
  onPass,
  onSkip,
}: {
  manip: NonNullable<NonNullable<GateSpec['activity']>['manip']>
  theme: ThemeTokens
  aspect: Aspect
  gate: GateSpec
  onPass: () => void
  onSkip?: () => void
}) {
  const hint = getInteractions(manip.kind)?.hint
  const [params, setParams] = useState<unknown>(null)
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle')

  const submit = () => {
    if (checkAnswer(manip.kind, params, manip.target)) {
      setStatus('correct')
      window.setTimeout(onPass, 1100)
    } else {
      setStatus('wrong')
    }
  }

  return (
    <div className={`manip-inline ${status}`}>
      <div className="mg-banner">
        <span className="mg-badge">✍ Thử làm</span>
        <span className="mg-prompt">{gate.prompt}</span>
        {hint && <span className="mg-hint">{hint}</span>}
      </div>
      <InteractiveManipulative
        kind={manip.kind}
        theme={theme}
        aspect={aspect}
        initialParams={manip.params}
        variant="stage"
        hideHint
        onParams={(p) => {
          setParams(p)
          if (status !== 'correct') setStatus('idle')
        }}
        extra={
          <>
            <button
              className="sandbox-btn check"
              onClick={submit}
              disabled={status === 'correct' || params == null}
            >
              ✓ Kiểm tra
            </button>
            {status === 'correct' && (
              <span className="mg-fb good">🎉 {gate.feedback?.correct ?? 'Chính xác!'}</span>
            )}
            {status === 'wrong' && (
              <span className="mg-fb bad">{gate.feedback?.wrong ?? 'Chưa đúng — thử lại nhé.'}</span>
            )}
            {onSkip && status !== 'correct' && (
              <button className="mg-skip" onClick={onSkip}>
                Bỏ qua →
              </button>
            )}
          </>
        }
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── tracing / coloring */

function TracingActivity({
  glyph,
  gate,
  onPass,
  onSkip,
  labels,
}: {
  glyph: TracingGlyph
  gate: GateSpec
  labels: QuizLabels
  onPass: () => void
  onSkip?: () => void
}) {
  const [done, setDone] = useState(false)
  return (
    <div className="gate">
      <p className="gate-prompt">{gate.prompt}</p>
      <div className="gate-quiz">
        <TracingBoard
          glyph={glyph}
          label={glyph.label}
          // TracingBoard scores each stroke against its guide (scoreTracedStroke)
          // and only fires onComplete when every stroke has been accepted.
          onComplete={() => setDone(true)}
        />
      </div>
      <div className="gate-actions">
        {onSkip ? (
          <button type="button" className="gate-skip" onClick={onSkip}>
            {labels.skip}
          </button>
        ) : null}
        <button type="button" className="gate-check" disabled={!done} onClick={onPass}>
          {labels.check}
        </button>
      </div>
      {done && gate.feedback?.correct ? <p className="gate-feedback good">{gate.feedback.correct}</p> : null}
    </div>
  )
}

/** Pass when this share of the target regions are the right colour. */
const COLORING_PASS = 0.8

function ColoringActivity({
  picture,
  gate,
  onPass,
  onSkip,
  labels,
}: {
  picture: ColoringPicture
  gate: GateSpec
  labels: QuizLabels
  onPass: () => void
  onSkip?: () => void
}) {
  const palette = [...new Set(picture.regions.map((r) => r.targetColor).filter(Boolean))] as string[]
  const [color, setColor] = useState(palette[0] ?? '#e07a42')
  const [fills, setFills] = useState<Record<string, string>>({})
  const [verdict, setVerdict] = useState<null | boolean>(null)

  return (
    <div className="gate">
      <p className="gate-prompt">{gate.prompt}</p>
      <div className="gate-quiz">
        <div className="gate-palette">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={c === color ? 'swatch on' : 'swatch'}
              style={{ background: c }}
            />
          ))}
        </div>
        <ColoringBoard
          picture={picture}
          fills={fills}
          activeColor={color}
          onChange={setFills}
          disabled={verdict === true}
        />
      </div>
      <div className="gate-actions">
        {onSkip ? (
          <button type="button" className="gate-skip" onClick={onSkip}>
            {labels.skip}
          </button>
        ) : null}
        <button
          type="button"
          className="gate-check"
          onClick={() => {
            // graded BY CODE against each region's targetColor — not by opinion
            const pass = coloringScore(picture, fills) >= COLORING_PASS
            setVerdict(pass)
            if (pass) onPass()
          }}
        >
          {labels.check}
        </button>
      </div>
      {verdict === true ? <p className="gate-feedback good">{gate.feedback?.correct ?? ''}</p> : null}
      {verdict === false ? <p className="gate-feedback bad">{gate.feedback?.wrong ?? ''}</p> : null}
    </div>
  )
}
