/**
 * HotspotGate.tsx — tap-the-right-region gate (spec §12: auto-graded). Hotspots
 * are normalized (0..1) rects laid over the frozen exposition frame, so the same
 * gate works at both aspects. Tap correct → resume; tap wrong → hint + retry.
 */
'use client';
import * as React from 'react';
import { useState } from 'react';
import type { GateSpec } from '@bingoo/explainer';

export function HotspotGate({
  gate,
  onPass,
  onSkip,
}: {
  gate: GateSpec;
  onPass: () => void;
  onSkip?: () => void;
}) {
  const spots = gate.hotspots ?? [];
  const answers = Array.isArray(gate.answer) ? gate.answer : [gate.answer];
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [tried, setTried] = useState<string | null>(null);

  function tap(id: string) {
    if (status === 'correct') return;
    setTried(id);
    if (answers.includes(id)) {
      setStatus('correct');
      window.setTimeout(onPass, 900);
    } else {
      setStatus('wrong');
    }
  }

  return (
    <div className="gate hotspot-gate">
      {/* tappable zones over the frozen stage */}
      {spots.map((s) => {
        const state = tried === s.id ? (status === 'correct' ? 'correct' : 'wrong') : 'idle';
        return (
          <button
            key={s.id}
            className={`hotspot ${state}`}
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              width: `${s.w * 100}%`,
              height: `${s.h * 100}%`,
            }}
            onClick={() => tap(s.id)}
            aria-label={s.label ?? s.id}
          >
            {s.label ? <span className="hotspot-tag">{s.label}</span> : null}
          </button>
        );
      })}

      <div className="hotspot-bar">
        <span className="gate-badge">Chạm đúng vùng</span>
        <span className="hotspot-prompt">{gate.prompt}</span>
        {status === 'correct' && (
          <span className="gate-feedback good">✓ {gate.feedback?.correct ?? 'Đúng chỗ!'}</span>
        )}
        {status === 'wrong' && (
          <span className="gate-feedback bad">
            {gate.feedback?.wrong ?? 'Chưa đúng, thử lại.'}{' '}
            <button className="gate-retry" onClick={() => setStatus('idle')}>
              Thử lại
            </button>
          </span>
        )}
        {onSkip && status !== 'correct' && (
          <button className="gate-skip inline" onClick={onSkip}>
            Bỏ qua
          </button>
        )}
      </div>
    </div>
  );
}
