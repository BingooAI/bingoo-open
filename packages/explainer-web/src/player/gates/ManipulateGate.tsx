/**
 * ManipulateGate.tsx — the interactive checkpoint, rendered INLINE in the stage
 * (not a popup): the whiteboard the learner was watching simply becomes
 * touchable. A slim prompt banner sits on top, the live manipulative fills the
 * stage, and a control bar (verbs + "Kiểm tra") overlays the bottom. Grading is
 * by code (checkAnswer vs the goal) — correct resumes the lesson, wrong hints.
 */
'use client'
import * as React from 'react'
import { useState } from 'react'
import type { GateSpec, ThemeTokens, Aspect } from '@bingoo.ai/explainer'
import { checkAnswer, getInteractions } from '@bingoo.ai/manipulatives'
import { InteractiveManipulative } from '../InteractiveManipulative'

export function ManipulateGate({
  gate,
  theme,
  aspect = '16:9',
  onPass,
  onSkip,
}: {
  gate: GateSpec
  theme: ThemeTokens
  aspect?: Aspect
  onPass: () => void
  onSkip?: () => void
}) {
  const manip = gate.manip!
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
        aspect={manip.aspect ?? aspect}
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
