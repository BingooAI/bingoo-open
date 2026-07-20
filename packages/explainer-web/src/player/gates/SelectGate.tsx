/**
 * SelectGate.tsx — the select / predict-check gate (spec §11, §12, B8).
 * Real-time input isolated from the seekable timeline: tap an option → validate
 * against `answer` → positive feedback + resume, or a hint + retry (no penalty).
 * The choices render with @bingoo/ui-web's <AnswerOption> so the activity beat
 * uses the bingoo design system (states + a11y); grading stays in the engine.
 */
'use client';
import { useState } from 'react';
import type { GateSpec } from '@bingoo/explainer';
import { AnswerOption, type AnswerState } from '@bingoo/ui-web';

export function SelectGate({
  gate,
  onPass,
  onSkip,
}: {
  gate: GateSpec;
  onPass: () => void;
  onSkip?: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const answers = Array.isArray(gate.answer) ? gate.answer : [gate.answer];

  function choose(id: string) {
    setPicked(id);
    if (answers.includes(id)) {
      setStatus('correct');
      window.setTimeout(onPass, 900);
    } else {
      setStatus('wrong');
    }
  }

  return (
    <div className="gate">
      <div className="gate-card" role="dialog" aria-label="Câu hỏi tương tác">
        <div className="gate-badge">Tương tác</div>
        <h2 className="gate-prompt">{gate.prompt}</h2>
        <div className="gate-options">
          {(gate.options ?? []).map((o, i) => {
            const isPicked = picked === o.id;
            const state: AnswerState =
              status !== 'idle' && isPicked
                ? status === 'correct'
                  ? 'correct'
                  : 'incorrect'
                : isPicked
                  ? 'selected'
                  : 'default';
            return (
              <AnswerOption
                key={o.id}
                label={o.label}
                letter={String.fromCharCode(65 + i)}
                state={state}
                disabled={status === 'correct'}
                onClick={() => status !== 'correct' && choose(o.id)}
              />
            );
          })}
        </div>
        {status === 'correct' && (
          <p className="gate-feedback good">✓ {gate.feedback?.correct ?? 'Chính xác!'}</p>
        )}
        {status === 'wrong' && (
          <p className="gate-feedback bad">
            {gate.feedback?.wrong ?? 'Chưa đúng, thử lại nhé.'}{' '}
            <button className="gate-retry" onClick={() => setStatus('idle')}>
              Thử lại
            </button>
          </p>
        )}
        {onSkip && status !== 'correct' && (
          <button className="gate-skip" onClick={onSkip}>
            Xem đáp án / bỏ qua
          </button>
        )}
      </div>
    </div>
  );
}
