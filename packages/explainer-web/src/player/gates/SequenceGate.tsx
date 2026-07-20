// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * SequenceGate.tsx — order-the-steps gate (spec §12: auto-graded). The learner
 * taps chips to build an order; grading compares against `answer` (an ordered
 * array of option ids). This is the kind of graded interaction a flat video
 * fundamentally can't do — the core differentiator (spec §1, §11).
 */
'use client'
import * as React from 'react'
import { useState } from 'react'
import type { GateSpec } from '@bingoo.ai/explainer'

export function SequenceGate({
  gate,
  onPass,
  onSkip,
}: {
  gate: GateSpec
  onPass: () => void
  onSkip?: () => void
}) {
  const options = gate.options ?? []
  const answer = (Array.isArray(gate.answer) ? gate.answer : [gate.answer]) as string[]
  const [order, setOrder] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle')

  const remaining = options.filter((o) => !order.includes(o.id))

  function pick(id: string) {
    if (status === 'correct') return
    const next = [...order, id]
    setStatus('idle')
    setOrder(next)
    if (next.length === options.length) grade(next)
  }
  function reset() {
    setOrder([])
    setStatus('idle')
  }
  function grade(seq: string[]) {
    const ok = seq.length === answer.length && seq.every((id, i) => id === answer[i])
    if (ok) {
      setStatus('correct')
      window.setTimeout(onPass, 1000)
    } else {
      setStatus('wrong')
    }
  }

  return (
    <div className="gate">
      <div className="gate-card wide" role="dialog" aria-label="Sắp xếp thứ tự">
        <div className="gate-badge">Sắp thứ tự</div>
        <h2 className="gate-prompt">{gate.prompt}</h2>

        <div className={`seq-slots ${status}`}>
          {options.map((_, i) => {
            const id = order[i]
            const opt = options.find((o) => o.id === id)
            return (
              <div key={i} className={`seq-slot ${id ? 'filled' : ''}`}>
                <span className="seq-num">{i + 1}</span>
                {opt ? opt.label : '…'}
              </div>
            )
          })}
        </div>

        <div className="seq-pool">
          {remaining.map((o) => (
            <button key={o.id} className="seq-chip" onClick={() => pick(o.id)}>
              {o.label}
            </button>
          ))}
        </div>

        {status === 'correct' && (
          <p className="gate-feedback good">✓ {gate.feedback?.correct ?? 'Chuẩn thứ tự!'}</p>
        )}
        {status === 'wrong' && (
          <p className="gate-feedback bad">
            {gate.feedback?.wrong ?? 'Chưa đúng thứ tự.'}{' '}
            <button className="gate-retry" onClick={reset}>
              Làm lại
            </button>
          </p>
        )}
        {order.length > 0 && status !== 'correct' && (
          <button className="gate-skip" onClick={reset}>
            ↺ Xoá lựa chọn
          </button>
        )}
        {onSkip && status !== 'correct' && (
          <button className="gate-skip" onClick={onSkip}>
            Bỏ qua
          </button>
        )}
      </div>
    </div>
  )
}
